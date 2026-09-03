import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../js/config.js';
import { hydrateTrack, segIndexAt, kappaAt, slopeAt, yAt, vMax, wrapZ, nextCorner, distToFinish } from '../js/track.js';

function json(kind = 'sprint') {
  const n = 100, L = 4;
  const kappa = Array.from({ length: n }, (_, i) => (i >= 40 && i < 50 ? 0.02 : i >= 70 && i < 75 ? -0.1 : 0));
  return {
    id: 't', name: 'T', place: 'P', kind, laps: kind === 'loop' ? 3 : 1, lengthM: n * L, L, n,
    road: { halfM: Array(n).fill(3), shoulderL: 0.75, shoulderR: 0.75, edgeL: 4.5, edgeR: 4.5, lanes: 2, twoWay: true },
    kappa, slope: Array(n).fill(0.05), y: Array.from({ length: n + 1 }, (_, i) => i * 0.2), surface: Array(n).fill(0), hint: Array(n).fill(0),
    signs: [], sectorsZ: [133, 267], geo: [[16, 108]], weatherPresets: ['clear'], trafficProfile: null, scenery: 'coast',
  };
}

test('hydrateTrack derives the render curve from κ with the readability cap', () => {
  const t = hydrateTrack(json());
  assert.equal(t.segments.length, 100);
  assert.ok(Math.abs(t.segments[45].curve - 0.02 * 16) < 1e-9, 'curve = κ·L²');
  assert.ok(Math.abs(t.segments[72].curve - -CFG.RENDER.KAPPA_RENDER_MAX * 16) < 1e-9, 'κ_render kẹp ở 1/25');
  assert.equal(t.segments[72].kappa, -0.1, 'κ vật lý giữ nguyên');
  assert.equal(t.segments[3].z0, 12);
  assert.equal(t.segments[3].halfM, 3);
});

test('segIndexAt wraps on loops and clamps on sprints', () => {
  const loop = hydrateTrack(json('loop')), sprint = hydrateTrack(json('sprint'));
  assert.equal(segIndexAt(loop, 400 + 10), 2);
  assert.equal(segIndexAt(loop, -3), 99);
  assert.equal(segIndexAt(sprint, 5000), 99);
  assert.equal(segIndexAt(sprint, -3), 0);
  assert.equal(wrapZ(loop, 405), 5);
  assert.equal(wrapZ(sprint, 405), 405);
});

test('kappaAt, slopeAt and yAt read the segment under z (y interpolated)', () => {
  const t = hydrateTrack(json());
  assert.equal(kappaAt(t, 45 * 4 + 1), 0.02);
  assert.equal(slopeAt(t, 10), 0.05);
  assert.ok(Math.abs(yAt(t, 6) - 0.3) < 1e-9);
});

test('vMax follows sqrt(μ g / |κ|) and is unbounded on straights', () => {
  assert.ok(Math.abs(vMax(1 / 50, 0.9) - Math.sqrt(0.9 * CFG.G * 50)) < 1e-9);
  assert.equal(vMax(0, 0.9), Infinity);
  assert.ok(Math.abs(vMax(-1 / 50, 0.9) - vMax(1 / 50, 0.9)) < 1e-12);
});

test('nextCorner reports distance and κ of the first sharp corner ahead', () => {
  const t = hydrateTrack(json());
  const c = nextCorner(t, 100, 300, 1 / 60);
  assert.ok(c && Math.abs(c.distance - 60) < 1e-9 && c.kappa === 0.02, JSON.stringify(c));
  assert.equal(nextCorner(t, 100, 40, 1 / 60), null);
  const sharp = nextCorner(t, 210, 300, 1 / 40);
  assert.ok(sharp && sharp.kappa === -0.1 && Math.abs(sharp.distance - 70) < 1e-9, JSON.stringify(sharp));
});

test('distToFinish counts remaining metres on a sprint', () => {
  const t = hydrateTrack(json());
  assert.equal(distToFinish(t, 150), 250);
});
