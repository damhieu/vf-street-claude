// Vật lý thuần (không DOM). Đơn vị SI: m, s, m/s, N, kg. Bước cố định dt.
import { CFG } from './config.js';
import { wheelRadiusM } from './cars.js';
import { clamp } from './util.js';

export const DRIVER_KG = 75;

/** Hệ số bám hiệu dụng = bám mặt đường × hệ số thời tiết × hệ số lốp/xe. */
export function muFor(surface, weather, car) {
  const base = (CFG.PHYS.MU[surface] ?? CFG.PHYS.MU.asphalt).mu;
  return base * (weather?.muMult ?? 1) * car.gripFactor;
}

/** Tham số dẫn xuất của một xe với hiệu suất η đã hiệu chỉnh. */
export function prepareCar(car, eta) {
  const m = car.massKg + DRIVER_KG;
  const pMech = car.powerKw * 1000 * eta;
  const vBase = (car.torqueBaseKmh ?? CFG.PHYS.TORQUE_BASE_KMH) / 3.6;
  return {
    car, m, eta, pMech,
    f0: pMech / vBase, // lực kéo tối đa vùng giới hạn mô-men (kết thúc ở vBase)
    vLim: car.vLimKmh / 3.6,
    rW: wheelRadiusM(car),
    share: car.drive === 'AWD' ? 1 : car.staticShare,
    hOverWb: car.hCg / (car.wheelbaseMm / 1000),
    drive: car.drive,
    rMin: (car.wheelbaseMm / 1000) / Math.tan((CFG.PHYS.R_MIN_STEER_DEG * Math.PI) / 180),
    tauResp: CFG.PHYS.TAU_RESP_BASE + CFG.PHYS.TAU_RESP_PER_TONNE * (m / 1000 - 1.2),
  };
}

/**
 * Một bước dọc. env = { mu, slope (dy/dx), crr (mặt đường), offroad }.
 * aPrev: gia tốc bước trước (chuyển tải trọng lên cầu dẫn động).
 * Trả về { v, a, aTyre, powerW, limited }.
 */
export function stepLongitudinal(P, v, input, env, dt, aPrev = 0) {
  const g = CFG.G, m = P.m;
  const theta = Math.atan(env.slope || 0);
  const throttle = input.throttle || 0, brake = input.brake || 0;

  let fTrac = 0;
  if (throttle > 0 && v < P.vLim) {
    const fMotor = Math.min(P.f0, P.pMech / Math.max(v, 0.5));
    let n = m * g * P.share;
    if (P.drive === 'FWD') n -= m * aPrev * P.hOverWb;
    else if (P.drive === 'RWD') n += m * aPrev * P.hOverWb;
    fTrac = Math.min(throttle * fMotor, env.mu * Math.max(0, n));
  }
  const moving = v > 0;
  const fAero = 0.5 * CFG.RHO_AIR * P.car.cdA * v * v;
  const fRoll = moving ? Math.max(P.car.crr, env.crr || 0) * m * g * Math.cos(theta) : 0;
  const fGrade = m * g * Math.sin(theta);
  const fBrake = moving ? brake * m * Math.min(CFG.PHYS.BRAKE_G_CAP * g, env.mu * g) : 0;
  const fCoast = moving && throttle === 0 && brake === 0 ? CFG.PHYS.COAST_G * m * g : 0;
  const fOff = env.offroad && v > CFG.PHYS.OFFROAD_EXTRA_FROM_KMH / 3.6 ? m * CFG.PHYS.OFFROAD_EXTRA_DECEL : 0;

  const a = (fTrac - fBrake - fCoast - fAero - fRoll - fGrade - fOff) / (m * CFG.PHYS.ROT_INERTIA);
  let vNew = v + a * dt;
  if (vNew < 0) vNew = 0;
  let limited = false;
  if (vNew > P.vLim) { vNew = Math.min(vNew, Math.max(P.vLim, v)); limited = true; } // cắt ga / regen giữ vLim khi xuống dốc

  const regenCap = P.car.powerKw * 1000 * 0.5;
  const powerW = fTrac > 0 ? fTrac * v : -Math.min(regenCap, (fBrake + fCoast) * v);
  return { v: vNew, a: (vNew - v) / dt, aTyre: (fTrac - fBrake) / m, powerW, limited };
}

/** Gia tốc ngang tối đa vô lăng có thể đòi hỏi: bán kính quay ở tốc độ thấp, quá bám ở tốc độ cao. */
export function steerCap(P, v, mu) {
  return Math.min(CFG.PHYS.STEER_OVER * mu * CFG.G, (v * v) / P.rMin);
}

/**
 * Một bước ngang (mutate s = { v, x, vLat, aAct, aTyre, slideT }).
 * steer ∈ [-1, 1] (+ phải), kappa theo quy ước game (+ cua phải), mu = bám hiệu dụng.
 * Vòng tròn ma sát: phần bám còn lại cho ngang = sqrt((μg)² − aTyre²).
 */
export function stepLateral(P, s, steer, kappa, mu, dt) {
  const muG = mu * CFG.G;
  const sliding = s.slideT > 0;
  const gain = sliding ? 1 - (1 - CFG.PHYS.STEER_GAIN_SLIDE) * clamp((s.excess || 0) / 2, 0, 1) : 1;
  const aCmd = steer * steerCap(P, s.v, mu) * gain;
  let aAvail = Math.sqrt(Math.max(0, muG * muG - s.aTyre * s.aTyre));
  if (sliding) aAvail *= CFG.PHYS.MU_SLIDE;
  const aTarget = clamp(aCmd, -aAvail, aAvail);
  s.aAct += (aTarget - s.aAct) * Math.min(1, dt / P.tauResp);
  const excess = Math.max(0, Math.abs(aCmd) - aAvail);
  const aRel = s.aAct - s.v * s.v * kappa; // "ly tâm": xe không theo kịp cua thì trôi ra ngoài
  s.vLat += aRel * dt;
  s.vLat *= Math.exp(-dt / CFG.PHYS.TAU_DAMP);
  s.x += s.vLat * dt;
  if (excess > CFG.PHYS.SLIDE_THRESHOLD) { s.slideT = CFG.PHYS.SLIDE_T; s.v = Math.max(0, s.v - CFG.PHYS.SCRUB * excess * dt); }
  else if (s.slideT > 0) s.slideT = Math.max(0, s.slideT - dt);
  s.excess = excess;
  return { aCmd, aAvail, excess, aRel };
}
