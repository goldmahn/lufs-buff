import { QC_THRESHOLDS } from './config.js';

/**
 * @typedef {import('./analyzeAudio.js').AudioAnalysis} AudioAnalysis
 * @typedef {import('./config.js').QcStatus} QcStatus
 */

/**
 * @typedef {Object} QcResult
 * @property {QcStatus} status
 * @property {string[]} notes
 */

/**
 * Classify a clip based on analysis metrics.
 * @param {AudioAnalysis} analysis
 * @returns {QcResult}
 */
export function classifyClip(analysis) {
  const notes = [];

  if (!analysis.valid) {
    return {
      status: 'REJECT',
      notes: [analysis.error ?? 'Invalid or corrupted audio file'],
    };
  }

  if (isMissingAudioContent(analysis)) {
    return {
      status: 'REJECT',
      notes: ['Missing audio content'],
    };
  }

  evaluateRejectRules(analysis, notes);
  if (notes.length > 0) {
    return { status: 'REJECT', notes };
  }

  evaluateReviewRules(analysis, notes);
  if (notes.length > 0) {
    return { status: 'REVIEW', notes };
  }

  return { status: 'PASS', notes: [] };
}

/**
 * @param {AudioAnalysis} analysis
 * @returns {boolean}
 */
function isMissingAudioContent(analysis) {
  if (analysis.duration === null || analysis.duration <= 0) {
    return true;
  }

  const peak = effectivePeak(analysis);
  if (peak !== null && peak <= -90) {
    return true;
  }

  if (
    analysis.rmsDbfs !== null &&
    analysis.rmsDbfs <= -80 &&
    (peak === null || peak <= -60)
  ) {
    return true;
  }

  return false;
}

/**
 * @param {AudioAnalysis} analysis
 * @param {string[]} notes
 */
function evaluateRejectRules(analysis, notes) {
  const peak = effectivePeak(analysis);

  if (peak !== null && peak >= QC_THRESHOLDS.clipPeakDbfs) {
    notes.push('Obvious clipping detected');
  }

  if (analysis.clippingPercentage >= QC_THRESHOLDS.clipPercentageReject) {
    notes.push('Excessive clipping percentage');
  }

  if (analysis.clippingCount > 0 && peak !== null && peak >= 0) {
    notes.push('Digital clipping at 0 dBFS');
  }
}

/**
 * @param {AudioAnalysis} analysis
 * @param {string[]} notes
 */
function evaluateReviewRules(analysis, notes) {
  const peak = effectivePeak(analysis);

  if (analysis.lufs !== null && analysis.lufs < QC_THRESHOLDS.quietLufs) {
    notes.push('Unusually quiet integrated loudness');
  }

  if (analysis.lufs !== null && analysis.lufs > QC_THRESHOLDS.loudLufs) {
    notes.push('Unusually loud integrated loudness');
  }

  if (
    analysis.leadingSilenceMs > QC_THRESHOLDS.excessiveSilenceMs ||
    analysis.trailingSilenceMs > QC_THRESHOLDS.excessiveSilenceMs
  ) {
    notes.push('Excessive leading or trailing silence');
  }

  if (
    analysis.leadingSilenceMs < QC_THRESHOLDS.minimalSilenceMs ||
    analysis.trailingSilenceMs < QC_THRESHOLDS.minimalSilenceMs
  ) {
    notes.push('Leading or trailing silence below threshold');
  }

  if (peak !== null && peak >= QC_THRESHOLDS.nearClipPeakDbfs) {
    notes.push('Peak near clipping');
  }

  if (
    analysis.clippingPercentage >= QC_THRESHOLDS.clipPercentageReview &&
    analysis.clippingPercentage < QC_THRESHOLDS.clipPercentageReject
  ) {
    notes.push('Low-level clipping detected');
  }

  if (
    analysis.duration !== null &&
    analysis.duration < QC_THRESHOLDS.minDurationSec
  ) {
    notes.push('Unusually short duration');
  }

  if (
    analysis.duration !== null &&
    analysis.duration > QC_THRESHOLDS.maxDurationSec
  ) {
    notes.push('Unusually long duration');
  }
}

/**
 * @param {AudioAnalysis} analysis
 * @returns {number | null}
 */
function effectivePeak(analysis) {
  if (analysis.truePeakDbfs !== null) {
    return analysis.truePeakDbfs;
  }
  return analysis.peakDbfs;
}

/**
 * Build a report entry from analysis and classification.
 * @param {AudioAnalysis} analysis
 * @param {QcResult} qc
 * @returns {Record<string, unknown>}
 */
export function buildReportEntry(analysis, qc) {
  return {
    filename: analysis.filename,
    duration: roundOrNull(analysis.duration, 3),
    sampleRate: analysis.sampleRate,
    channels: analysis.channels,
    lufs: roundOrNull(analysis.lufs, 1),
    rmsDbfs: roundOrNull(analysis.rmsDbfs, 1),
    peakDbfs: roundOrNull(analysis.peakDbfs, 1),
    truePeakDbfs: roundOrNull(analysis.truePeakDbfs, 1),
    clippingCount: analysis.clippingCount,
    clippingPercentage: roundOrNull(analysis.clippingPercentage, 4),
    leadingSilenceMs: analysis.leadingSilenceMs,
    trailingSilenceMs: analysis.trailingSilenceMs,
    status: qc.status,
    notes: qc.notes,
    ...(analysis.error ? { error: analysis.error } : {}),
  };
}

/**
 * @param {number | null} value
 * @param {number} digits
 * @returns {number | null}
 */
function roundOrNull(value, digits) {
  if (value === null) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
