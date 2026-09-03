import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../js/config.js';
import { carById } from '../js/cars.js';
import { muFor, prepareCar, stepLongitudinal } from '../js/physics.js';

const DRY = { muMult: 1 };
const flat = (car, mu) => ({ mu, slope: 0, crr: CFG.PHYS.MU.asphalt.crr, offroad: false });
const roll = (P, v0, input, env, seconds) => {
  let v = v0, s = 0, out;
  for (let t = 0; t < seconds; t += CFG.STEP) { out = stepLongitudinal(P, v, input, env, CFG.STEP); s += (v + out.v) / 2 * CFG.STEP; v = out.v; }
  return { v, s, out };
};

test('muFor multiplies surface grip, weather and the car grip factor', () => {
  const vf7 = carById('vf7'), vf3 = carById('vf3');
  assert.ok(Math.abs(muFor('asphalt', DRY, vf7) - 0.95) < 1e-9);
  assert.ok(Math.abs(muFor('asphalt', { muMult: 0.74 }, vf7) - 0.703) < 1e-9);
  assert.ok(Math.abs(muFor('grass', DRY, vf3) - 0.55 * vf3.gripFactor) < 1e-9);
});

test('throttle accelerates from rest, no input keeps the car still', () => {
  const car = carById('vf5'), P = prepareCar(car, 0.7), env = flat(car, muFor('asphalt', DRY, car));
  assert.ok(stepLongitudinal(P, 0, { throttle: 1, brake: 0 }, env, CFG.STEP).v > 0);
  assert.equal(stepLongitudinal(P, 0, { throttle: 0, brake: 0 }, env, CFG.STEP).v, 0);
});

test('coasting decelerates through regen, rolling and aero drag', () => {
  const car = carById('vf8'), P = prepareCar(car, 0.7);
  const r = roll(P, 30, { throttle: 0, brake: 0 }, flat(car, 0.95), 1);
  assert.ok(r.v < 30 - 0.5 && r.v > 30 - 2.5, `v after 1 s coast = ${r.v}`);
});

test('full braking from 100 km/h on dry asphalt stops in 38–46 m', () => {
  for (const id of ['vf3', 'vf7', 'vf9']) {
    const car = carById(id), P = prepareCar(car, 0.7);
    const r = roll(P, 100 / 3.6, { throttle: 0, brake: 1 }, flat(car, muFor('asphalt', DRY, car)), 8);
    assert.equal(r.v, 0, `${id} stopped`);
    assert.ok(r.s > 38 && r.s < 46, `${id} braking distance ${r.s.toFixed(1)} m`);
  }
});

test('electronic limiter caps speed at vLim, also downhill', () => {
  const car = carById('vf3'), P = prepareCar(car, 0.7), vLim = car.vLimKmh / 3.6;
  const flatRun = roll(P, vLim - 0.5, { throttle: 1, brake: 0 }, flat(car, 0.9), 5);
  assert.ok(flatRun.v <= vLim + 1e-6 && flatRun.v > vLim - 0.05, `flat ${flatRun.v}`);
  const down = roll(P, vLim, { throttle: 1, brake: 0 }, { mu: 0.9, slope: -0.08, crr: 0.011, offroad: false }, 5);
  assert.ok(down.v <= vLim + 1e-6, `downhill ${down.v}`);
});

test('launch traction is limited by grip on the driven axle', () => {
  const car = carById('vf5'), P = prepareCar(car, 0.7); // FWD
  const dry = stepLongitudinal(P, 0, { throttle: 1, brake: 0 }, flat(car, muFor('asphalt', DRY, car)), CFG.STEP).a;
  const wet = stepLongitudinal(P, 0, { throttle: 1, brake: 0 }, flat(car, muFor('asphalt', { muMult: 0.5 }, car)), CFG.STEP).a;
  assert.ok(wet < dry, `wet ${wet} < dry ${dry}`);
  assert.ok(wet <= 0.5 * 0.95 * car.gripFactor * CFG.G * car.staticShare * 1.05 + 1e-9, 'wet launch bounded by μ·g·share');
});

test('off-road grass adds heavy drag above 60 km/h', () => {
  const car = carById('vf7'), P = prepareCar(car, 0.7);
  const onRoad = roll(P, 25, { throttle: 0, brake: 0 }, flat(car, 0.95), 1).v;
  const grass = roll(P, 25, { throttle: 0, brake: 0 }, { mu: 0.55, slope: 0, crr: CFG.PHYS.MU.grass.crr, offroad: true }, 1).v;
  assert.ok(onRoad - grass > 2.5, `grass slows ${onRoad - grass} m/s more per second`);
});

test('telemetry reports positive drive power and negative regen power', () => {
  const car = carById('vf7'), P = prepareCar(car, 0.7), env = flat(car, 0.95);
  assert.ok(stepLongitudinal(P, 20, { throttle: 1, brake: 0 }, env, CFG.STEP).powerW > 0);
  assert.ok(stepLongitudinal(P, 20, { throttle: 0, brake: 1 }, env, CFG.STEP).powerW < 0);
});
