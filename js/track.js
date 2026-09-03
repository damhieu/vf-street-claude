// Đường đua đã hydrate từ JSON (thuần): tra κ/độ dốc/độ cao theo z, giới hạn vào cua, cua kế tiếp.
import { CFG } from './config.js';
import { clamp, wrap } from './util.js';

const { SEG_LEN, KAPPA_RENDER_MAX } = CFG.RENDER;

export function hydrateTrack(json) {
  const n = json.n, L = json.L || SEG_LEN;
  const segments = [];
  for (let i = 0; i < n; i++) {
    const kappa = json.kappa[i];
    segments.push({
      i, z0: i * L,
      kappa, slope: json.slope[i],
      curve: clamp(kappa, -KAPPA_RENDER_MAX, KAPPA_RENDER_MAX) * L * L, // shear của engine = sai phân bậc hai độ lệch ngang
      y0: json.y[i], y1: json.y[i + 1],
      halfM: json.road.halfM[i], surface: json.surface[i], hint: json.hint[i],
      p1: { world: { x: 0, y: json.y[i], z: i * L }, camera: {}, screen: {} },
      p2: { world: { x: 0, y: json.y[i + 1], z: (i + 1) * L }, camera: {}, screen: {} },
      sprites: [], cars: [],
    });
  }
  return {
    id: json.id, name: json.name, place: json.place, desc: json.desc, kind: json.kind, laps: json.laps || 1,
    n, L, lengthM: n * L, segments, road: json.road, signs: json.signs || [], sectorsZ: json.sectorsZ || [],
    geo: json.geo || [], weatherPresets: json.weatherPresets || ['clear'], trafficProfile: json.trafficProfile ?? null, scenery: json.scenery,
    attribution: json.attribution,
  };
}

export const wrapZ = (t, z) => (t.kind === 'loop' ? wrap(z, t.lengthM) : z);

export function segIndexAt(t, z) {
  if (t.kind === 'loop') return Math.floor(wrap(z, t.lengthM) / t.L);
  return clamp(Math.floor(z / t.L), 0, t.n - 1);
}
export const segAt = (t, z) => t.segments[segIndexAt(t, z)];
export const kappaAt = (t, z) => segAt(t, z).kappa;
export const slopeAt = (t, z) => segAt(t, z).slope;
export const halfAt = (t, z) => segAt(t, z).halfM;

export function yAt(t, z) {
  const s = segAt(t, z);
  const zz = t.kind === 'loop' ? wrap(z, t.lengthM) : clamp(z, 0, t.lengthM);
  const f = clamp((zz - s.z0) / t.L, 0, 1);
  return s.y0 + (s.y1 - s.y0) * f;
}

/** Tốc độ tối đa qua cua (m/s) với hệ số bám μ. */
export const vMax = (kappa, mu) => (Math.abs(kappa) < 1e-9 ? Infinity : Math.sqrt((mu * CFG.G) / Math.abs(kappa)));

/** Cua đầu tiên có |κ| ≥ threshold trong maxDist mét phía trước: { distance, kappa, index } hoặc null. */
export function nextCorner(t, z, maxDist, threshold) {
  const start = segIndexAt(t, z);
  const zz = t.kind === 'loop' ? wrap(z, t.lengthM) : z;
  const count = Math.ceil(maxDist / t.L);
  for (let k = 0; k <= count; k++) {
    const idx = start + k;
    if (idx >= t.n && t.kind !== 'loop') return null;
    const s = t.segments[idx % t.n];
    const distance = s.z0 + (idx >= t.n ? t.lengthM : 0) - zz;
    if (distance > maxDist) return null;
    if (k > 0 && Math.abs(s.kappa) >= threshold) return { distance, kappa: s.kappa, index: s.i };
  }
  return null;
}

export const distToFinish = (t, z) => Math.max(0, t.lengthM - z);
