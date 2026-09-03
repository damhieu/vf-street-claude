import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../js/config.js';
import { carById } from '../js/cars.js';
import { prepareCar, stepLateral, steerCap } from '../js/physics.js';
import { vMax } from '../js/track.js';

const g = CFG.G, MU = 0.95;
const mk = (id, v, extra = {}) => ({ P: prepareCar(carById(id), 0.7), s: { v, x: 0, vLat: 0, aAct: 0, aTyre: 0, slideT: 0, ...extra } });
const muFor = P => MU * P.car.gripFactor;
const run = (P, s, steerFn, kappa, seconds) => { for (let t = 0; t < seconds; t += CFG.STEP) stepLateral(P, s, steerFn(s), kappa, muFor(P), CFG.STEP); return s; };

test('steerCap is limited by the turning radius at low speed and by grip at high speed', () => {
  const P = prepareCar(carById('vf3'), 0.7);
  assert.ok(Math.abs(steerCap(P, 3, 0.9) - 9 / P.rMin) < 1e-9, 'v²/R_min ở tốc độ thấp');
  assert.ok(Math.abs(steerCap(P, 40, 0.9) - CFG.PHYS.STEER_OVER * 0.9 * g) < 1e-9, 'STEER_OVER·μ·g ở tốc độ cao (đòi quá bám được để lốp trượt)');
});

test('holding the steering that matches the road curvature keeps the car on its line', () => {
  const kappa = 1 / 100, v = 20;
  const { P, s } = mk('vf7', v, { aAct: v * v * kappa });
  run(P, s, st => (st.v * st.v * kappa) / steerCap(P, st.v, muFor(P)), kappa, 5);
  assert.ok(Math.abs(s.x) < 0.01, `x drift ${s.x}`);
  assert.ok(Math.abs(s.v - v) < 1e-9, 'không cào lốp dưới giới hạn');
});

test('without steering the road curvature pushes the car outward', () => {
  const { P, s } = mk('vf7', 20);
  run(P, s, () => 0, 1 / 100, 1);
  assert.ok(s.x < -0.5, `x ${s.x} (cua phải → trôi sang trái)`);
  assert.equal(s.slideT, 0, 'không lái = không trượt');
});

test('above the cornering limit even full lock understeers outward and scrubs speed', () => {
  const kappa = 1 / 30, P = prepareCar(carById('vf7'), 0.7);
  const v0 = vMax(kappa, muFor(P)) * 1.25;
  const s = { v: v0, x: 0, vLat: 0, aAct: 0, aTyre: 0, slideT: 0 };
  run(P, s, () => 1, kappa, 2);
  assert.ok(s.x < -1, `x ${s.x}`);
  assert.ok(s.v < v0 - 1, `v ${s.v} < ${v0}`);
  assert.ok(s.slideT > 0 || s.v < v0, 'đã trượt');
});

test('longitudinal grip use shrinks the lateral budget (friction circle)', () => {
  const kappa = 1 / 60, P = prepareCar(carById('vf7'), 0.7), v = vMax(kappa, muFor(P)) * 0.95;
  const free = { v, x: 0, vLat: 0, aAct: v * v * kappa, aTyre: 0, slideT: 0 };
  const braking = { v, x: 0, vLat: 0, aAct: v * v * kappa, aTyre: -0.8 * muFor(P) * g, slideT: 0 };
  const steer = st => Math.min(1, (st.v * st.v * kappa) / steerCap(P, st.v, muFor(P)));
  run(P, free, steer, kappa, 1.5);
  run(P, braking, steer, kappa, 1.5);
  assert.ok(Math.abs(free.x) < 0.05, `free ${free.x}`);
  assert.ok(braking.x < -0.3, `braking mid-corner drifts out: ${braking.x}`);
});

test('the heavy VF 9 responds to a step steer more slowly than the VF 3', () => {
  const a = mk('vf3', 20), b = mk('vf9', 20);
  run(a.P, a.s, () => 1, 0, 0.6);
  run(b.P, b.s, () => 1, 0, 0.6);
  assert.ok(a.s.x > b.s.x + 0.1, `vf3 ${a.s.x} vs vf9 ${b.s.x}`);
});
