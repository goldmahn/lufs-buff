import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
);

export const PACKAGE_VERSION = packageJson.version;
export const STAGE_MANIFEST_FILENAME = 'manifest.lufs-buff.json';
export const STAGE_KEY = 'lufs_buff';

/**
 * @param {string} manifestPath
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readManifest(manifestPath) {
  const text = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(text);
}

/**
 * @param {string} manifestPath
 * @param {Record<string, unknown>} manifest
 */
export async function writeManifest(manifestPath, manifest) {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

/**
 * @param {Record<string, unknown>} manifest
 * @returns {Record<string, unknown>}
 */
export function cloneManifest(manifest) {
  return JSON.parse(JSON.stringify(manifest));
}

/**
 * @param {string} reportFolder
 * @returns {string}
 */
export function resolveStageManifestPath(reportFolder) {
  return path.join(reportFolder, STAGE_MANIFEST_FILENAME);
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {string} stage
 * @param {Record<string, unknown>} data
 * @returns {Record<string, unknown>}
 */
export function appendProcessing(manifest, stage, data) {
  const processing =
    manifest.processing && typeof manifest.processing === 'object'
      ? { .../** @type {Record<string, unknown>} */ (manifest.processing) }
      : {};

  processing[stage] = data;
  return { ...manifest, processing };
}

/**
 * @param {Record<string, unknown>} manifest
 * @returns {Record<string, unknown>}
 */
export function manifestReportContext(manifest) {
  return {
    schema_version: manifest.schema_version ?? manifest.manifest_version ?? null,
    session: manifest.session ?? null,
    speaker: manifest.speaker ?? null,
    processing: manifest.processing ?? null,
  };
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {string} filename
 * @returns {Record<string, unknown> | null}
 */
export function findManifestClip(manifest, filename) {
  const clips = manifest.clips;
  if (!Array.isArray(clips)) {
    return null;
  }

  return (
    clips.find(
      (clip) =>
        clip &&
        typeof clip === 'object' &&
        /** @type {Record<string, unknown>} */ (clip).filename === filename
    ) ?? null
  );
}

/**
 * @param {Record<string, unknown>} entry
 * @param {Record<string, unknown>} manifest
 * @returns {Record<string, unknown>}
 */
export function enrichReportEntry(entry, manifest) {
  const clip = findManifestClip(manifest, String(entry.filename ?? ''));
  if (!clip || typeof clip !== 'object') {
    return entry;
  }

  const clipRecord = /** @type {Record<string, unknown>} */ (clip);
  return {
    ...entry,
    clip_id: clipRecord.clip_id ?? null,
    phrase_id: clipRecord.phrase_id ?? null,
    phrase_text: clipRecord.phrase_text ?? null,
    content_metadata: clipRecord.content_metadata ?? null,
  };
}

/**
 * @param {Record<string, unknown>} qcEntry
 * @returns {Record<string, unknown>}
 */
export function pickLufsBuffQcFields(qcEntry) {
  return {
    status: qcEntry.status ?? null,
    notes: qcEntry.notes ?? [],
    lufs: qcEntry.lufs ?? null,
    rmsDbfs: qcEntry.rmsDbfs ?? null,
    peakDbfs: qcEntry.peakDbfs ?? null,
    truePeakDbfs: qcEntry.truePeakDbfs ?? null,
    clippingCount: qcEntry.clippingCount ?? null,
    clippingPercentage: qcEntry.clippingPercentage ?? null,
    leadingSilenceMs: qcEntry.leadingSilenceMs ?? null,
    trailingSilenceMs: qcEntry.trailingSilenceMs ?? null,
    error: qcEntry.error ?? null,
  };
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {Record<string, unknown>[]} qcEntries
 * @returns {Record<string, unknown>}
 */
export function applyClipQc(manifest, qcEntries) {
  const updated = cloneManifest(manifest);
  const byFilename = new Map(
    qcEntries.map((entry) => [String(entry.filename ?? ''), entry])
  );

  updated.clips = (Array.isArray(updated.clips) ? updated.clips : []).map((clip) => {
    if (!clip || typeof clip !== 'object') {
      return clip;
    }

    const clipRecord = /** @type {Record<string, unknown>} */ (clip);
    const qcEntry = byFilename.get(String(clipRecord.filename ?? ''));
    if (!qcEntry) {
      return clipRecord;
    }

    const existingQc =
      clipRecord.qc && typeof clipRecord.qc === 'object'
        ? /** @type {Record<string, unknown>} */ (clipRecord.qc)
        : {};

    return {
      ...clipRecord,
      qc: {
        ...existingQc,
        [STAGE_KEY]: pickLufsBuffQcFields(qcEntry),
      },
    };
  });

  return updated;
}

/**
 * @param {Object} options
 * @param {Record<string, unknown>} options.manifest
 * @param {Record<string, unknown>[]} options.qcEntries
 * @param {Record<string, number>} options.qcSummary
 * @param {Record<string, unknown>} options.processingData
 * @param {string} [options.sourceManifestPath]
 * @returns {Record<string, unknown>}
 */
export function buildStageManifest({
  manifest,
  qcEntries,
  qcSummary,
  processingData,
  sourceManifestPath,
}) {
  let updated = applyClipQc(manifest, qcEntries);
  updated = appendProcessing(updated, STAGE_KEY, processingData);
  updated.qc_summary = {
    ...(updated.qc_summary && typeof updated.qc_summary === 'object'
      ? /** @type {Record<string, unknown>} */ (updated.qc_summary)
      : {}),
    [STAGE_KEY]: qcSummary,
  };

  if (sourceManifestPath) {
    updated.lineage = {
      ...(updated.lineage && typeof updated.lineage === 'object'
        ? /** @type {Record<string, unknown>} */ (updated.lineage)
        : {}),
      source_manifest: sourceManifestPath,
      stage_manifest: STAGE_MANIFEST_FILENAME,
    };
  }

  return updated;
}
