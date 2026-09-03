import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../js/config.js';
import { hydrateTrack } from '../js/track.js';
import { createRace } from '../js/race.js';
import { syntheticTrackJson, driveInput } from './helpers.mjs';

const FULL = { steer: 0, throttle: 1, brake: 0 };
const IDLE = { steer: 0, throttle: 0, brake: 0 };
const run = (race, input, seconds) => { for (let t = 0; t < seconds; t += CFG.STEP) race.update(typeof input === 'function' ? input(race) : input, CFG.STEP); };
const make = (kind = 'sprint', settings = {}) => createRace({ track: hydrateTrack(syntheticTrackJson(kind)), carId: 'vf7', paint: '#fff', settings: { practice: true, ...settings }, seed: 1, weatherId: 'clear' });

test('the car cannot move during the countdown', () => {
  const race = make();
  assert.equal(race.phase, 'countdown');
  run(race, FULL, 1);
  assert.equal(race.player.z, 0);
  run(race, FULL, CFG.RACE.COUNTDOWN);
  assert.equal(race.phase, 'racing');
  assert.ok(race.player.z > 0);
});

test('full throttle after the start accelerates the VF 7 past 50 km/h within 5 s', () => {
  const race = make();
  run(race, IDLE, CFG.RACE.COUNTDOWN + 0.1);
  run(race, FULL, 5);
  assert.ok(race.snapshot().kmh > 50, `kmh ${race.snapshot().kmh}`);
  assert.ok(race.player.z > 40);
});

test('a sprint finishes when the player crosses the end and reports elapsed time', () => {
  const race = make();
  run(race, driveInput, 120);
  assert.equal(race.finished, true);
  const r = race.result();
  assert.ok(r.time > 20 && r.time < 120, `time ${r.time}`);
  assert.equal(r.total, 1);
  assert.equal(r.pos, 1);
  assert.equal(r.sectors.length, 3);
  assert.ok(r.sectors.every(s => s > 0));
});

test('a loop counts laps on wrap and finishes after the configured laps', () => {
  const race = make('loop');
  run(race, driveInput, 20);
  assert.equal(race.player.lap, 0);
  run(race, driveInput, 200);
  assert.equal(race.finished, true);
  assert.equal(race.result().laps, 2);
});

test('snapshot carries every HUD field', () => {
  const s = make().snapshot();
  for (const k of ['kmh', 'powerFrac', 'pos', 'total', 'time', 'lap', 'laps', 'kind', 'distToFinish', 'weather', 'phase']) assert.ok(k in s, k);
});

test('practice mode has no opponents and no traffic', () => {
  const json = { ...syntheticTrackJson('sprint', { n: 2500 }), trafficProfile: 'passBikes' };
  const race = createRace({ track: hydrateTrack(json), carId: 'vf7', paint: '#fff', settings: { practice: true }, seed: 3, weatherId: 'clear' });
  run(race, IDLE, CFG.RACE.COUNTDOWN + 5);
  assert.equal(race.cars.length, 0);
  assert.equal(race.traffic.length, 0);
});

test('steering moves the car across the road and the barrier costs speed and counts an incident', () => {
  const race = make();
  run(race, IDLE, CFG.RACE.COUNTDOWN + 0.1);
  run(race, FULL, 4);
  const v0 = race.player.v;
  run(race, { steer: 1, throttle: 1, brake: 0 }, 1);
  assert.ok(race.player.x > 0.5, `x ${race.player.x}`);
  run(race, { steer: 1, throttle: 1, brake: 0 }, 4);
  assert.ok(race.player.x <= race.track.road.edgeR + 1e-9, `kẹp ở rào: x ${race.player.x}`);
  assert.ok(race.player.v < v0, `mất tốc sau va rào: ${race.player.v} < ${v0}`);
  assert.ok(race.incidents >= 1);
  assert.ok(race.player.stunT >= 0);
});

test('a stunned car ignores steering until the stun expires', () => {
  const race = make();
  run(race, IDLE, CFG.RACE.COUNTDOWN + 0.1);
  run(race, FULL, 3);
  race.player.stunT = 1.0;
  const x0 = race.player.x;
  run(race, { steer: 1, throttle: 1, brake: 0 }, 0.5);
  assert.ok(Math.abs(race.player.x - x0) < 0.05, `x đứng yên khi choáng: ${race.player.x - x0}`);
});

