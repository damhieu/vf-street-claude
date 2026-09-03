// Dữ liệu tổng hợp và tay lái đơn giản dùng chung cho test.
import { CFG } from '../js/config.js';
import { clamp } from '../js/util.js';
import { steerCap } from '../js/physics.js';
import { kappaAt, vMax } from '../js/track.js';
import { envAt } from '../js/race.js';

/** Input bám đường: lái theo κ, về giữa đường, phanh cho cua trong 250 m tới. */
export function driveInput(race) {
  const p = race.player, t = race.track, env = envAt(t, race.weather, race.spec, p.z, p.x);
  const cap = steerCap(p.P, p.v, env.mu);
  let steer = cap > 0 ? clamp((p.v * p.v * env.seg.kappa) / cap, -1, 1) : 0;
  steer = clamp(steer - p.x * 0.3 - p.vLat * 0.2, -1, 1);
  let target = p.P.vLim;
  for (let d = 0; d < 250; d += t.L) {
    const vm = 0.9 * vMax(kappaAt(t, p.z + d), env.mu);
    target = Math.min(target, Math.sqrt(vm * vm + 2 * 0.8 * env.mu * CFG.G * d));
  }
  return { steer, throttle: p.v < target ? 1 : 0, brake: p.v > target + 1 ? 1 : 0 };
}

export function syntheticTrackJson(kind = 'sprint', { n = 300, L = 4, flat = true } = {}) {
  const kappa = Array.from({ length: n }, (_, i) => (i >= 120 && i < 140 ? 0.02 : i >= 200 && i < 210 ? -0.05 : 0));
  return {
    id: 'synt', name: 'Tổng hợp', place: 'Test', kind, laps: kind === 'loop' ? 2 : 1, lengthM: n * L, L, n,
    road: { halfM: Array(n).fill(3), shoulderL: 0.75, shoulderR: 0.75, edgeL: 4.5, edgeR: 4.5, lanes: 2, twoWay: true },
    kappa, slope: Array(n).fill(0), y: Array.from({ length: n + 1 }, (_, i) => (flat ? 0 : i * 0.1)), surface: Array(n).fill(0), hint: Array(n).fill(0),
    signs: [], sectorsZ: [Math.round((n * L) / 3), Math.round((2 * n * L) / 3)], geo: [[16, 108]], weatherPresets: ['clear'], trafficProfile: null, scenery: 'coast',
  };
}
