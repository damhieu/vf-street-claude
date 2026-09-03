// Hàm tiện ích thuần (không DOM) — dùng chung cho game, tool và test.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Gấp v vào [0, max). */
export function wrap(v, max) {
  let r = v % max;
  if (r < 0) r += max;
  return r;
}

/** Sinh số ngẫu nhiên có seed (mulberry32), trả về hàm () => [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ms = kmhValue => kmhValue / 3.6;
export const kmh = msValue => msValue * 3.6;

const pad2 = n => String(n).padStart(2, '0');

/** Giây → "mm:ss.cc". null/NaN → "--:--.--". */
export function fmtTime(t) {
  if (t == null || !Number.isFinite(t)) return '--:--.--';
  const cs = Math.floor(t * 100 + 1e-6);
  return `${pad2(Math.floor(cs / 6000))}:${pad2(Math.floor((cs % 6000) / 100))}.${pad2(cs % 100)}`;
}

/** Chênh lệch giây có dấu, hai chữ số lẻ. */
export function fmtDelta(d) {
  const v = Math.round(Math.abs(d) * 100 + 1e-9) / 100;
  return (d < 0 ? '−' : '+') + v.toFixed(2);
}
