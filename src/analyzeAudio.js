import path from 'node:path';
import { QC_THRESHOLDS } from './config.js';
import {
  extractJsonFromOutput,
  runFfmpeg,
  runFfprobe,
} from './ffmpegUtils.js';

/**
 * @typedef {Object} AudioAnalysis
 * @property {string} filename
 * @property {number | null} duration
 * @property {number | null} sampleRate
 * @property {number | null} channels
 * @property {number | null} lufs
 * @property {number | null} rmsDbfs
 * @property {number | null} peakDbfs
 * @property {number | null} truePeakDbfs
 * @property {number} clippingCount
 * @property {number} clippingPercentage
 * @property {number} leadingSilenceMs
 * @property {number} trailingSilenceMs
 * @property {boolean} valid
 * @property {string | null} error
 */

/**
 * @param {string} filePath
 * @returns {Promise<AudioAnalysis>}
 */
export async function analyzeAudio(filePath) {
  const filename = path.basename(filePath);
  const base = {
    filename,
    duration: null,
    sampleRate: null,
    channels: null,
    lufs: null,
    rmsDbfs: null,
    peakDbfs: null,
    truePeakDbfs: null,
    clippingCount: 0,
    clippingPercentage: 0,
    leadingSilenceMs: 0,
    trailingSilenceMs: 0,
    valid: false,
    error: null,
  };

  try {
    const probe = probeFile(filePath);
    if (!probe.valid) {
      return { ...base, error: probe.error ?? 'Invalid audio file' };
    }

    const loudness = measureLoudness(filePath);
    const stats = measureStats(filePath);
    const silence = measureSilence(filePath, probe.duration ?? 0);

    return {
      filename,
      duration: probe.duration,
      sampleRate: probe.sampleRate,
      channels: probe.channels,
      lufs: loudness.lufs,
      rmsDbfs: stats.rmsDbfs,
      peakDbfs: stats.peakDbfs,
      truePeakDbfs: loudness.truePeakDbfs ?? stats.truePeakDbfs,
      clippingCount: stats.clippingCount,
      clippingPercentage: stats.clippingPercentage,
      leadingSilenceMs: silence.leadingSilenceMs,
      trailingSilenceMs: silence.trailingSilenceMs,
      valid: true,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ...base, error: message };
  }
}

/**
 * @param {string} filePath
 */
function probeFile(filePath) {
  const result = runFfprobe([
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);

  if (result.status !== 0) {
    return { valid: false, error: result.stderr.trim() || 'ffprobe failed' };
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    return { valid: false, error: 'Unable to parse ffprobe output' };
  }

  const audioStream = (payload.streams ?? []).find(
    (stream) => stream.codec_type === 'audio'
  );

  if (!audioStream) {
    return { valid: false, error: 'No audio stream found' };
  }

  const duration = parseNumber(payload.format?.duration);
  const sampleRate = parseIntSafe(audioStream.sample_rate);
  const channels = parseIntSafe(audioStream.channels);

  if (duration === null || duration <= 0) {
    return { valid: false, error: 'Missing or zero duration' };
  }

  return {
    valid: true,
    duration,
    sampleRate,
    channels,
    error: null,
  };
}

/**
 * @param {string} filePath
 */
function measureLoudness(filePath) {
  const result = runFfmpeg([
    '-hide_banner',
    '-nostats',
    '-i',
    filePath,
    '-af',
    'loudnorm=print_format=json',
    '-f',
    'null',
    '-',
  ]);

  const json = extractJsonFromOutput(`${result.stdout}\n${result.stderr}`);

  return {
    lufs: parseNumber(json?.input_i),
    truePeakDbfs: parseNumber(json?.input_tp),
  };
}

/**
 * @param {string} filePath
 */
function measureStats(filePath) {
  const result = runFfmpeg([
    '-hide_banner',
    '-nostats',
    '-i',
    filePath,
    '-af',
    'astats=metadata=1:reset=1',
    '-f',
    'null',
    '-',
  ]);

  const output = `${result.stdout}\n${result.stderr}`;
  const rmsDbfs = parseTaggedNumber(output, 'RMS level dB');
  const peakDbfs = parseTaggedNumber(output, 'Peak level dB');
  const truePeakDbfs = parseTaggedNumber(output, 'Max level dB');
  const clippingCount = parseTaggedInt(output, 'Number of clip events') ?? 0;
  const clippingPercentage =
    parseTaggedNumber(output, 'Clip percentage') ?? 0;

  return {
    rmsDbfs,
    peakDbfs,
    truePeakDbfs,
    clippingCount,
    clippingPercentage,
  };
}

/**
 * @param {string} filePath
 * @param {number} durationSec
 */
function measureSilence(filePath, durationSec) {
  const { silenceNoiseDb, silenceMinDurationSec } = QC_THRESHOLDS;

  const result = runFfmpeg([
    '-hide_banner',
    '-nostats',
    '-i',
    filePath,
    '-af',
    `silencedetect=noise=${silenceNoiseDb}dB:d=${silenceMinDurationSec}`,
    '-f',
    'null',
    '-',
  ]);

  const output = `${result.stdout}\n${result.stderr}`;
  const starts = [...output.matchAll(/silence_start:\s*([0-9.+-eE]+)/g)].map(
    (match) => parseFloat(match[1])
  );
  const ends = [...output.matchAll(/silence_end:\s*([0-9.+-eE]+)/g)].map(
    (match) => parseFloat(match[1])
  );

  let leadingSilenceMs = 0;
  let trailingSilenceMs = 0;

  if (starts.length > 0 && starts[0] <= 0.001) {
    const end = ends[0];
    leadingSilenceMs = end != null ? Math.round(end * 1000) : 0;
  }

  if (starts.length > 0) {
    const lastStart = starts[starts.length - 1];
    if (durationSec > 0 && lastStart < durationSec) {
      trailingSilenceMs = Math.round((durationSec - lastStart) * 1000);
    }
  }

  return { leadingSilenceMs, trailingSilenceMs };
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parseNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parseIntSafe(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = parseInt(String(value), 10);
  return Number.isFinite(num) ? num : null;
}

/**
 * @param {string} text
 * @param {string} label
 * @returns {number | null}
 */
function parseTaggedNumber(text, label) {
  const regex = new RegExp(`${escapeRegex(label)}:\\s*(-?[0-9.+-eE]+|inf|-inf)`);
  const match = text.match(regex);
  if (!match) {
    return null;
  }
  if (match[1] === 'inf' || match[1] === '-inf') {
    return null;
  }
  return parseNumber(match[1]);
}

/**
 * @param {string} text
 * @param {string} label
 * @returns {number | null}
 */
function parseTaggedInt(text, label) {
  const regex = new RegExp(`${escapeRegex(label)}:\\s*(\\d+)`);
  const match = text.match(regex);
  if (!match) {
    return null;
  }
  return parseInt(match[1], 10);
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
