import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Create a minimal mono PCM WAV file for tests.
 * @param {Object} options
 * @param {string} options.filePath
 * @param {number} [options.sampleRate]
 * @param {number} [options.durationSec]
 * @param {number} [options.amplitude]
 * @param {number} [options.frequencyHz]
 */
export async function writeTestWav({
  filePath,
  sampleRate = 44100,
  durationSec = 0.5,
  amplitude = 8000,
  frequencyHz = 440,
}) {
  const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
  const data = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i += 1) {
    const sample =
      Math.round(
        amplitude * Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate)
      ) || 0;
    data.writeInt16LE(clamp16(sample), i * 2);
  }

  const header = createWavHeader({
    sampleRate,
    channels: 1,
    dataSize: data.length,
  });

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.concat([header, data]));
}

/**
 * @param {Object} options
 * @param {number} options.sampleRate
 * @param {number} options.channels
 * @param {number} options.dataSize
 * @returns {Buffer}
 */
function createWavHeader({ sampleRate, channels, dataSize }) {
  const blockAlign = channels * 2;
  const byteRate = sampleRate * blockAlign;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

/**
 * @param {number} value
 * @returns {number}
 */
function clamp16(value) {
  return Math.max(-32768, Math.min(32767, value));
}

/**
 * @param {string} prefix
 * @returns {Promise<string>}
 */
export async function makeTempDir(prefix) {
  const root = path.join(process.cwd(), 'tests', '.tmp');
  await fs.mkdir(root, { recursive: true });
  return fs.mkdtemp(path.join(root, prefix));
}

/**
 * @param {string} dir
 */
export async function removeDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}
