// Tay đua AI (thuần): cùng vật lý với người chơi; phanh theo cua, giữ/đổi làn, vượt sang làn ngược, chặn khi bị áp sát.
import { CFG } from './config.js';
import { clamp } from './util.js';
import { steerCap } from './physics.js';
import { segAt, kappaAt, vMax, nextCorner } from './track.js';

const A = CFG.AI;

export function makeDriver(random) {
  const pick = ([a, b]) => a + (b - a) * random();
  return {
    cornerFrac: pick(A.CORNER_FRAC), brakeFrac: pick(A.BRAKE_FRAC), aggression: pick(A.AGGRESSION), noise: 0,
    nextDecision: 0, xTarget: null, overtaking: null, blockUntil: 0, blockCooldownUntil: 0, blockX: 0, speedCap: Infinity,
    launchDelay: pick(A.LAUNCH_DELAY), out: { steer: 0, throttle: 0, brake: 0 },
  };
}

/** Tốc độ mục tiêu: tối thiểu trên vùng phanh của sqrt((cornerFrac·vMax_j)² + 2·brakeFrac·μg·d_j), kẹp bởi vLim. */
export function targetSpeed(track, z, v, mu, driver, P) {
  const g = CFG.G;
  const dBrake = (v * v) / (2 * driver.brakeFrac * mu * g) + A.LOOKAHEAD_EXTRA;
  let target = P.vLim;
  for (let d = 0; d <= dBrake; d += track.L) {
    const k = kappaAt(track, z + d);
    if (Math.abs(k) < 1e-6) continue;
    const vc = driver.cornerFrac * vMax(k, mu) * (1 + driver.noise);
    target = Math.min(target, Math.sqrt(vc * vc + 2 * A.BRAKE_PLAN * driver.brakeFrac * mu * g * d));
  }
  return target;
}

const dzAhead = (track, from, to) => { let dz = to - from; if (track.kind === 'loop') { if (dz < -track.lengthM / 2) dz += track.lengthM; if (dz > track.lengthM / 2) dz -= track.lengthM; } return dz; };

