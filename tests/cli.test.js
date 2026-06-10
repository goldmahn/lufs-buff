import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCliArgs } from '../src/cli.js';

test('parseCliArgs parses positional folders and defaults', () => {
  const args = parseCliArgs(['./raw_clips', './normalized_clips']);
  assert.equal(args.inputFolder, './raw_clips');
  assert.equal(args.outputFolder, './normalized_clips');
  assert.equal(args.targetLufs, -23);
  assert.equal(args.dryRun, false);
});

test('parseCliArgs supports target, report, and dry-run flags', () => {
  const args = parseCliArgs([
    './raw',
    './out',
    '--target',
    '-20',
    '--report',
    './reports',
    '--dry-run',
  ]);

  assert.equal(args.targetLufs, -20);
  assert.equal(args.reportFolder, './reports');
  assert.equal(args.dryRun, true);
});

test('parseCliArgs treats report-only as dry run', () => {
  const args = parseCliArgs(['./raw', './out', '--report-only']);
  assert.equal(args.reportOnly, true);
  assert.equal(args.dryRun, true);
});

test('parseCliArgs rejects unknown options', () => {
  assert.throws(
    () => parseCliArgs(['./raw', './out', '--unknown']),
    /Unknown option/
  );
});

test('parseCliArgs requires input and output folders', () => {
  assert.throws(() => parseCliArgs(['./raw']), /Input and output folders are required/);
});

test('parseCliArgs supports manifest and write-source-manifest flags', () => {
  const args = parseCliArgs([
    './raw',
    './out',
    '--manifest',
    './manifest.json',
    '--write-source-manifest',
  ]);

  assert.equal(args.manifestPath, './manifest.json');
  assert.equal(args.writeSourceManifest, true);
});
