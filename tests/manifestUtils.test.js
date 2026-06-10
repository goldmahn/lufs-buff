import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import {
  appendProcessing,
  applyClipQc,
  buildStageManifest,
  cloneManifest,
  enrichReportEntry,
  manifestReportContext,
  readManifest,
  resolveStageManifestPath,
  writeManifest,
} from '../src/manifestUtils.js';
import { voiceclipperManifest } from './fixtures/voiceclipperManifest.js';

test('cloneManifest preserves speaker and session metadata', () => {
  const clone = cloneManifest(voiceclipperManifest);
  clone.speaker.speaker_name = 'Changed';

  assert.equal(voiceclipperManifest.speaker.speaker_name, 'Ariel Goldman');
  assert.equal(clone.session.session_id, 'session_001');
});

test('appendProcessing preserves prior Voiceclipper processing metadata', () => {
  const updated = appendProcessing(voiceclipperManifest, 'lufs_buff', {
    version: '1.0.0',
    target_lufs: -23,
  });

  assert.equal(updated.processing.voiceclipper.version, '0.5.0');
  assert.equal(updated.processing.lufs_buff.target_lufs, -23);
});

test('applyClipQc preserves clip content metadata and adds stage QC', () => {
  const updated = applyClipQc(voiceclipperManifest, [
    {
      filename: 'close_the_door.wav',
      status: 'REVIEW',
      notes: ['Peak near clipping'],
      lufs: -23.1,
      peakDbfs: -1.2,
    },
  ]);

  const clip = updated.clips[0];
  assert.equal(clip.content_metadata.emotion, 'tense');
  assert.equal(clip.qc.lufs_buff.status, 'REVIEW');
  assert.equal(clip.qc.lufs_buff.lufs, -23.1);
  assert.equal(updated.clips[1].content_metadata.emotion, 'guarded');
  assert.equal(updated.clips[1].qc, undefined);
});

test('buildStageManifest outputs downstream manifest with QC summary', () => {
  const stageManifest = buildStageManifest({
    manifest: voiceclipperManifest,
    qcEntries: [
      {
        filename: 'close_the_door.wav',
        status: 'PASS',
        notes: [],
        lufs: -23,
      },
    ],
    qcSummary: { total: 1, pass: 1, review: 0, reject: 0 },
    processingData: {
      version: '1.0.0',
      target_lufs: -23,
      completed_at: '2026-06-10T21:00:00.000Z',
    },
    sourceManifestPath: '/tmp/session/manifest.json',
  });

  assert.equal(stageManifest.speaker.speaker_id, 'speaker_ariel_001');
  assert.equal(stageManifest.session.recording_location_type, 'home office');
  assert.equal(stageManifest.processing.lufs_buff.version, '1.0.0');
  assert.deepEqual(stageManifest.qc_summary.lufs_buff, {
    total: 1,
    pass: 1,
    review: 0,
    reject: 0,
  });
  assert.equal(stageManifest.lineage.source_manifest, '/tmp/session/manifest.json');
});

test('enrichReportEntry attaches clip metadata from Voiceclipper manifest', () => {
  const entry = enrichReportEntry(
    { filename: 'close_the_door.wav', status: 'PASS' },
    voiceclipperManifest
  );

  assert.equal(entry.clip_id, 'session_001_000001');
  assert.equal(entry.content_metadata.emotion, 'tense');
});

test('resolveStageManifestPath uses reports folder', () => {
  assert.equal(
    resolveStageManifestPath('/tmp/reports'),
    path.join('/tmp/reports', 'manifest.lufs-buff.json')
  );
});

test('writes stage manifest without modifying source fixture', async (t) => {
  const dir = path.join(process.cwd(), 'tests', '.tmp', 'stage-manifest');
  const sourcePath = path.join(dir, 'manifest.json');
  const stagePath = resolveStageManifestPath(dir);
  await fs.mkdir(dir, { recursive: true });
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  await writeManifest(sourcePath, voiceclipperManifest);
  const stageManifest = buildStageManifest({
    manifest: voiceclipperManifest,
    qcEntries: [],
    qcSummary: { total: 0, pass: 0, review: 0, reject: 0 },
    processingData: { version: '1.0.0', target_lufs: -23 },
    sourceManifestPath: sourcePath,
  });
  await writeManifest(stagePath, stageManifest);

  const sourceAfter = await readManifest(sourcePath);
  const stageAfter = await readManifest(stagePath);

  assert.equal(sourceAfter.processing.lufs_buff, undefined);
  assert.equal(stageAfter.processing.lufs_buff.version, '1.0.0');
  assert.deepEqual(manifestReportContext(stageAfter).speaker, voiceclipperManifest.speaker);
});
