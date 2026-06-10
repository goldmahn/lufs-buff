import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import {
  entriesToCsv,
  escapeCsvField,
  formatCsvValue,
  writeReports,
} from '../src/writeReports.js';
import { makeTempDir, removeDir } from './helpers/wav.js';

test('entriesToCsv renders header and rows', () => {
  const csv = entriesToCsv([
    {
      filename: 'clip.wav',
      duration: 1.2,
      sampleRate: 44100,
      channels: 1,
      lufs: -23,
      rmsDbfs: -21,
      peakDbfs: -2,
      truePeakDbfs: -1.8,
      clippingCount: 0,
      clippingPercentage: 0,
      leadingSilenceMs: 50,
      trailingSilenceMs: 60,
      status: 'PASS',
      notes: [],
    },
  ]);

  assert.match(csv, /^filename,duration,sampleRate/);
  assert.match(csv, /clip\.wav,1\.2,44100,1,-23/);
});

test('formatCsvValue escapes notes arrays and quotes', () => {
  assert.equal(formatCsvValue(['Near clipping', 'Quiet']), 'Near clipping; Quiet');
  assert.equal(escapeCsvField('value,with,comma'), '"value,with,comma"');
});

test('writeReports creates JSON and CSV files', async () => {
  const dir = await makeTempDir('reports-');
  try {
    const report = await writeReports({
      reportFolder: dir,
      targetLufs: -23,
      entries: [
        {
          filename: 'a.wav',
          duration: 1,
          sampleRate: 44100,
          channels: 1,
          lufs: -23,
          rmsDbfs: -24,
          peakDbfs: -3,
          truePeakDbfs: -2.5,
          clippingCount: 0,
          clippingPercentage: 0,
          leadingSilenceMs: 10,
          trailingSilenceMs: 10,
          status: 'PASS',
          notes: [],
        },
      ],
    });

    assert.equal(report.summary.total, 1);
    assert.equal(report.summary.pass, 1);

    const json = JSON.parse(await fs.readFile(path.join(dir, 'qc-report.json'), 'utf8'));
    const csv = await fs.readFile(path.join(dir, 'qc-report.csv'), 'utf8');

    assert.equal(json.clips[0].filename, 'a.wav');
    assert.match(csv, /a\.wav/);
  } finally {
    await removeDir(dir);
  }
});
