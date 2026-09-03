import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../js/config.js';
import { rng } from '../js/util.js';
import { hydrateTrack } from '../js/track.js';
import { VEHICLE_TYPES, PROFILES, createTraffic, updateTraffic } from '../js/traffic.js';
import { syntheticTrackJson } from './helpers.mjs';

const longTrack = (over = {}) => hydrateTrack({ ...syntheticTrackJson('sprint', { n: 2500 }), ...over });
const motorway = () => hydrateTrack({ ...syntheticTrackJson('sprint', { n: 2500 }), road: { halfM: Array(2500).fill(5.625), shoulderL: 0.75, shoulderR: 3, edgeL: 6.6, edgeR: 9, lanes: 3, twoWay: false } });
const drive = (state, track, seconds, v = 30) => { let z = 0; for (let t = 0; t < seconds; t += CFG.STEP) { z += v * CFG.STEP; updateTraffic(state, track, z, CFG.STEP); } return z; };

test('vehicle types and profiles cover the Vietnamese mix', () => {
  for (const k of ['bike', 'car', 'coach', 'truck', 'container']) assert.ok(VEHICLE_TYPES[k].w > 0 && VEHICLE_TYPES[k].len > 0 && VEHICLE_TYPES[k].m > 0, k);
  for (const k of ['passBikes', 'passLight', 'passBus', 'motorway']) assert.ok(PROFILES[k].density > 0 && Object.keys(PROFILES[k].mix).length > 1, k);
});

test('spawn rate over 10 km matches the profile density per direction (seeded)', () => {
  const track = longTrack();
  const state = createTraffic(track, 'passBikes', rng(3));
  drive(state, track, 10000 / 30);
  const perKm = state.spawned.same / 10;
  assert.ok(Math.abs(perKm - PROFILES.passBikes.density) / PROFILES.passBikes.density < 0.35, `${perKm}/km`);
  assert.ok(state.spawned.oncoming > 0, 'có xe ngược chiều');
});

test('two-way roads keep same-direction traffic on the right and oncoming on the left; bikes hug the edge', () => {
  const track = longTrack();
  const state = createTraffic(track, 'passBikes', rng(5));
  drive(state, track, 60);
  assert.ok(state.list.length > 3);
  for (const v of state.list) {
    if (v.dir === 1) assert.ok(v.x > 0, `cùng chiều bên phải: ${v.kind} x=${v.x}`); else assert.ok(v.x < 0, `ngược chiều bên trái: x=${v.x}`);
    if (v.kind === 'bike' && v.dir === 1) assert.ok(v.x > 3 - 1.2, `xe máy sát mép: ${v.x}`);
  }
});

test('motorway traffic has no bikes and no oncoming vehicles', () => {
  const track = motorway();
  const state = createTraffic(track, 'motorway', rng(7));
  drive(state, track, 60);
  assert.ok(state.list.length > 5);
  assert.ok(state.list.every(v => v.kind !== 'bike' && v.dir === 1));
  assert.ok(state.list.some(v => v.kind === 'container'));
});

test('a closed circuit has no traffic at all', () => {
  const track = hydrateTrack(syntheticTrackJson('loop'));
  const state = createTraffic(track, null, rng(1));
  drive(state, track, 30);
  assert.equal(state.list.length, 0);
});

test('vehicles move with their direction and are despawned once far behind the player', () => {
  const track = longTrack();
  const state = createTraffic(track, 'passLight', rng(9));
  drive(state, track, 20);
  const snapshot = state.list.map(v => ({ v, z: v.z }));
  updateTraffic(state, track, 600, CFG.STEP);
  for (const { v, z } of snapshot) if (state.list.includes(v)) assert.ok(Math.abs(v.z - z - v.dir * v.v * CFG.STEP) < 1e-6, `${v.kind} di chuyển theo dir`);
  const far = drive(state, track, 200);
  assert.ok(state.list.every(v => v.z > far - CFG.TRAFFIC.WINDOW_BACK - 1 && v.z < far + CFG.TRAFFIC.ONCOMING_AHEAD + 1), 'trong cửa sổ quanh người chơi');
  assert.ok(state.list.every(v => v.dir === -1 || v.z > far - CFG.TRAFFIC.WINDOW_BACK - 1));
});

test('nothing spawns right in front of the player', () => {
  const track = longTrack();
  const state = createTraffic(track, 'passBus', rng(11));
  for (let t = 0; t < 30; t += CFG.STEP) {
    updateTraffic(state, track, 100 + t * 25, CFG.STEP);
    for (const v of state.list) if (v.justSpawned) assert.ok(v.z - (100 + t * 25) >= CFG.TRAFFIC.MIN_SPAWN_AHEAD - 1e-6 || v.z < 100 + t * 25, `spawn quá gần: ${v.z}`);
  }
});
