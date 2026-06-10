import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import {
  buildOutputPath,
  discoverWavFiles,
  ensureFolder,
} from '../src/fileUtils.js';
import { makeTempDir, removeDir, writeTestWav } from './helpers/wav.js';

test('discoverWavFiles finds and sorts WAV files only', async () => {
  const dir = await makeTempDir('discover-');
  try {
    await writeTestWav({ filePath: path.join(dir, 'beta.wav') });
    await writeTestWav({ filePath: path.join(dir, 'alpha.wav') });
    await fs.writeFile(path.join(dir, 'notes.txt'), 'ignore me');
    await fs.writeFile(path.join(dir, 'ignore.mp3'), 'ignore me');

    const files = await discoverWavFiles(dir);
    assert.deepEqual(
      files.map((file) => path.basename(file)),
      ['alpha.wav', 'beta.wav']
    );
  } finally {
    await removeDir(dir);
  }
});

test('discoverWavFiles throws for missing folder', async () => {
  await assert.rejects(
    () => discoverWavFiles('/tmp/lufs-buff-missing-folder-xyz'),
    /Input folder does not exist/
  );
});

test('ensureFolder creates nested directories', async () => {
  const dir = await makeTempDir('ensure-');
  const nested = path.join(dir, 'a', 'b', 'c');
  try {
    await ensureFolder(nested);
    const stat = await fs.stat(nested);
    assert.ok(stat.isDirectory());
  } finally {
    await removeDir(dir);
  }
});

test('buildOutputPath preserves filename', () => {
  const output = buildOutputPath('/raw/clip.wav', '/normalized');
  assert.equal(output, path.join('/normalized', 'clip.wav'));
});