/** Quyết định ga/phanh/lái; tính lại ở A.HZ Hz, giữa các lần giữ nguyên. ctx = { track, mu, player, cars, traffic, time, random }. */
export function aiDecide(car, ctx, dt) {
  const d = car.driver, { track, mu } = ctx;
  if (ctx.time < d.nextDecision) return d.out;
  d.nextDecision = ctx.time + 1 / A.HZ;
  const P = car.P, v = car.v, seg = segAt(track, car.z), halfM = seg.halfM, twoWay = track.road.twoWay, lanes = track.road.lanes;
  const laneW = (2 * halfM) / lanes;
  const rightLane = halfM - laneW / 2, leftLane = -halfM + laneW / 2;
  if (ctx.random) d.noise = (ctx.random() - 0.5) * 2 * A.CORNER_NOISE;
  let target = targetSpeed(track, car.z, v, mu, d, P);

  // xe phía trước cùng làn (cùng chiều)
  const laneX = d.xTarget ?? car.x;
  const others = [...ctx.cars.filter(c => c !== car), ...(ctx.player ? [ctx.player] : []), ...ctx.traffic.filter(t => t.dir !== -1)];
  let ahead = null, aheadDz = Infinity;
  for (const o of others) {
    const dz = dzAhead(track, car.z, o.z);
    if (dz <= 0 || dz > 80 || dz >= aheadDz) continue;
    if (Math.abs(o.x - laneX) > laneW * 0.55 + 0.5) continue;
    ahead = o; aheadDz = dz;
  }
  d.speedCap = Infinity;
  const aheadLen = ahead ? (ahead.len ?? (ahead.spec ? ahead.spec.lengthMm / 1000 : 4.5)) : 0;
  if (ahead && !d.overtaking) {
    const gap = aheadDz - aheadLen, wanted = A.GAP_TIME * v + 5;
    if (gap < wanted) d.speedCap = Math.max(0, ahead.v * clamp(gap / wanted, 0.3, 1) - (gap < wanted * 0.4 ? 2 : 0)); // thiếu gap → chạy chậm hơn xe trước để mở lại
  }

  // làn mặc định; đường hai chiều: racing line (phía trong cua) khi làn ngược trống trong 250 m, không thì làn phải
  let xLane;
  if (twoWay) {
    const c = nextCorner(track, car.z, 150, 1 / 80);
    const oncomingNear = ctx.traffic.some(o => o.dir === -1 && dzAhead(track, car.z, o.z) > -20 && dzAhead(track, car.z, o.z) < 250);
    xLane = c && !oncomingNear ? -Math.sign(c.kappa) * 0.35 * halfM : rightLane;
  }
  else if (track.kind === 'loop') { const c = nextCorner(track, car.z, 120, 1 / 80); xLane = c ? -Math.sign(c.kappa) * 0.35 * halfM : 0; }
  else xLane = d.xTarget ?? rightLane;

  // vượt
  if (d.overtaking) {
    const dz = dzAhead(track, car.z, d.overtaking.z);
    if (dz < -(aheadLen + 8) || dz > 120) d.overtaking = null;
    else {
      xLane = twoWay ? leftLane : Math.max(leftLane, xLane - laneW);
      // chưa lệch hẳn khỏi xe trước thì vẫn bám sau (không húc đuôi)
      const clearLat = Math.abs(car.x - d.overtaking.x) >= ((d.overtaking.w ?? 1.8) + car.w) / 2 + 0.3;
      if (!clearLat && dz > 0) { const gap = dz - aheadLen, wanted = A.GAP_TIME * v + 5; d.speedCap = gap < wanted ? Math.max(6, d.overtaking.v * clamp(gap / wanted, 0.3, 1)) : Infinity; } // bò ≥ 6 m/s để lách được xe dừng
    }
  } else if (ahead && ahead.v < Math.min(target, Math.max(v, 8)) - A.OVERTAKE_DV_KMH / 3.6) { // so với tốc độ muốn đi, không phải tốc độ hiện tại
    let clear = true;
    if (twoWay) {
      const tPass = (aheadDz + aheadLen + 10) / Math.max(3, v - ahead.v);
      for (const o of ctx.traffic) {
        if (o.dir !== -1) continue;
        const dz = dzAhead(track, car.z, o.z);
        if (dz > 0 && dz < (v + o.v) * tPass * (2.5 - d.aggression)) { clear = false; break; }
      }
    } else {
      const lx = Math.max(leftLane, xLane - laneW);
      clear = !others.some(o => Math.abs(o.x - lx) < laneW * 0.55 && Math.abs(dzAhead(track, car.z, o.z)) < 30);
      if (clear) xLane = lx;
    }
    if (clear) { d.overtaking = ahead; if (twoWay) xLane = leftLane; const clearLat = Math.abs(car.x - ahead.x) >= ((ahead.w ?? 1.8) + car.w) / 2 + 0.3; d.speedCap = clearLat ? Infinity : Math.max(6, d.speedCap); }
  }

  // chặn người chơi đang áp sát
  const pl = ctx.player;
  if (pl && !d.overtaking && ctx.time >= d.blockCooldownUntil) {
    const dzP = dzAhead(track, pl.z, car.z);
    if (dzP > 0 && dzP < A.BLOCK_DIST && pl.v > v + 0.5 && v <= target) {
      d.blockX = clamp(pl.x, -halfM + 1, halfM - 1); d.blockUntil = ctx.time + 1.2; d.blockCooldownUntil = ctx.time + A.BLOCK_COOLDOWN;
    }
  }
  if (ctx.time < d.blockUntil) xLane = d.blockX;

  // né ngang xe chạy song song: giữ ≥ 2 m tim-tim, dịch về phía trống trong mặt đường
  const CLEAR = 2.0;
  for (const o of others) {
    const dz = Math.abs(dzAhead(track, car.z, o.z));
    if (dz > (o.len ?? 4.5) + 2) continue;
    if (Math.abs(o.x - xLane) >= CLEAR) continue;
    const away = car.x >= o.x ? 1 : -1;
    xLane = clamp(o.x + away * CLEAR, -halfM + 0.9, halfM - 0.9);
  }

  if (d.xTarget == null) d.xTarget = xLane;
  else { const step = (ctx.time < d.blockUntil ? A.BLOCK_RATE : 3) / A.HZ; d.xTarget += clamp(xLane - d.xTarget, -step, step); }

  // lái: theo cua + về xTarget, không đòi quá phần bám ngang còn lại (vòng tròn ma sát)
  const muG = mu * CFG.G;
  let aAvail = Math.sqrt(Math.max(0, muG * muG - car.aTyre * car.aTyre)) * A.LATERAL_USE;
  if (car.slideT > 0) aAvail *= CFG.PHYS.MU_SLIDE * 0.9; // đang trượt: nhả bớt để lấy lại bám
  const kappaFF = kappaAt(track, car.z + v * 1.5 * P.tauResp); // đánh lái sớm bù trễ đáp ứng
  const aCmd = clamp(v * v * kappaFF + A.KP * (d.xTarget - car.x) - A.KD * car.vLat, -aAvail, aAvail);
  const cap = steerCap(P, v, mu);
  const steer = cap > 1e-6 ? clamp(aCmd / cap, -1, 1) : 0;
  target = Math.min(target, d.speedCap);
  // ga giảm dần khi cua ăn nhiều bám ngang
  const lateralUse = Math.abs(v * v * seg.kappa) / muG;
  const throttleCap = 1 - clamp((lateralUse - 0.5) / 0.45, 0, 0.85);
  const throttle = v < target - 0.5 ? throttleCap : 0;
  const brake = v > target ? clamp((v - target) * A.BRAKE_GAIN, A.BRAKE_MIN, 1) : 0;
  d.out = { steer, throttle, brake };
  return d.out;
}
