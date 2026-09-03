// Orchestrator cuộc đua (thuần): trạng thái xe người chơi, pha đếm ngược → đua → về đích, vòng, sector, snapshot cho HUD.
import { CFG } from './config.js';
import { carById, fieldFor } from './cars.js';
import { makeDriver, aiDecide } from './ai.js';
import { preparedCar } from './calibrate.js';
import { muFor, stepLongitudinal, stepLateral } from './physics.js';
import { resolveBarrier, resolveCarCar, resolveCarTraffic } from './collision.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { segAt, vMax, distToFinish, nextCorner, wrapZ } from './track.js';
import { WEATHER } from './weather.js';
import { rng } from './util.js';

const SURFACE_KEY = ['asphalt', 'rough', 'concrete', 'gravel'];

export function makeCar(spec, P, { z = 0, x = 0, paint = '#fff', isPlayer = false } = {}) {
  return {
    spec, P, z, x, v: 0, a: 0, aTyre: 0, aAct: 0, excess: 0, vLat: 0, heading: 0, lap: 0, sector: 0, sectorTimes: [], lapSectors: [], lapStart: 0,
    powerW: 0, offroad: false, slideT: 0, stunT: 0, paint, isPlayer, finishTime: null, braking: false, driver: null,
    m: P.m, len: spec.lengthMm / 1000, w: spec.widthMm / 1000, seg: null,
  };
}

const progressOf = (track, c) => c.lap * track.lengthM + c.z;

/** Bề mặt và môi trường dưới một xe tại vị trí (z, x). */
export function envAt(track, weather, carSpec, z, x) {
  const seg = segAt(track, z);
  const ax = Math.abs(x);
  let key;
  if (ax <= seg.halfM) key = SURFACE_KEY[seg.surface] || 'asphalt';
  else if (ax <= seg.halfM + (x < 0 ? track.road.shoulderL : track.road.shoulderR)) key = 'gravel';
  else key = 'grass';
  const offroad = key === 'grass';
  return { seg, key, mu: muFor(key, weather, carSpec), slope: seg.slope, crr: CFG.PHYS.MU[key].crr, offroad };
}

