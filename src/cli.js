#!/usr/bin/env node

import path from 'node:path';
import { DEFAULTS } from './config.js';
import { FfmpegNotFoundError } from './ffmpegUtils.js';
import { processCorpus } from './processCorpus.js';

function printHelp() {
  console.log(`LUFS Buff — loudness normalization and QC for Corpus Voces

Usage:
  lufs-buff <inputFolder> <outputFolder> [options]

Options:
  --target <lufs>     Target integrated loudness (default: ${DEFAULTS.targetLufs})
  --report <folder>   Report output folder (default: ../reports relative to output)
  --dry-run           Analyze and report without writing normalized files
  --report-only       Analyze and report only (alias for dry-run semantics)
  --help, -h          Show this help message

Examples:
  lufs-buff ./raw_clips ./normalized_clips
  lufs-buff ./raw_clips ./normalized_clips --target -20
  lufs-buff ./raw_clips ./normalized_clips --dry-run
  lufs-buff ./raw_clips ./normalized_clips --report-only --report ./reports
`);
}

/**
 * @param {string[]} argv
 */
export function parseCliArgs(argv) {
  const positional = [];
  let targetLufs = DEFAULTS.targetLufs;
  let reportFolder;
  let dryRun = false;
  let reportOnly = false;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--report-only') {
      reportOnly = true;
      continue;
    }

    if (arg === '--target') {
      const value = argv[i + 1];
      if (value === undefined) {
        throw new Error('Missing value for --target');
      }
      targetLufs = Number(value);
      if (!Number.isFinite(targetLufs)) {
        throw new Error(`Invalid --target value: ${value}`);
      }
      i += 1;
      continue;
    }

    if (arg === '--report') {
      const value = argv[i + 1];
      if (value === undefined) {
        throw new Error('Missing value for --report');
      }
      reportFolder = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  if (help) {
    return { help: true };
  }

  if (positional.length < 2) {
    throw new Error('Input and output folders are required.');
  }

  const [inputFolder, outputFolder] = positional;

  return {
    help: false,
    inputFolder,
    outputFolder,
    reportFolder:
      reportFolder ?? path.join(path.dirname(path.resolve(outputFolder)), 'reports'),
    targetLufs,
    dryRun: dryRun || reportOnly,
    reportOnly,
  };
}

async function main() {
  try {
    const args = parseCliArgs(process.argv.slice(2));

    if (args.help) {
      printHelp();
      return;
    }

    const result = await processCorpus(args);

    console.log(`Processed ${result.clips.length} clip(s).`);
    console.log(
      `Summary: PASS=${result.summary.pass}, REVIEW=${result.summary.review}, REJECT=${result.summary.reject}`
    );

    if (result.dryRun) {
      console.log('Dry run complete — no normalized files were written.');
    }

    if (result.failures.length > 0) {
      console.error('\nFailures:');
      for (const failure of result.failures) {
        console.error(`  - ${failure}`);
      }
      process.exitCode = 1;
    }
  } catch (err) {
    if (err instanceof FfmpegNotFoundError) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }

    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedPath === cliPath) {
  main();
}
