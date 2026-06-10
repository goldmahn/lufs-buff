import { DEFAULTS } from './config.js';
import {
  extractJsonFromOutput,
  probeAudioFormat,
  runFfmpeg,
} from './ffmpegUtils.js';

/**
 * @typedef {Object} LoudnormMeasurement
 * @property {number} measuredI
 * @property {number} measuredTP
 * @property {number} measuredLRA
 * @property {number} measuredThreshold
 * @property {number} offset
 */

/**
 * Measure loudness using FFmpeg loudnorm (pass 1).
 * @param {string} inputPath
 * @param {number} [targetLufs]
 * @returns {LoudnormMeasurement}
 */
export function measureForNormalization(inputPath, targetLufs = DEFAULTS.targetLufs) {
  const result = runFfmpeg([
    '-hide_banner',
    '-nostats',
    '-i',
    inputPath,
    '-af',
    `loudnorm=I=${targetLufs}:TP=${DEFAULTS.truePeakLimit}:LRA=${DEFAULTS.lra}:print_format=json`,
    '-f',
    'null',
    '-',
  ]);

  const json = extractJsonFromOutput(`${result.stdout}\n${result.stderr}`);
  if (!json) {
    throw new Error(`Failed to measure loudness for ${inputPath}`);
  }

  const measuredI = requireNumber(json.input_i, 'input_i');
  const measuredTP = requireNumber(json.input_tp, 'input_tp');
  const measuredLRA = requireNumber(json.input_lra, 'input_lra');
  const measuredThreshold = requireNumber(json.input_thresh, 'input_thresh');
  const offset = requireNumber(json.target_offset, 'target_offset');

  return {
    measuredI,
    measuredTP,
    measuredLRA,
    measuredThreshold,
    offset,
  };
}

/**
 * Two-pass loudness normalization with FFmpeg loudnorm.
 * @param {Object} options
 * @param {string} options.inputPath
 * @param {string} options.outputPath
 * @param {number} options.targetLufs
 * @param {LoudnormMeasurement} [options.measurement]
 */
export function normalizeAudio({
  inputPath,
  outputPath,
  targetLufs,
  measurement,
}) {
  const measured = measurement ?? measureForNormalization(inputPath, targetLufs);
  const { sampleRate, channels } = probeAudioFormat(inputPath);

  const filter = [
    `loudnorm=I=${targetLufs}`,
    `TP=${DEFAULTS.truePeakLimit}`,
    `LRA=${DEFAULTS.lra}`,
    `measured_I=${measured.measuredI}`,
    `measured_TP=${measured.measuredTP}`,
    `measured_LRA=${measured.measuredLRA}`,
    `measured_thresh=${measured.measuredThreshold}`,
    `offset=${measured.offset}`,
    'linear=true',
  ].join(':');

  const result = runFfmpeg([
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    inputPath,
    '-af',
    filter,
    '-ar',
    String(sampleRate),
    '-ac',
    String(channels),
    '-c:a',
    'pcm_s16le',
    outputPath,
  ]);

  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() || `Normalization failed for ${inputPath}`
    );
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireNumber(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Missing loudnorm measurement field: ${field}`);
  }
  return num;
}
