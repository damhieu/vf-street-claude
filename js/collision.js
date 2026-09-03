// Va chạm (thuần): rào chắn/taluy; xe–xe và xe–giao thông bổ sung ở bước AI/giao thông.
import { CFG } from './config.js';

const RUB_VLAT = 0.3, RUB_DECEL = 3; // m/s, m/s²

/**
 * Vượt quá mép rào: kẹp x, triệt vận tốc ngang. Va (vLat đáng kể) → mất tốc độ + choáng: 'shallow' | 'hard'.
 * Cọ dọc rào (vLat nhỏ) → chỉ ma sát nhẹ: 'rub'. Trong mép → null.
 */
export function resolveBarrier(s, road, dt = CFG.STEP) {
  const lim = s.x < 0 ? -road.edgeL : road.edgeR;
  if (Math.abs(s.x) <= Math.abs(lim)) return null;
  if (Math.abs(s.vLat) <= RUB_VLAT) { s.x = lim; if (Math.sign(s.vLat) === Math.sign(lim)) s.vLat = 0; s.v = Math.max(0, s.v - RUB_DECEL * dt); return 'rub'; }
  const hard = Math.abs(s.vLat) > CFG.PHYS.BARRIER_HARD_VLAT;
  s.x = lim;
  s.vLat = 0;
  s.aAct = 0;
  s.v *= hard ? CFG.PHYS.BARRIER_KEEP_HARD : CFG.PHYS.BARRIER_KEEP_SHALLOW;
  s.stunT = CFG.PHYS.BARRIER_STUN;
  return hard ? 'hard' : 'shallow';
}

/**
 * Va chạm hai xe (đã chuẩn hoá dz cho loop). a, b: { z, x, v, vLat, m, len, w, stunT }.
 * Trả về 'rear' (đâm đuôi, không đàn hồi theo khối lượng, tách xe), 'side' (quệt hông, đẩy nhau) hoặc null.
 */
export function resolveCarCar(a, b) {
  const dz = b.z - a.z, dx = b.x - a.x;
  const halfLen = (a.len + b.len) / 2, halfW = (a.w + b.w) / 2;
  if (Math.abs(dz) >= halfLen || Math.abs(dx) >= halfW) return null;
  const rear = dz > 0 ? a : b, front = rear === a ? b : a;
  if (Math.abs(dz) > halfLen * 0.5 && rear.v <= front.v + 2) { // chạm nhẹ tốc độ thấp: chỉ tách xe
    if (rear === a) a.z = b.z - halfLen; else b.z = a.z - halfLen;
    rear.v = Math.min(rear.v, front.v);
    return 'nudge';
  }
  if (Math.abs(dz) > halfLen * 0.5) {
    const e = CFG.COLLISION.RESTITUTION, M = rear.m + front.m, vr = rear.v, vf = front.v;
    rear.v = (rear.m * vr + front.m * vf + front.m * e * (vf - vr)) / M;
    front.v = (rear.m * vr + front.m * vf + rear.m * e * (vr - vf)) / M;
    if (rear === a) a.z = b.z - halfLen; else b.z = a.z - halfLen;
    rear.stunT = Math.max(rear.stunT, 0.3);
    return 'rear';
  }
  const sign = dx >= 0 ? 1 : -1, M = a.m + b.m, push = CFG.COLLISION.SIDE_PUSH;
  a.x -= sign * push * (b.m / M);
  b.x += sign * push * (a.m / M);
  a.vLat = 0; b.vLat = 0;
  a.v *= 1 - CFG.COLLISION.SIDE_LOSS; b.v *= 1 - CFG.COLLISION.SIDE_LOSS;
  return 'side';
}

/**
 * Xe (người chơi/AI) va vào xe giao thông. Xe máy → luật "tai nạn" (choáng + ép phanh), đối đầu → gần dừng hẳn,
 * cùng chiều → như xe–xe theo khối lượng. Trả về 'bike' | 'headon' | 'rear' | 'side' | null.
 */
export function resolveCarTraffic(car, ent) {
  if (ent.dead) return null;
  const dz = ent.z - car.z, dx = ent.x - car.x;
  if (Math.abs(dz) >= (car.len + ent.len) / 2 || Math.abs(dx) >= (car.w + ent.w) / 2) return null;
  if (ent.kind === 'bike') {
    ent.dead = true;
    car.v *= 0.9;
    car.stunT = Math.max(car.stunT, CFG.COLLISION.BIKE_STUN);
    car.forcedBrakeT = CFG.COLLISION.BIKE_BRAKE_T;
    return 'bike';
  }
  if (ent.dir === -1) {
    const closing = car.v + ent.v;
    car.v = Math.max(0, car.v - closing * 0.85);
    car.vLat = 0;
    car.stunT = Math.max(car.stunT, CFG.COLLISION.BIKE_STUN);
    ent.dead = true; // xe ngược nát, biến mất khỏi đường (không mô phỏng xác xe) để không kẹt mãi
    return 'headon';
  }
  const hit = resolveCarCar(car, ent);
  if (hit === 'rear') car.stunT = Math.max(car.stunT, CFG.COLLISION.CAR_STUN);
  return hit;
}
