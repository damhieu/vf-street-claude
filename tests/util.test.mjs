import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, wrap, rng, kmh, ms, fmtTime, fmtDelta } from '../js/util.js';

test('clamp keeps value inside [lo, hi]', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test('lerp interpolates linearly', () => {
  assert.equal(lerp(10, 20, 0.25), 12.5);
});

test('wrap folds a value into [0, max)', () => {
  assert.equal(wrap(105, 100), 5);
  assert.equal(wrap(-5, 100), 95);
  assert.equal(wrap(100, 100), 0);
});

test('rng is deterministic for a seed and stays in [0, 1)', () => {
  const a = rng(42), b = rng(42);
  const xs = Array.from({ length: 1000 }, () => a());
  const ys = Array.from({ length: 1000 }, () => b());
  assert.deepEqual(xs, ys);
  assert.ok(xs.every(v => v >= 0 && v < 1));
  assert.notEqual(rng(1)(), rng(2)());
});

test('kmh and ms convert speed both ways', () => {
  assert.ok(Math.abs(ms(100) - 27.7778) < 1e-3);
  assert.ok(Math.abs(kmh(27.7778) - 100) < 1e-3);
});

test('fmtTime formats seconds as mm:ss.cc', () => {
  assert.equal(fmtTime(0), '00:00.00');
  assert.equal(fmtTime(83.456), '01:23.45');
  assert.equal(fmtTime(null), '--:--.--');
});

test('fmtDelta shows signed seconds with two decimals', () => {
  assert.equal(fmtDelta(0.345), '+0.35');
  assert.equal(fmtDelta(-1.2), '−1.20');
});