export function createRace({ track, carId, paint, settings = {}, seed = 1, weatherId, bestSectors = [] }) {
  const spec = carById(carId), P = preparedCar(spec);
  const weather = WEATHER[weatherId] || WEATHER[track.weatherPresets[0]] || WEATHER.clear;
  const random = rng(seed);
  const player = makeCar(spec, P, { z: 0, x: 0, paint, isPlayer: true });
  const cars = [];
  if (!settings.practice) {
    const field = fieldFor(carId, settings.mixedField);
    const count = !track.road.twoWay && track.road.lanes >= 3 ? CFG.FIELD.AI_COUNT_MOTORWAY : CFG.FIELD.AI_COUNT;
    for (let i = 0; i < count; i++) {
      const aiSpec = field[Math.floor(random() * field.length)];
      const c = makeCar(aiSpec, preparedCar(aiSpec), { z: (i + 1) * CFG.FIELD.GRID_GAP, x: i % 2 ? CFG.FIELD.GRID_X : -CFG.FIELD.GRID_X, paint: aiSpec.paints[Math.floor(random() * aiSpec.paints.length)].hex });
      c.driver = makeDriver(random);
      cars.push(c);
    }
  }
  const trafficState = createTraffic(track, settings.practice ? null : track.trafficProfile, random, settings.trafficDensity || 1);
  const race = {
    track, spec, weather, settings, random, player,
    cars, traffic: trafficState.list, occupied: new Set(), trafficState,
    phase: 'countdown', countdown: CFG.RACE.COUNTDOWN, time: 0, clock: 0,
    finished: false, reported: false, finishHold: 0, incidents: 0, autopilot: false,
    toast: null, sectorMsg: null,
  };

  function recordSector(car, z) {
    const sz = track.sectorsZ;
    while (car.sector < sz.length && z >= sz[car.sector]) {
      const t = race.time - car.lapStart - car.sectorTimes.reduce((a, b) => a + b, 0);
      car.sectorTimes.push(t);
      if (car.isPlayer) race.sectorMsg = { index: car.sector + 1, time: t, delta: bestSectors[car.sector] != null ? t - bestSectors[car.sector] : null, until: race.time + 3 };
      car.sector++;
    }
  }
  function completeLap(car) {
    const last = race.time - car.lapStart - car.sectorTimes.reduce((a, b) => a + b, 0);
    car.sectorTimes.push(last);
    car.lapSectors.push(car.sectorTimes);
    car.sectorTimes = []; car.sector = 0; car.lapStart = race.time; car.lap++;
  }

  function updatePlayer(input, dt) {
    const p = player;
    const env = envAt(track, weather, spec, p.z, p.x);
    let inp = input;
    if (race.autopilot) { p.driver ||= makeDriver(random); inp = aiDecide(p, { track, mu: env.mu, player: null, cars, traffic: race.traffic, time: race.time, random }, dt); if (race.time < p.driver.launchDelay) inp = { steer: 0, throttle: 0, brake: 0 }; }
    if (race.phase === 'finished') inp = { steer: 0, throttle: 0, brake: 0.4 };
    if (p.forcedBrakeT > 0) { p.forcedBrakeT = p.v > CFG.COLLISION.BIKE_TARGET_KMH / 3.6 ? Math.max(0, p.forcedBrakeT - dt) : 0; if (p.forcedBrakeT > 0) inp = { ...inp, throttle: 0, brake: 1 }; }
    if (p.stunT > 0) p.stunT = Math.max(0, p.stunT - dt);
    const out = stepLongitudinal(P, p.v, inp, env, dt, p.a);
    p.v = out.v; p.a = out.a; p.aTyre = out.aTyre; p.powerW = out.powerW; p.offroad = env.offroad;
    stepLateral(P, p, p.stunT > 0 ? 0 : inp.steer || 0, env.seg.kappa, env.mu, dt);
    const hit = resolveBarrier(p, track.road, dt);
    if (hit && hit !== 'rub') { race.incidents++; race.toast = { text: hit === 'hard' ? 'ĐÂM RÀO' : 'QUỆT RÀO', until: race.time + 1.5 }; }
    p.heading += env.seg.kappa * p.v * dt;
    let z = p.z + p.v * dt;
    if (race.phase === 'racing') {
      recordSector(p, z);
      if (z >= track.lengthM) {
        completeLap(p);
        if (track.kind === 'loop' && p.lap < track.laps) { z -= track.lengthM; race.toast = { text: p.lap === track.laps - 1 ? 'VÒNG CUỐI' : `VÒNG ${p.lap + 1}`, until: race.time + 1.5 }; }
        else { race.phase = 'finished'; p.finishTime = race.time; race.toast = { text: 'VỀ ĐÍCH', until: race.time + 3 }; }
      }
    } else if (track.kind === 'loop' && z >= track.lengthM) z -= track.lengthM;
    p.z = z;
  }

  function updateAI(c, dt) {
    if (c.gone) return;
    if (c.finishTime != null) { // về đích: chạy tiếp cho tới khi khuất rồi biến mất, không chặn đường
      const env0 = envAt(track, weather, c.spec, c.z, c.x);
      const out0 = stepLongitudinal(c.P, c.v, { throttle: c.v < 20 ? 0.5 : 0, brake: 0 }, env0, dt, c.a);
      c.v = out0.v; c.a = out0.a; c.z += c.v * dt;
      if (track.kind === 'loop' ? c.z > track.lengthM * 0.05 : c.z > track.lengthM + 150) c.gone = true;
      return;
    }
    const env = envAt(track, weather, c.spec, c.z, c.x);
    const ctx = { track, mu: env.mu, player, cars, traffic: race.traffic, time: race.time, random };
    let inp = aiDecide(c, ctx, dt);
    if (race.time < c.driver.launchDelay) inp = { steer: 0, throttle: 0, brake: 0 };
    if (c.stunT > 0) { c.stunT = Math.max(0, c.stunT - dt); inp = { ...inp, steer: 0 }; }
    if (c.forcedBrakeT > 0) { c.forcedBrakeT = c.v > CFG.COLLISION.BIKE_TARGET_KMH / 3.6 ? Math.max(0, c.forcedBrakeT - dt) : 0; if (c.forcedBrakeT > 0) inp = { ...inp, throttle: 0, brake: 1 }; }
    const out = stepLongitudinal(c.P, c.v, inp, env, dt, c.a);
    c.v = out.v; c.a = out.a; c.aTyre = out.aTyre; c.powerW = out.powerW; c.offroad = env.offroad; c.braking = inp.brake > 0;
    stepLateral(c.P, c, inp.steer, env.seg.kappa, env.mu, dt);
    resolveBarrier(c, track.road, dt);
    let z = c.z + c.v * dt;
    recordSector(c, z);
    if (z >= track.lengthM) {
      completeLap(c);
      if (track.kind === 'loop' && c.lap < track.laps) z -= track.lengthM; else c.finishTime = race.time;
    }
    c.z = z;
  }

  function collide(a, b) {
    const dz = dzNorm(b.z - a.z);
    if (Math.abs(dz) >= (a.len + b.len) / 2) return null;
    const bz = b.z; b.z = a.z + dz; // tạm chuẩn hoá cho loop
    const hit = resolveCarCar(a, b);
    if (track.kind === 'loop') { b.z = wrapZ(track, b.z); a.z = wrapZ(track, a.z); } else if (hit == null) b.z = bz;
    return hit;
  }
  const dzNorm = dz => { if (track.kind !== 'loop') return dz; if (dz > track.lengthM / 2) return dz - track.lengthM; if (dz < -track.lengthM / 2) return dz + track.lengthM; return dz; };

  function rebuildOccupancy() {
    for (const s of race.occupied) s.cars.length = 0;
    race.occupied.clear();
    for (const c of [...cars, ...race.traffic]) { if (c.gone) continue; const s = segAt(track, c.z); s.cars.push(c); race.occupied.add(s); c.seg = s; }
  }

  race.update = (input, dt) => {
    race.clock += dt;
    if (race.phase === 'countdown') {
      race.countdown -= dt;
      if (race.countdown <= 0) { race.phase = 'racing'; race.time = 0; player.lapStart = 0; }
      rebuildOccupancy();
      return;
    }
    race.time += dt;
    updatePlayer(input, dt);
    for (const c of cars) updateAI(c, dt);
    updateTraffic(trafficState, track, player.z, dt);
    race.traffic = trafficState.list;
    for (const c of [player, ...cars]) {
      if (c.finishTime != null || c.gone) continue;
      for (const t of race.traffic) {
        const dz = dzNorm(t.z - c.z);
        if (Math.abs(dz) >= (c.len + t.len) / 2) continue;
        const hit = resolveCarTraffic(c, t);
        if (hit && hit !== 'nudge' && c === player) { race.incidents++; race.toast = { text: { bike: 'TAI NẠN XE MÁY', headon: 'ĐỐI ĐẦU', rear: 'VA CHẠM', side: 'QUỆT XE' }[hit], until: race.time + 1.5 }; }
        if (hit === 'bike' && c !== player) c.forcedBrakeT = CFG.COLLISION.BIKE_BRAKE_T;
      }
    }
    const all = [player, ...cars.filter(c => !c.gone)];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const hit = collide(all[i], all[j]);
      if (hit && hit !== 'nudge' && (all[i] === player || all[j] === player)) { race.incidents++; race.toast = { text: hit === 'rear' ? 'VA CHẠM' : 'QUỆT XE', until: race.time + 1.2 }; }
    }
    rebuildOccupancy();
    if (race.phase === 'finished') { race.finishHold += dt; if (race.finishHold >= CFG.RACE.FINISH_HOLD) race.finished = true; }
  };

  race.position = () => 1 + race.cars.filter(c => progressOf(track, c) > progressOf(track, player)).length;

  race.snapshot = () => {
    const p = player, env = envAt(track, weather, spec, p.z, p.x);
    let warn = null;
    if (race.phase === 'racing') {
      const dBrake = (p.v * p.v) / (2 * 0.8 * env.mu * CFG.G);
      const c = nextCorner(track, p.z, dBrake + 50, 1 / 40);
      if (c && p.v > 0.9 * vMax(c.kappa, env.mu)) warn = { dir: Math.sign(c.kappa), text: Math.abs(c.kappa) > 1 / 20 ? 'Cua gấp' : 'Cua', distance: c.distance };
    }
    return {
      kmh: p.v * 3.6, powerFrac: p.powerW / (spec.powerKw * 1000), pos: race.position(), total: 1 + race.cars.length,
      time: race.phase === 'countdown' ? 0 : (p.finishTime ?? race.time), lap: Math.min(p.lap + 1, track.laps), laps: track.laps, kind: track.kind,
      distToFinish: track.kind === 'loop' ? track.lengthM - p.z : distToFinish(track, p.z),
      weather: weather.label, sub: `${spec.name} · ${track.name}`, warn, toast: race.toast, sector: race.sectorMsg, phase: race.phase, countdown: race.countdown,
      offroad: p.offroad, mu: env.mu, surface: env.key, incidents: race.incidents, sliding: p.slideT > 0, excess: p.excess, rain: weather.rain,
    };
  };

  race.result = () => ({
    pos: race.position(), total: 1 + race.cars.length, time: player.finishTime ?? race.time, laps: track.laps,
    sectors: (player.lapSectors[player.lapSectors.length - 1] || player.sectorTimes).slice(0, 3), incidents: race.incidents, weather: weather.label,
  });
  return race;
}
