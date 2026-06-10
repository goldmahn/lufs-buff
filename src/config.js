/** @typedef {'PASS' | 'REVIEW' | 'REJECT'} QcStatus */

/**
 * Centralized QC thresholds and defaults.
 * Adjust these values to tune classification behavior.
 */
export const DEFAULTS = {
  targetLufs: -23,
  truePeakLimit: -1.0,
  lra: 11,
};

export const QC_THRESHOLDS = {
  /** Integrated LUFS below this triggers REVIEW */
  quietLufs: -35,
  /** Integrated LUFS above this triggers REVIEW */
  loudLufs: -14,
  /** Peak dBFS above this triggers REJECT (obvious clipping) */
  clipPeakDbfs: -0.1,
  /** Peak dBFS above this triggers REVIEW (near clipping) */
  nearClipPeakDbfs: -1.0,
  /** Clipping percentage above this triggers REJECT */
  clipPercentageReject: 0.5,
  /** Clipping percentage above this triggers REVIEW */
  clipPercentageReview: 0.01,
  /** Leading/trailing silence above this (ms) triggers REVIEW */
  excessiveSilenceMs: 800,
  /** Leading/trailing silence below this (ms) triggers REVIEW */
  minimalSilenceMs: 20,
  /** Duration below this (seconds) triggers REVIEW */
  minDurationSec: 0.15,
  /** Duration above this (seconds) triggers REVIEW */
  maxDurationSec: 30,
  /** Silence detection noise floor for FFmpeg silencedetect */
  silenceNoiseDb: -50,
  /** Minimum silence segment duration for silencedetect (seconds) */
  silenceMinDurationSec: 0.05,
};

export const SUPPORTED_EXTENSIONS = new Set(['.wav']);
