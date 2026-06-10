import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { processCorpus } from '../src/processCorpus.js';
import { makeTempDir, removeDir, writeTestWav } from './helpers/wav.js';

function ffmpegAvailable() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return !result.error && result.status === 0;
}

test('integration: analyze and normalize real WAV clips with FFmpeg', async (t) => {
  if (!ffmpegAvailable()) {
    t.skip('FFmpeg is not available');
    return;
  }

  const root = await makeTempDir('integration-');
  const inputDir = path.join(root, 'raw_clips');
  const outputDir = path.join(root, 'normalized_clips');
  const reportDir = path.join(root, 'reports');

  try {
    await fs.mkdir(inputDir, { recursive: true });
    await writeTestWav({
      filePath: path.join(inputDir, 'phrase_one.wav'),
      durationSec: 0.75,
      amplitude: 6000,
    });
    await writeTestWav({
      filePath: path.join(inputDir, 'phrase_two.wav'),
      durationSec: 0.6,
      amplitude: 4000,
      frequencyHz: 220,
    });

    const result = await processCorpus({
      inputFolder: inputDir,
      outputFolder: outputDir,
      reportFolder: reportDir,
      targetLufs: -23,
    });

    assert.equal(result.clips.length, 2);
    assert.ok(result.summary.total === 2);

    for (const filename of ['phrase_one.wav', 'phrase_two.wav']) {
      await fs.access(path.join(outputDir, filename));
    }

    const report = JSON.parse(
      await fs.readFile(path.join(reportDir, 'qc-report.json'), 'utf8')
    );
    assert.equal(report.targetLufs, -23);
    assert.equal(report.clips.length, 2);

    const csv = await fs.readFile(path.join(reportDir, 'qc-report.csv'), 'utf8');
    assert.match(csv, /phrase_one\.wav/);
    assert.match(csv, /phrase_two\.wav/);
  } finally {
    await removeDir(root);
  }
});

test('integration: dry-run writes reports without normalized output', async (t) => {
  if (!ffmpegAvailable()) {
    t.skip('FFmpeg is not available');
    return;
  }

  const root = await makeTempDir('dryrun-');
  const inputDir = path.join(root, 'raw_clips');
  const outputDir = path.join(root, 'normalized_clips');
  const reportDir = path.join(root, 'reports');

  try {
    await fs.mkdir(inputDir, { recursive: true });
    await writeTestWav({ filePath: path.join(inputDir, 'clip.wav') });

    const result = await processCorpus({
      inputFolder: inputDir,
      outputFolder: outputDir,
      reportFolder: reportDir,
      dryRun: true,
    });

    assert.equal(result.dryRun, true);
    await fs.access(path.join(reportDir, 'qc-report.json'));

    await assert.rejects(async () => {
      await fs.access(path.join(outputDir, 'clip.wav'));
    });
  } finally {
    await removeDir(root);
  }
});
