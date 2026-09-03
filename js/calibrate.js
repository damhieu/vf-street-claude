// Hiệu chỉnh hiệu suất η để 0–100 km/h khớp số công bố; các phép đo thẳng phẳng khô.
import { CFG } from './config.js';
import { muFor, prepareCar, stepLongitudinal } from './physics.js';

const DRY = { muMult: 1 };
const flatEnv = car => ({ mu: muFor('asphalt', DRY, car), slope: 0, crr: CFG.PHYS.MU.asphalt.crr, offroad: false });
const cross = (t, dt, vPrev, v, target) => t - ((v - target) / (v - vPrev)) * dt;

/** Đề-pa ga hết trên đường phẳng khô. Trả về { t0050, t0100 } (giây, nội suy trong bước). */
export function simulateSprint(car, eta, { maxT = 60 } = {}) {
  const P = prepareCar(car, eta), env = flatEnv(car), dt = CFG.STEP;
  let v = 0, a = 0, t = 0, t0050 = null, t0100 = null;
  const v50 = 50 / 3.6, v100 = 100 / 3.6;
  while (t < maxT && t0100 == null) {
    const out = stepLongitudinal(P, v, { throttle: 1, brake: 0 }, env, dt, a);
    const vPrev = v;
    v = out.v; a = out.a; t += dt;
    if (t0050 == null && v >= v50) t0050 = cross(t, dt, vPrev, v, v50);
    if (v >= v100 - 1e-9) t0100 = v > vPrev ? cross(t, dt, vPrev, v, v100) : t;
  }
  return { t0050, t0100: t0100 ?? Infinity };
}

/** Bisection η sao cho t0100 mô phỏng = công bố. Không có công bố → 0,7. */
export function calibrateEta(car) {
  if (car.t0100 == null) return 0.7;
  let lo = 0.2, hi = 1.5;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (simulateSprint(car, mid).t0100 > car.t0100) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Tốc độ sau 120 s ga hết trên đường phẳng khô (m/s). */
export function topSpeed(car, eta) {
  const P = prepareCar(car, eta), env = flatEnv(car), dt = CFG.STEP;
  let v = 0, a = 0;
  for (let t = 0; t < 120; t += dt) { const out = stepLongitudinal(P, v, { throttle: 1, brake: 0 }, env, dt, a); v = out.v; a = out.a; }
  return v;
}

const cache = new Map();
/** prepareCar với η đã hiệu chỉnh, cache theo id. */
export function preparedCar(car) {
  if (!cache.has(car.id)) cache.set(car.id, prepareCar(car, calibrateEta(car)));
  return cache.get(car.id);
}
