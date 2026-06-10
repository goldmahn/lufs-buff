import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReportEntry, classifyClip } from '../src/qcRules.js';

/** @returns {import('../src/analyzeAudio.js').AudioAnalysis} */
function baseAnalysis(overrides = {}) {
  return {
    filename: 'sample.wav',
    duration: 1.5,
    sampleRate: 44100,
    channels: 1,
    lufs: -23,
    rmsDbfs: -25,
    peakDbfs: -3,
    truePeakDbfs: -2.5,
    clippingCount: 0,
    clippingPercentage: 0,
    leadingSilenceMs: 80,
    trailingSilenceMs: 100,
    valid: true,
    error: null,
    ...overrides,
  };
}

test('classifyClip returns PASS for healthy clip', () => {
  const result = classifyClip(baseAnalysis());
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.notes, []);
});

test('classifyClip returns REJECT for invalid file', () => {
  const result = classifyClip(
    baseAnalysis({ valid: false, error: 'Corrupted audio' })
  );
  assert.equal(result.status, 'REJECT');
  assert.match(result.notes[0], /Corrupted audio/);
});

test('classifyClip returns REJECT for obvious clipping', () => {
  const result = classifyClip(
    baseAnalysis({ peakDbfs: 0, truePeakDbfs: 0, clippingCount: 12 })
  );
  assert.equal(result.status, 'REJECT');
  assert.ok(result.notes.some((note) => /clipping/i.test(note)));
});

test('classifyClip returns REVIEW for near clipping', () => {
  const result = classifyClip(baseAnalysis({ truePeakDbfs: -0.5 }));
  assert.equal(result.status, 'REVIEW');
  assert.ok(result.notes.includes('Peak near clipping'));
});

test('classifyClip returns REVIEW for unusual loudness and silence', () => {
  const result = classifyClip(
    baseAnalysis({
      lufs: -40,
      leadingSilenceMs: 5,
      trailingSilenceMs: 900,
    })
  );
  assert.equal(result.status, 'REVIEW');
  assert.ok(result.notes.length >= 2);
});

test('classifyClip returns REJECT for missing audio content', () => {
  const result = classifyClip(
    baseAnalysis({
      rmsDbfs: -90,
      peakDbfs: -90,
      truePeakDbfs: -90,
    })
  );
  assert.equal(result.status, 'REJECT');
  assert.ok(result.notes.includes('Missing audio content'));
});

test('buildReportEntry includes rounded metrics and status', () => {
  const analysis = baseAnalysis({ lufs: -23.14, rmsDbfs: -21.66 });
  const qc = { status: 'PASS', notes: [] };
  const entry = buildReportEntry(analysis, qc);

  assert.equal(entry.filename, 'sample.wav');
  assert.equal(entry.lufs, -23.1);
  assert.equal(entry.rmsDbfs, -21.7);
  assert.equal(entry.status, 'PASS');
});
