import path from 'node:path';
import { analyzeAudio } from './analyzeAudio.js';
import { DEFAULTS } from './config.js';
import {
  buildOutputPath,
  discoverWavFiles,
  ensureFolder,
} from './fileUtils.js';
import { assertFfmpegAvailable } from './ffmpegUtils.js';
import {
  PACKAGE_VERSION,
  buildStageManifest,
  enrichReportEntry,
  manifestReportContext,
  readManifest,
  resolveStageManifestPath,
  writeManifest,
} from './manifestUtils.js';
import { normalizeAudio } from './normalizeAudio.js';
import { buildReportEntry, classifyClip } from './qcRules.js';
import { writeReports } from './writeReports.js';

/**
 * @typedef {Object} ProcessCorpusOptions
 * @property {string} inputFolder
 * @property {string} outputFolder
 * @property {string} [reportFolder]
 * @property {number} [targetLufs]
 * @property {string} [manifestPath]
 * @property {boolean} [writeSourceManifest]
 * @property {boolean} [dryRun]
 * @property {boolean} [reportOnly]
 * @property {typeof analyzeAudio} [analyzeFn]
 * @property {typeof normalizeAudio} [normalizeFn]
 */

/**
 * @typedef {Object} ProcessCorpusResult
 * @property {Record<string, unknown>[]} clips
 * @property {Record<string, number>} summary
 * @property {string[]} failures
 * @property {boolean} dryRun
 * @property {boolean} reportOnly
 * @property {string | null} stageManifestPath
 */

/**
 * Process a folder of raw WAV clips: analyze, normalize, and report.
 * @param {ProcessCorpusOptions} options
 * @returns {Promise<ProcessCorpusResult>}
 */
export async function processCorpus(options) {
  const {
    inputFolder,
    outputFolder,
    reportFolder = path.join(path.dirname(outputFolder), 'reports'),
    targetLufs = DEFAULTS.targetLufs,
    dryRun = false,
    reportOnly = false,
    manifestPath,
    writeSourceManifest = false,
    analyzeFn = analyzeAudio,
    normalizeFn = normalizeAudio,
  } = options;

  assertFfmpegAvailable();

  const inputDir = path.resolve(inputFolder);
  const outputDir = path.resolve(outputFolder);
  const reportDir = path.resolve(reportFolder);

  let manifest = null;
  if (manifestPath) {
    manifest = await readManifest(path.resolve(manifestPath));
  }

  const wavFiles = await discoverWavFiles(inputDir);
  const failures = [];
  const entries = [];

  if (!dryRun && !reportOnly) {
    await ensureFolder(outputDir);
  }
  await ensureFolder(reportDir);

  for (const filePath of wavFiles) {
    const filename = path.basename(filePath);

    try {
      const analysis = await analyzeFn(filePath);
      const qc = classifyClip(analysis);
      const entry = buildReportEntry(analysis, qc);
      entries.push(manifest ? enrichReportEntry(entry, manifest) : entry);

      if (reportOnly || dryRun || !analysis.valid) {
        continue;
      }

      try {
        const outputPath = buildOutputPath(filePath, outputDir);
        normalizeFn({
          inputPath: filePath,
          outputPath,
          targetLufs,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push(`${filename}: ${message}`);
        entry.status = 'REJECT';
        entry.notes = [...(entry.notes ?? []), 'Normalization failed'];
        entry.error = message;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${filename}: ${message}`);
      entries.push({
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
        status: 'REJECT',
        notes: ['Processing failed'],
        error: message,
      });
    }
  }

  const report = await writeReports({
    reportFolder: reportDir,
    targetLufs,
    entries,
    manifestContext: manifest ? manifestReportContext(manifest) : null,
  });

  let stageManifestPath = null;
  if (manifest) {
    const resolvedSourceManifest = manifestPath ? path.resolve(manifestPath) : null;
    const stageManifest = buildStageManifest({
      manifest,
      qcEntries: entries,
      qcSummary: report.summary,
      processingData: {
        version: PACKAGE_VERSION,
        target_lufs: targetLufs,
        completed_at: new Date().toISOString(),
      },
      sourceManifestPath: resolvedSourceManifest ?? undefined,
    });

    stageManifestPath = resolveStageManifestPath(reportDir);
    await writeManifest(stageManifestPath, stageManifest);

    if (writeSourceManifest && resolvedSourceManifest) {
      await writeManifest(resolvedSourceManifest, stageManifest);
    }
  }

  return {
    clips: entries,
    summary: report.summary,
    failures,
    dryRun,
    reportOnly,
    stageManifestPath,
  };
}
