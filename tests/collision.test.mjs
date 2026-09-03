import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../js/config.js';
import { resolveBarrier } from '../js/collision.js';

const road = { halfM: 3, edgeL: 4.5, edgeR: 4.5 };

test('a shallow brush with the barrier keeps 60 % of speed, zeroes lateral velocity and stuns', () => {
  const s = { x: 4.8, vLat: 1.5, v: 20, stunT: 0 };
  const hit = resolveBarrier(s, road);
  assert.equal(hit, 'shallow');
  assert.equal(s.x, 4.5);
  assert.equal(s.vLat, 0);
  assert.ok(Math.abs(s.v - 20 * CFG.PHYS.BARRIER_KEEP_SHALLOW) < 1e-9);
  assert.equal(s.stunT, CFG.PHYS.BARRIER_STUN);
});

test('a hard hit (fast lateral velocity) keeps only 25 % of speed', () => {
  const s = { x: -5, vLat: -4, v: 30, stunT: 0 };
  assert.equal(resolveBarrier(s, road), 'hard');
  assert.equal(s.x, -4.5);
  assert.ok(Math.abs(s.v - 30 * CFG.PHYS.BARRIER_KEEP_HARD) < 1e-9);
});

test('inside the edges nothing happens', () => {
  const s = { x: 2, vLat: 1, v: 20, stunT: 0 };
  assert.equal(resolveBarrier(s, road), null);
  assert.equal(s.v, 20);
});

test('rubbing along the barrier (no lateral speed) only scrapes speed, without stun or incident', () => {
  const s = { x: 4.6, vLat: 0.1, v: 20, stunT: 0 };
  assert.equal(resolveBarrier(s, road, CFG.STEP), 'rub');
  assert.equal(s.x, 4.5);
  assert.ok(s.v < 20 && s.v > 19.9, `v ${s.v}`);
  assert.equal(s.stunT, 0);
});

test('rear-end car-to-car contact conserves momentum and separates the cars', async () => {
  const { resolveCarCar } = await import('../js/collision.js');
  const a = { z: 100, x: 0, v: 30, vLat: 0, m: 2000, len: 4.5, w: 1.9, stunT: 0 };
  const b = { z: 103, x: 0.2, v: 20, vLat: 0, m: 1000, len: 4.5, w: 1.8, stunT: 0 };
  const hit = resolveCarCar(a, b);
  assert.equal(hit, 'rear');
  const pBefore = 2000 * 30 + 1000 * 20;
  assert.ok(Math.abs(a.m * a.v + b.m * b.v - pBefore) < 1e-6, 'động lượng');
  assert.ok(a.v < 30 && b.v > 20 && a.v <= b.v, `a ${a.v} b ${b.v}`);
  assert.ok(b.z - a.z >= 4.5 - 1e-9, 'tách xe theo chiều dài');
});

test('side-by-side contact pushes both apart and costs a little speed', async () => {
  const { resolveCarCar } = await import('../js/collision.js');
  const a = { z: 100, x: 0, v: 30, vLat: 0, m: 2000, len: 4.5, w: 1.9, stunT: 0 };
  const b = { z: 101, x: 1.2, v: 29, vLat: 0, m: 1000, len: 4.5, w: 1.8, stunT: 0 };
  assert.equal(resolveCarCar(a, b), 'side');
  assert.ok(b.x - a.x > 1.2, `đẩy ra: ${b.x - a.x}`);
  assert.ok(b.x - 1.2 > 0 - a.x, 'xe nhẹ bị đẩy nhiều hơn');
  assert.ok(Math.abs(a.v - 30 * (1 - CFG.COLLISION.SIDE_LOSS)) < 1e-9);
});

test('cars that do not overlap are left alone', async () => {
  const { resolveCarCar } = await import('../js/collision.js');
  const a = { z: 100, x: 0, v: 30, vLat: 0, m: 2000, len: 4.5, w: 1.9, stunT: 0 };
  const b = { z: 120, x: 0, v: 20, vLat: 0, m: 1000, len: 4.5, w: 1.8, stunT: 0 };
  assert.equal(resolveCarCar(a, b), null);
  assert.equal(a.v, 30);
});