test('a normal race fields class-matched AI on a staggered grid ahead of the player', () => {
  const race = make('sprint', { practice: false });
  assert.equal(race.cars.length, CFG.FIELD.AI_COUNT);
  const ids = new Set(race.cars.map(c => c.spec.id));
  assert.ok([...ids].every(id => ['vf6', 'vf7', 'vf8'].includes(id)), [...ids].join());
  const zs = race.cars.map(c => c.z).sort((a, b) => a - b);
  assert.ok(zs[0] >= race.player.z + CFG.FIELD.GRID_GAP - 1e-9, 'người chơi xuất phát cuối');
  for (let i = 1; i < zs.length; i++) assert.ok(zs[i] - zs[i - 1] >= CFG.FIELD.GRID_GAP - 1e-9);
  assert.ok(race.cars.every(c => Math.abs(c.x) === CFG.FIELD.GRID_X));
});

test('AI cars drive the track and standings follow distance covered', () => {
  const race = make('sprint', { practice: false });
  run(race, IDLE, CFG.RACE.COUNTDOWN + 0.1);
  run(race, IDLE, 20); // người chơi đứng yên
  assert.ok(race.cars.every(c => c.z > 150), race.cars.map(c => Math.round(c.z)).join());
  assert.equal(race.snapshot().pos, 6);
  assert.ok(race.cars.every(c => Math.abs(c.x) <= race.track.road.edgeR), 'AI không rời đường');
  run(race, driveInput, 60);
  const ahead = race.cars.filter(c => c.z > race.player.z).length;
  assert.equal(race.snapshot().pos, 1 + ahead);
});

test('autopilot drives the practice sprint to the finish without incidents', () => {
  const race = make();
  race.autopilot = true;
  run(race, IDLE, 100);
  assert.equal(race.finished, true);
  assert.equal(race.incidents, 0);
});

test('public-road races spawn traffic that the player can hit; a bike hit triggers the accident rule', () => {
  const json = { ...syntheticTrackJson('sprint', { n: 2500 }), trafficProfile: 'passBikes' };
  const race = createRace({ track: hydrateTrack(json), carId: 'vf7', paint: '#fff', settings: { practice: false }, seed: 3, weatherId: 'clear' });
  race.cars.length = 0; // chỉ xét giao thông
  run(race, IDLE, CFG.RACE.COUNTDOWN + 0.1);
  run(race, FULL, 8);
  assert.ok(race.traffic.length > 0, 'có giao thông trên đường công cộng');
  assert.ok(race.traffic.some(v => v.dir === -1), 'có xe ngược chiều');
  const bike = race.traffic.find(v => v.kind === 'bike' && v.dir === 1);
  assert.ok(bike, 'có xe máy');
  // đặt xe máy ngay trước mũi xe người chơi
  bike.z = race.player.z + 3; bike.x = race.player.x;
  const incidents = race.incidents;
  run(race, FULL, 0.5);
  assert.equal(race.incidents, incidents + 1);
  assert.equal(bike.dead, true);
  const v0 = race.player.v;
  run(race, FULL, 1.5);
  assert.ok(race.player.v <= CFG.COLLISION.BIKE_TARGET_KMH / 3.6 + 0.5 || race.player.v < v0 * 0.6, `ép phanh sau tai nạn: ${race.player.v} (trước ${v0})`);
});

test('the closed street circuit has no traffic', () => {
  const race = make('loop');
  run(race, IDLE, CFG.RACE.COUNTDOWN + 5);
  assert.equal(race.traffic.length, 0);
});

test('traffic occupies segments so the renderer can find it', () => {
  const json = { ...syntheticTrackJson('sprint', { n: 2500 }), trafficProfile: 'motorway', road: { halfM: Array(2500).fill(5.625), shoulderL: 0.75, shoulderR: 3, edgeL: 6.6, edgeR: 9, lanes: 3, twoWay: false } };
  const race = createRace({ track: hydrateTrack(json), carId: 'vf8', paint: '#fff', settings: { practice: false }, seed: 4, weatherId: 'clear' });
  race.cars.length = 0;
  run(race, IDLE, CFG.RACE.COUNTDOWN + 3);
  const inSegments = race.track.segments.reduce((n, s) => n + s.cars.filter(c => !c.spec).length, 0);
  assert.equal(inSegments, race.traffic.length);
  assert.ok(race.traffic.every(v => v.kind !== 'bike'));
});

test('AI cars that finish keep driving off the road and no longer block or collide', () => {
  const race = make('sprint', { practice: false });
  race.autopilot = true;
  run(race, IDLE, 150);
  for (const c of race.cars) {
    if (c.finishTime == null) continue;
    assert.ok(c.gone === true || c.z < race.track.lengthM + 150, 'xe đã về đích biến mất sau 150 m');
    if (c.gone) assert.ok(!race.track.segments.some(s => s.cars.includes(c)), 'không còn trong segment');
  }
  assert.ok(race.cars.some(c => c.gone), 'ít nhất một xe AI đã đi khỏi');
});
