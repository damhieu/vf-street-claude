// Giao thông công cộng kiểu Việt Nam (thuần): loại xe, mật độ theo profile, hai chiều, kỷ luật làn, spawn/despawn quanh người chơi.
import { CFG } from './config.js';
import { segAt } from './track.js';

export const VEHICLE_TYPES = {
  bike: { w: 0.7, len: 1.9, m: 180, kmh: [35, 55], mw: null, colors: ['#c0392b', '#2c3e50', '#7f8c8d', '#f39c12', '#ecf0f1', '#1f4fd1'] },
  car: { w: 1.8, len: 4.5, m: 1400, kmh: [50, 75], mw: [100, 120], colors: ['#ecf0f1', '#2c3e50', '#95a5a6', '#c0392b', '#1f4fd1', '#7f8c8d'] },
  coach: { w: 2.5, len: 11, m: 12000, kmh: [45, 65], mw: [80, 90], colors: ['#e67e22', '#2980b9', '#27ae60', '#ecf0f1'] },
  truck: { w: 2.4, len: 8, m: 9000, kmh: [40, 60], mw: [80, 80], uphill: [25, 35], colors: ['#2980b9', '#27ae60', '#7f8c8d', '#c0392b'] },
  container: { w: 2.5, len: 16, m: 25000, kmh: null, mw: [70, 80], colors: ['#c0392b', '#2980b9', '#95a5a6', '#f39c12'] },
};

export const PROFILES = {
  passBikes: { density: 3, mix: { bike: 0.5, car: 0.2, coach: 0.15, truck: 0.15 }, oncoming: true },
  passLight: { density: 2, mix: { bike: 0.5, car: 0.2, coach: 0.15, truck: 0.15 }, oncoming: true },
  passBus: { density: 3, mix: { bike: 0.3, car: 0.2, coach: 0.3, truck: 0.2 }, oncoming: true },
  motorway: { density: 8, mix: { car: 0.6, coach: 0.25, container: 0.15 }, oncoming: false },
};

const T = CFG.TRAFFIC;
const pickKind = (mix, r) => { let acc = 0; for (const [k, p] of Object.entries(mix)) { acc += p; if (r < acc) return k; } return Object.keys(mix)[0]; };
const between = ([a, b], r) => a + (b - a) * r;

export function createTraffic(track, profileId, random, densityMult = 1) {
  const profile = profileId && track.kind !== 'loop' ? PROFILES[profileId] : null;
  return { profile, random, densityMult, list: [], spawned: { same: 0, oncoming: 0 }, frontierSame: null, frontierOnc: null, motorway: !track.road.twoWay };
}

function spawn(state, track, z, dir) {
  const r = state.random, profile = state.profile;
  const kind = pickKind(profile.mix, r());
  const type = VEHICLE_TYPES[kind];
  const seg = segAt(track, z), halfM = seg.halfM, lanes = track.road.lanes, laneW = (2 * halfM) / lanes;
  let x, lane = 0;
  if (state.motorway) {
    lane = kind === 'truck' || kind === 'container' ? 0 : r() < 0.7 ? 0 : 1; // 0 = làn phải ngoài cùng
    x = halfM - laneW / 2 - lane * laneW;
  } else if (kind === 'bike') x = dir * (halfM - 0.6);
  else x = dir * (halfM / 2);
  const range = state.motorway ? type.mw : type.kmh;
  const v = between(range, r()) / 3.6;
  const veh = { kind, dir, z, x, lane, v, vBase: v, w: type.w, len: type.len, m: type.m, color: type.colors[Math.floor(r() * type.colors.length)], vLat: 0, stunT: 0, dead: false, justSpawned: true, wobble: r() * 6.28 };
  state.list.push(veh);
  if (dir === 1) state.spawned.same++; else state.spawned.oncoming++;
}

export function updateTraffic(state, track, playerZ, dt) {
  if (!state.profile) return;
  const meanGap = 1000 / (state.profile.density * state.densityMult);
  for (const v of state.list) {
    v.justSpawned = false;
    if (v.stunT > 0) v.stunT = Math.max(0, v.stunT - dt);
    const type = VEHICLE_TYPES[v.kind];
    let target = v.vBase;
    if (type.uphill && v.dir === 1 && segAt(track, v.z).slope > 0.06) target = between(type.uphill, 0.5) / 3.6;
    v.v += (target - v.v) * Math.min(1, dt / 2);
    v.z += v.dir * v.v * dt;
    if (v.kind === 'bike') { v.wobble += dt * 1.5; v.x += Math.sin(v.wobble) * 0.15 * dt; }
  }
  state.list = state.list.filter(v => !v.dead && v.z > playerZ - T.WINDOW_BACK && v.z < playerZ + T.ONCOMING_AHEAD + 100 && (v.dir === 1 || v.z > playerZ - 30));
  if (state.frontierSame == null) { state.frontierSame = playerZ + T.MIN_SPAWN_AHEAD; state.frontierOnc = playerZ + T.MIN_SPAWN_AHEAD; }
  const limit = track.kind === 'loop' ? Infinity : track.lengthM - 20;
  while (state.frontierSame < playerZ + T.WINDOW_AHEAD) {
    state.frontierSame += Math.max(T.MIN_GAP, -Math.log(1 - state.random()) * meanGap);
    if (state.frontierSame >= limit) { state.frontierSame = Infinity; break; }
    if (state.frontierSame >= playerZ + T.MIN_SPAWN_AHEAD) spawn(state, track, state.frontierSame, 1);
  }
  if (state.profile.oncoming) {
    while (state.frontierOnc < playerZ + T.ONCOMING_AHEAD) {
      state.frontierOnc += Math.max(T.MIN_GAP, -Math.log(1 - state.random()) * meanGap);
      if (state.frontierOnc >= limit) { state.frontierOnc = Infinity; break; }
      if (state.frontierOnc >= playerZ + T.MIN_SPAWN_AHEAD) spawn(state, track, state.frontierOnc, -1);
    }
  }
  if (state.frontierOnc !== Infinity && state.frontierOnc < playerZ + T.MIN_SPAWN_AHEAD) state.frontierOnc = playerZ + T.MIN_SPAWN_AHEAD;
}
