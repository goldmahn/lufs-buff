import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import {
  appendProcessing,
  enrichReportEntry,
  manifestReportContext,
  readManifest,
  writeManifest,
} from '../src/manifestUtils.js';

test('appendProcessing preserves existing stages', () => {
  const manifest = {
    processing: {
      voiceclipper: { version: '0.5.0' },
    },
  };

  const updated = appendProcessing(manifest, 'lufs_buff', {
    version: '1.0.0',
    target_lufs: -23,
  });

  assert.deepEqual(updated.processing.voiceclipper, { version: '0.5.0' });
  assert.equal(updated.processing.lufs_buff.target_lufs, -23);
});

test('enrichReportEntry attaches clip metadata from manifest', () => {
  const manifest = {
    clips: [
      {
        filename: 'close_the_door.wav',
        clip_id: 'session_001_000001',
        phrase_id: 'close_the_door',
        content_metadata: { emotion: 'tense' },
      },
    ],
  };

  const entry = enrichReportEntry({ filename: 'close_the_door.wav', status: 'PASS' }, manifest);

  assert.equal(entry.clip_id, 'session_001_000001');
  assert.equal(entry.content_metadata.emotion, 'tense');
});

test('manifest round trip', async (t) => {
  const dir = path.join(process.cwd(), 'tests', '.tmp', 'manifest-utils');
  await fs.mkdir(dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const manifest = {
    schema_version: 2,
    session: { session_id: 'session_001' },
    speaker: { speaker_id: 'speaker_test' },
    processing: {},
  };

  await writeManifest(manifestPath, manifest);
  const loaded = await readManifest(manifestPath);
  assert.deepEqual(manifestReportContext(loaded).session, { session_id: 'session_001' });
});
