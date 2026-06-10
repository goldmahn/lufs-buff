import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { processCorpus } from '../src/processCorpus.js';
import { makeTempDir, removeDir, writeTestWav } from './helpers/wav.js';

test('processCorpus skips invalid files and continues', async () => {
  const root = await makeTempDir('process-');
  const inputDir = path.join(root, 'raw');
  const outputDir = path.join(root, 'normalized');
  const reportDir = path.join(root, 'reports');

  try {
    await fs.mkdir(inputDir, { recursive: true });
    await writeTestWav({ filePath: path.join(inputDir, 'good.wav') });
    await fs.writeFile(path.join(inputDir, 'bad.wav'), 'not audio');

    const result = await processCorpus({
      inputFolder: inputDir,
      outputFolder: outputDir,
      reportFolder: reportDir,
      dryRun: true,
      analyzeFn: async (filePath) => {
        const filename = path.basename(filePath);
        if (filename === 'bad.wav') {
          return {
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
            error: 'Invalid audio file',
          };
        }

        return {
          filename,
          duration: 1,
          sampleRate: 44100,
          channels: 1,
          lufs: -23,
          rmsDbfs: -24,
          peakDbfs: -3,
          truePeakDbfs: -2.5,
          clippingCount: 0,
          clippingPercentage: 0,
          leadingSilenceMs: 50,
          trailingSilenceMs: 50,
          valid: true,
          error: null,
        };
      },
    });

    assert.equal(result.clips.length, 2);
    assert.equal(result.summary.pass, 1);
    assert.equal(result.summary.reject, 1);

    const report = JSON.parse(
      await fs.readFile(path.join(reportDir, 'qc-report.json'), 'utf8')
    );
    assert.equal(report.clips.length, 2);
  } finally {
    await removeDir(root);
  }
});

test('processCorpus preserves filenames in dry-run output planning', async () => {
  const root = await makeTempDir('names-');
  const inputDir = path.join(root, 'raw');
  const outputDir = path.join(root, 'normalized');
  const reportDir = path.join(root, 'reports');

  try {
    await fs.mkdir(inputDir, { recursive: true });
    await writeTestWav({ filePath: path.join(inputDir, 'dangerous_mistake.wav') });

    let normalizedArgs;
    const result = await processCorpus({
      inputFolder: inputDir,
      outputFolder: outputDir,
      reportFolder: reportDir,
      analyzeFn: async (filePath) => ({
        filename: path.basename(filePath),
        duration: 1,
        sampleRate: 44100,
        channels: 1,
        lufs: -23,
        rmsDbfs: -24,
        peakDbfs: -3,
        truePeakDbfs: -2.5,
        clippingCount: 0,
        clippingPercentage: 0,
        leadingSilenceMs: 50,
        trailingSilenceMs: 50,
        valid: true,
        error: null,
      }),
      normalizeFn: (args) => {
        normalizedArgs = args;
      },
    });

    assert.equal(result.clips[0].filename, 'dangerous_mistake.wav');
    assert.equal(path.basename(normalizedArgs.outputPath), 'dangerous_mistake.wav');
    assert.equal(normalizedArgs.inputPath, path.join(inputDir, 'dangerous_mistake.wav'));
  } finally {
    await removeDir(root);
  }
});