test('hitting a truck from behind leaves the car near the truck speed and stunned', async () => {
  const { resolveCarTraffic } = await import('../js/collision.js');
  const car = { z: 100, x: 1.5, v: 30, vLat: 0, m: 2000, len: 4.5, w: 1.9, stunT: 0 };
  const truck = { z: 105, x: 1.5, v: 12, dir: 1, m: 9000, len: 8, w: 2.4, kind: 'truck', vLat: 0, stunT: 0 };
  assert.equal(resolveCarTraffic(car, truck), 'rear');
  assert.ok(car.v < 17 && car.v > 12, `v ${car.v}`);
  assert.ok(car.stunT >= CFG.COLLISION.CAR_STUN);
});

test('hitting a motorbike applies the accident rule instead of pure momentum', async () => {
  const { resolveCarTraffic } = await import('../js/collision.js');
  const car = { z: 100, x: 2.4, v: 25, vLat: 0, m: 2000, len: 4.5, w: 1.9, stunT: 0 };
  const bike = { z: 102, x: 2.6, v: 12, dir: 1, m: 180, len: 1.9, w: 0.7, kind: 'bike', vLat: 0, stunT: 0 };
  assert.equal(resolveCarTraffic(car, bike), 'bike');
  assert.equal(car.stunT, CFG.COLLISION.BIKE_STUN);
  assert.equal(car.forcedBrakeT, CFG.COLLISION.BIKE_BRAKE_T);
  assert.equal(bike.dead, true);
});

test('an oncoming car is a near head-on: closing speed is what counts', async () => {
  const { resolveCarTraffic } = await import('../js/collision.js');
  const car = { z: 100, x: -1.5, v: 25, vLat: 0, m: 2000, len: 4.5, w: 1.9, stunT: 0 };
  const onc = { z: 103, x: -1.5, v: 15, dir: -1, m: 1400, len: 4.5, w: 1.8, kind: 'car', vLat: 0, stunT: 0 };
  assert.equal(resolveCarTraffic(car, onc), 'headon');
  assert.ok(car.v < 10, `v ${car.v}`);
  assert.ok(car.stunT >= CFG.COLLISION.BIKE_STUN);
});

test('rubbing keeps the steering command so the car can pull away from the wall', () => {
  const s = { x: 4.6, vLat: 0.1, v: 20, stunT: 0, aAct: -5 };
  resolveBarrier(s, road, CFG.STEP);
  assert.equal(s.aAct, -5);
  assert.equal(s.vLat, 0, 'vận tốc ngang ép vào rào bị triệt');
  const away = { x: 4.6, vLat: -0.2, v: 20, stunT: 0, aAct: -5 };
  resolveBarrier(away, road, CFG.STEP);
  assert.equal(away.vLat, -0.2, 'vận tốc ngang rời rào giữ nguyên');
});

test('a head-on with oncoming traffic wrecks (removes) the oncoming vehicle so the road cannot deadlock', async () => {
  const { resolveCarTraffic } = await import('../js/collision.js');
  const car = { z: 100, x: -1.5, v: 25, vLat: 0, m: 2000, len: 4.5, w: 1.9, stunT: 0 };
  const onc = { z: 103, x: -1.5, v: 15, dir: -1, m: 1400, len: 4.5, w: 1.8, kind: 'car', vLat: 0, stunT: 0 };
  assert.equal(resolveCarTraffic(car, onc), 'headon');
  assert.equal(onc.dead, true);
  assert.equal(resolveCarTraffic(car, onc), null, 'xe đã nát không va lại');
});

test('a low-speed nudge separates the cars without stun and is not a real collision', async () => {
  const { resolveCarCar } = await import('../js/collision.js');
  const a = { z: 100, x: 0, v: 0.6, vLat: 0, m: 2000, len: 4.5, w: 1.9, stunT: 0 };
  const b = { z: 103, x: 0.1, v: 0, vLat: 0, m: 1000, len: 4.5, w: 1.8, stunT: 0 };
  assert.equal(resolveCarCar(a, b), 'nudge');
  assert.equal(a.stunT, 0);
  assert.ok(b.z - a.z >= 4.5 - 1e-9);
  assert.ok(a.v <= 0.05, `xe sau dừng theo xe trước: ${a.v}`);
});
