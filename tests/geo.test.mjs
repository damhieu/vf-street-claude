import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLocalMeters, fromLocalMeters, polylineLength, resample, buildProfile, closeLoop, slopeFrom } from '../js/geo.js';

// Tuyến tổng hợp: thẳng 200 m → cung R = 50 m quay 90° → thẳng 200 m, lấy mẫu 1 m.
function syntheticRoute() {
  const pts = [];
  for (let s = 0; s <= 200; s += 1) pts.push({ x: s, y: 0 });
  const R = 50;
  for (let a = 1; a <= 90; a += 1) { const t = (a * Math.PI) / 180; pts.push({ x: 200 + R * Math.sin(t), y: R - R * Math.cos(t) }); }
  for (let s = 1; s <= 200; s += 1) pts.push({ x: 250, y: 50 + s });
  return pts;
}

test('toLocalMeters projects lat/lon to metres around the first point', () => {
  const p = toLocalMeters([{ lat: 16.0, lon: 108.0 }, { lat: 16.001, lon: 108.0 }, { lat: 16.0, lon: 108.001 }]);
  assert.deepEqual(p[0], { x: 0, y: 0 });
  assert.ok(Math.abs(p[1].y - 111.2) < 0.5 && Math.abs(p[1].x) < 1e-6);
  assert.ok(Math.abs(p[2].x - 111.2 * Math.cos((16 * Math.PI) / 180)) < 0.5);
});

test('resample walks the polyline at a fixed spacing', () => {
  const pts = syntheticRoute();
  const len = polylineLength(pts);
  assert.ok(Math.abs(len - (400 + (Math.PI / 2) * 50)) < 0.5, `length ${len}`);
  const rs = resample(pts, 4);
  assert.equal(rs.length, Math.floor(len / 4) + 1);
  for (let i = 1; i < rs.length; i++) assert.ok(Math.abs(Math.hypot(rs[i].x - rs[i - 1].x, rs[i].y - rs[i - 1].y) - 4) < 0.05);
});

test('buildProfile recovers curvature 1/R in the arc and ~0 on the straights', () => {
  const prof = buildProfile(syntheticRoute(), 4);
  assert.ok(Math.abs(prof.lengthM - (400 + (Math.PI / 2) * 50)) / prof.lengthM < 0.005);
  const arc = prof.kappa.slice(60, 65); // 240–260 m: giữa cung (cung từ 200 m tới 278,5 m)
  for (const k of arc) assert.ok(Math.abs(k - 0.02) < 0.002, `arc κ ${k}`);
  for (const k of [...prof.kappa.slice(0, 40), ...prof.kappa.slice(80)]) assert.ok(Math.abs(k) < 0.002, `straight κ ${k}`);
  assert.ok(prof.kappa.every(k => Math.abs(k) <= 1 / 12));
});

test('buildProfile keeps the sign of the turn direction', () => {
  const left = buildProfile(syntheticRoute(), 4).kappa[62];
  const mirrored = syntheticRoute().map(p => ({ x: p.x, y: -p.y }));
  const right = buildProfile(mirrored, 4).kappa[62];
  assert.ok(left > 0 && right < 0);
});

test('closeLoop removes the linear drift so a loop ends at its start elevation', () => {
  const y = closeLoop([10, 12, 15, 13, 16]);
  assert.equal(y[0], 10);
  assert.ok(Math.abs(y[y.length - 1] - 10) < 1e-9);
  assert.ok(Math.abs(y[2] - (15 - 6 * 2 / 4)) < 1e-9);
});

test('slopeFrom clamps grade and rate of change', () => {
  // 0 → dốc 10 % kéo dài 320 m → phẳng (L = 4 m)
  const y = Array.from({ length: 120 }, (_, i) => (i < 20 ? 0 : i < 100 ? (i - 20) * 0.4 : 80));
  const s = slopeFrom(y, 4);
  assert.equal(s.length, y.length);
  assert.ok(s[60] > 0.09 && s[60] <= 0.1 + 1e-9, `mid slope ${s[60]}`);
  assert.ok(s.every(v => Math.abs(v) <= 0.12));
  for (let i = 1; i < s.length; i++) assert.ok(Math.abs(s[i] - s[i - 1]) <= 0.008 + 1e-9, `rate at ${i}`);
  const spike = slopeFrom([0, 0, 8, 16, 16, 16, 16], 4);
  assert.ok(Math.max(...spike.map(Math.abs)) <= 0.12);
});

test('fromLocalMeters inverts toLocalMeters', () => {
  const src = [{ lat: 16.0, lon: 108.0 }, { lat: 16.0123, lon: 108.0456 }];
  const back = fromLocalMeters(toLocalMeters(src), src[0]);
  assert.ok(Math.abs(back[1].lat - 16.0123) < 1e-9 && Math.abs(back[1].lon - 108.0456) < 1e-9);
});
