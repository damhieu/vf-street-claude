import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS, carById, wheelRadiusM, paintsFor } from '../js/cars.js';

test('catalog has exactly the six VF models in tier order', () => {
  assert.deepEqual(CARS.map(c => c.id), ['vf3', 'vf5', 'vf6', 'vf7', 'vf8', 'vf9']);
});

test('every car carries the real-spec fields the physics needs', () => {
  for (const c of CARS) {
    assert.ok(c.name, c.id);
    assert.ok(c.powerKw > 0 && c.torqueNm > 0, `${c.id} power/torque`);
    assert.ok(c.massKg >= 800 && c.massKg <= 3500, `${c.id} mass`);
    assert.ok(['FWD', 'RWD', 'AWD'].includes(c.drive), `${c.id} drive`);
    assert.ok(c.vLimKmh >= 90 && c.vLimKmh <= 220, `${c.id} vLim`);
    assert.ok(c.t0100 === null || (c.t0100 > 4 && c.t0100 < 25), `${c.id} t0100`);
    for (const k of ['lengthMm', 'widthMm', 'heightMm', 'wheelbaseMm']) assert.ok(c[k] > 1000, `${c.id} ${k}`);
    assert.ok(c.tyre.width > 0 && c.tyre.aspect > 0 && c.tyre.rim > 0, `${c.id} tyre`);
    assert.ok(c.cdA > 0.5 && c.cdA < 1.2, `${c.id} cdA`);
    assert.ok(c.crr > 0.005 && c.crr < 0.02, `${c.id} crr`);
    assert.ok(c.hCg > 0.4 && c.hCg < 0.8, `${c.id} hCg`);
    assert.ok(c.gripFactor > 0.85 && c.gripFactor <= 1.0, `${c.id} gripFactor`);
    assert.ok(typeof c.source === 'string' && c.source.length > 0, `${c.id} source`);
  }
});

test('power never decreases up the range', () => {
  for (let i = 1; i < CARS.length; i++) assert.ok(CARS[i].powerKw >= CARS[i - 1].powerKw, CARS[i].id);
});

test('wheelRadiusM derives the rolling radius from the tyre size', () => {
  // 175/75 R16: 16*25.4/2 + 175*0.75 = 334.45 mm
  assert.ok(Math.abs(wheelRadiusM(carById('vf3')) - 0.33445) < 1e-4);
});

test('paintsFor returns the model-specific factory colours', () => {
  const p3 = paintsFor('vf3'), p8 = paintsFor('vf8');
  assert.ok(p3.length >= 4 && p8.length >= 4);
  assert.ok(p3.every(p => /^#[0-9a-f]{6}$/i.test(p.hex) && p.name));
  assert.notDeepEqual(p3.map(p => p.name), p8.map(p => p.name));
  assert.equal(carById('nope'), undefined);
});

test('fieldFor picks opponents from the same class band, clamped to the range', async () => {
  const { fieldFor } = await import('../js/cars.js');
  assert.deepEqual(fieldFor('vf3').map(c => c.id), ['vf3', 'vf5', 'vf6']);
  assert.deepEqual(fieldFor('vf6').map(c => c.id), ['vf5', 'vf6', 'vf7']);
  assert.deepEqual(fieldFor('vf9').map(c => c.id), ['vf7', 'vf8', 'vf9']);
  assert.equal(fieldFor('vf7', true).length, 6);
});
