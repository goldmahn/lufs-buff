import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { processCorpus } from '../src/processCorpus.js';
import { readManifest, resolveStageManifestPath } from '../src/manifestUtils.js';
import { voiceclipperManifest } from './fixtures/voiceclipperManifest.js';
import { makeTempDir, removeDir, writeTestWav } from './helpers/wav.js';

test('processCorpus writes stage manifest and preserves source manifest by default', async () => {
  const root = await makeTempDir('manifest-process-');
  const inputDir = path.join(root, 'clips');
  const outputDir = path.join(root, 'normalized');
  const reportDir = path.join(root, 'reports');
  const sourceManifestPath = path.join(root, 'manifest.json');

  try {
    await fs.mkdir(inputDir, { recursive: true });
    await writeTestWav({ filePath: path.join(inputDir, 'close_the_door.wav') });
    await fs.writeFile(sourceManifestPath, `${JSON.stringify(voiceclipperManifest, null, 2)}\n`);

    const analyzeFn = async () => ({
      filename: 'close_the_door.wav',
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
    });

    const result = await processCorpus({
      inputFolder: inputDir,
      outputFolder: outputDir,
      reportFolder: reportDir,
      manifestPath: sourceManifestPath,
      dryRun: true,
      analyzeFn,
      normalizeFn: () => {},
    });

    const sourceAfter = await readManifest(sourceManifestPath);
    const stageAfter = await readManifest(resolveStageManifestPath(reportDir));

    assert.equal(result.stageManifestPath, resolveStageManifestPath(reportDir));
    assert.equal(sourceAfter.processing.lufs_buff, undefined);
    assert.equal(stageAfter.processing.lufs_buff.target_lufs, -23);
    assert.equal(stageAfter.clips[0].content_metadata.emotion, 'tense');
    assert.equal(stageAfter.clips[0].qc.lufs_buff.status, 'PASS');
  } finally {
    await removeDir(root);
  }
});

test('processCorpus can update source manifest when explicitly requested', async () => {
  const root = await makeTempDir('manifest-source-');
  const inputDir = path.join(root, 'clips');
  const outputDir = path.join(root, 'normalized');
  const reportDir = path.join(root, 'reports');
  const sourceManifestPath = path.join(root, 'manifest.json');

  try {
    await fs.mkdir(inputDir, { recursive: true });
    await writeTestWav({ filePath: path.join(inputDir, 'close_the_door.wav') });
    await fs.writeFile(sourceManifestPath, `${JSON.stringify(voiceclipperManifest, null, 2)}\n`);

    await processCorpus({
      inputFolder: inputDir,
      outputFolder: outputDir,
      reportFolder: reportDir,
      manifestPath: sourceManifestPath,
      writeSourceManifest: true,
      dryRun: true,
      analyzeFn: async () => ({
        filename: 'close_the_door.wav',
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
      normalizeFn: () => {},
    });

    const sourceAfter = await readManifest(sourceManifestPath);
    assert.equal(sourceAfter.processing.lufs_buff.target_lufs, -23);
  } finally {
    await removeDir(root);
  }
});
