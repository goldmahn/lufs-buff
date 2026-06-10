import { spawnSync } from 'node:child_process';

export class FfmpegNotFoundError extends Error {
  constructor() {
    super(
      'FFmpeg is not installed or not available on PATH. Install FFmpeg to use LUFS Buff.'
    );
    this.name = 'FfmpegNotFoundError';
  }
}

/**
 * @returns {void}
 */
export function assertFfmpegAvailable() {
  const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  const ffprobe = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });

  if (ffmpeg.error?.code === 'ENOENT' || ffprobe.error?.code === 'ENOENT') {
    throw new FfmpegNotFoundError();
  }

  if (ffmpeg.status !== 0 || ffprobe.status !== 0) {
    throw new Error('FFmpeg or ffprobe failed to run. Verify your installation.');
  }
}

/**
 * @param {string[]} args
 * @returns {{ stdout: string, stderr: string, status: number | null }}
 */
export function runFfmpeg(args) {
  const result = spawnSync('ffmpeg', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error?.code === 'ENOENT') {
    throw new FfmpegNotFoundError();
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

/**
 * @param {string[]} args
 * @returns {{ stdout: string, stderr: string, status: number | null }}
 */
export function runFfprobe(args) {
  const result = spawnSync('ffprobe', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error?.code === 'ENOENT') {
    throw new FfmpegNotFoundError();
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

/**
 * @param {string} filePath
 * @returns {{ sampleRate: number, channels: number }}
 */
export function probeAudioFormat(filePath) {
  const result = runFfprobe([
    '-v',
    'quiet',
    '-select_streams',
    'a:0',
    '-show_entries',
    'stream=sample_rate,channels',
    '-of',
    'json',
    filePath,
  ]);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Failed to probe audio format for ${filePath}`);
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Unable to parse ffprobe output for ${filePath}`);
  }

  const stream = payload.streams?.[0];
  const sampleRate = parseInt(String(stream?.sample_rate ?? ''), 10);
  const channels = parseInt(String(stream?.channels ?? ''), 10);

  if (!Number.isFinite(sampleRate) || !Number.isFinite(channels)) {
    throw new Error(`Missing sample rate or channel count for ${filePath}`);
  }

  return { sampleRate, channels };
}

/**
 * Extract the last JSON object from FFmpeg stderr output.
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
export function extractJsonFromOutput(text) {
  const matches = text.match(/\{[\s\S]*?\}/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  for (let i = matches.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(matches[i]);
    } catch {
      // try previous match
    }
  }

  return null;
}
