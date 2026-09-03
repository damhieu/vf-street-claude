// Hình học tuyến đường (thuần): chiếu lat/lon → mét, lấy mẫu đều, độ cong, độ dốc, làm mượt.
// Quy ước κ: > 0 khi heading tăng (rẽ trái nhìn từ trên, trục x đông / y bắc).
import { clamp } from './util.js';

const R_EARTH = 6371000;
const DEG = Math.PI / 180;

export function toLocalMeters(pts, origin = pts[0]) {
  const kx = Math.cos(origin.lat * DEG) * R_EARTH * DEG, ky = R_EARTH * DEG;
  return pts.map(p => ({ x: (p.lon - origin.lon) * kx, y: (p.lat - origin.lat) * ky }));
}

export function fromLocalMeters(pts, origin) {
  const kx = Math.cos(origin.lat * DEG) * R_EARTH * DEG, ky = R_EARTH * DEG;
  return pts.map(p => ({ lat: origin.lat + p.y / ky, lon: origin.lon + p.x / kx }));
}

export function polylineLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}

/** Điểm cách đều L mét dọc polyline: [{x, y, s, src}] (src = chỉ số điểm gốc đứng trước). */
export function resample(pts, L) {
  const out = [{ x: pts[0].x, y: pts[0].y, s: 0, src: 0 }];
  let acc = 0, target = L, i = 0;
  while (i < pts.length - 1) {
    const a = pts[i], b = pts[i + 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg === 0) { i++; continue; }
    if (acc + seg >= target) {
      const t = (target - acc) / seg;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s: target, src: i });
      target += L;
    } else { acc += seg; i++; }
  }
  return out;
}

export function movingAverage(arr, w) {
  const h = Math.floor(w / 2), n = arr.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - h); j <= Math.min(n - 1, i + h); j++) { s += arr[j]; c++; }
    out[i] = s / c;
  }
  return out;
}

export function median3(arr) {
  const n = arr.length;
  return arr.map((v, i) => (i === 0 || i === n - 1 ? v : [arr[i - 1], v, arr[i + 1]].sort((a, b) => a - b)[1]));
}

export function gaussianSmooth(arr, sigma) {
  const h = Math.ceil(sigma * 3), n = arr.length, out = new Array(n);
  const w = Array.from({ length: 2 * h + 1 }, (_, k) => Math.exp(-((k - h) ** 2) / (2 * sigma * sigma)));
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = -h; k <= h; k++) { const j = i + k; if (j < 0 || j >= n) continue; s += arr[j] * w[k + h]; c += w[k + h]; }
    out[i] = s / c;
  }
  return out;
}

/** Heading từng đoạn (rad), đã unwrap để không nhảy ±2π. */
export function headings(pts) {
  const th = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    let a = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
    if (th.length) { const prev = th[th.length - 1]; while (a - prev > Math.PI) a -= 2 * Math.PI; while (a - prev < -Math.PI) a += 2 * Math.PI; }
    th.push(a);
  }
  return th;
}

/**
 * Từ polyline mét → profile segment đều L: { lengthM, n, points, kappa[] }.
 * κ: heading trung bình trượt 5 mẫu → sai phân trung tâm → median-3 → Gaussian σ = 8 m → kẹp.
 */
export function buildProfile(pts, L, { kappaMax = 1 / 12 } = {}) {
  const points = resample(pts, L);
  const th = movingAverage(headings(points), 5);
  const n = th.length;
  let kappa = th.map((_, i) => {
    if (n < 2) return 0;
    if (i === 0) return (th[1] - th[0]) / L;
    if (i === n - 1) return (th[n - 1] - th[n - 2]) / L;
    return (th[i + 1] - th[i - 1]) / (2 * L);
  });
  kappa = gaussianSmooth(median3(kappa), 8 / L).map(k => clamp(k, -kappaMax, kappaMax));
  return { lengthM: polylineLength(pts), n, points, kappa };
}

/** Bỏ trôi tuyến tính để vòng khép kín có độ cao cuối = đầu. */
export function closeLoop(y) {
  const n = y.length, drift = y[n - 1] - y[0];
  return y.map((v, i) => v - (drift * i) / (n - 1));
}

/** Nội suy tuyến tính các giá trị null (void độ cao). */
export function interpolateNulls(y) {
  const out = y.slice();
  let i = 0;
  while (i < out.length) {
    if (out[i] != null) { i++; continue; }
    let j = i; while (j < out.length && out[j] == null) j++;
    const a = i > 0 ? out[i - 1] : (j < out.length ? out[j] : 0), b = j < out.length ? out[j] : a;
    for (let k = i; k < j; k++) out[k] = a + ((b - a) * (k - i + 1)) / (j - i + 1);
    i = j;
  }
  return out;
}

/** Độ dốc (dy/ds) từ độ cao theo segment: sai phân trung tâm, kẹp |s| ≤ max và |Δs| ≤ maxRate mỗi segment. */
export function slopeFrom(y, L, { max = 0.12, maxRate = 0.008 } = {}) {
  const n = y.length;
  const s = y.map((_, i) => {
    if (n < 2) return 0;
    if (i === 0) return (y[1] - y[0]) / L;
    if (i === n - 1) return (y[n - 1] - y[n - 2]) / L;
    return (y[i + 1] - y[i - 1]) / (2 * L);
  }).map(v => clamp(v, -max, max));
  for (let i = 1; i < n; i++) s[i] = clamp(s[i], s[i - 1] - maxRate, s[i - 1] + maxRate);
  return s;
}
