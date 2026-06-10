import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
);

export const PACKAGE_VERSION = packageJson.version;

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
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
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
