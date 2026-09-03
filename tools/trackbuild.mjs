// Lắp JSON đường đua từ profile hình học + độ cao + tag OSM. Thuần (dùng cho tool và test).
import { closeLoop, slopeFrom } from '../js/geo.js';

export const ROAD_PROFILES = {
  ql2: { halfM: 3.0, shoulderL: 0.75, shoulderR: 0.75, lanes: 2, twoWay: true, edgeL: 4.5, edgeR: 4.5 },
  ql2narrow: { halfM: 2.75, shoulderL: 0.5, shoulderR: 0.5, lanes: 2, twoWay: true, edgeL: 4.0, edgeR: 4.0 },
  urban4: { halfM: 7.0, shoulderL: 0.3, shoulderR: 0.3, lanes: 4, twoWay: false, edgeL: 7.6, edgeR: 7.6 },
  motorway3: { halfM: 5.625, shoulderL: 0.75, shoulderR: 3.0, lanes: 3, twoWay: false, edgeL: 6.6, edgeR: 9.0 },
};

export const SURFACE = { asphalt: 0, rough: 1, concrete: 2, gravel: 3 };
export const HINT = { bridge: 1, tunnel: 2, cliffLeft: 4, cliffRight: 8 };
const SIGN_KAPPA = 1 / 40, SIGN_AHEAD_M = 60;

export function surfaceCode(tags = {}) {
  const sm = tags.smoothness, sf = tags.surface;
  if (sf && /gravel|unpaved|dirt|ground|compacted/.test(sf)) return SURFACE.gravel;
  if (sf === 'concrete' || sf === 'concrete:plates') return SURFACE.concrete;
  if (sm && /bad|horrible|impassable/.test(sm)) return SURFACE.rough;
  if (sf && !/asphalt|paved/.test(sf)) return SURFACE.rough;
  return SURFACE.asphalt;
}

/**
 * cfg: mục trong routes.json; data: { kappa[n] (κ địa lý), y[n+1] (m), points[n+1] ({src}), srcTags[], geo[n+1] ({lat,lon}), cliff?[n] }.
 */
export function assembleTrack(cfg, data, L) {
  const n = data.kappa.length;
  const prof = ROAD_PROFILES[cfg.roadProfile] || ROAD_PROFILES.ql2;
  const y = cfg.kind === 'loop' ? closeLoop(data.y.slice(0, n + 1)) : data.y.slice(0, n + 1);
  const slope = slopeFrom(y, L, { max: cfg.maxSlope || 0.12 }).slice(0, n);
  const kappa = data.kappa.map(k => -k); // địa lý (trái +) → game (phải +)
  const tagsAt = i => data.srcTags?.[data.points[Math.min(i, data.points.length - 1)].src] || {};
  const surface = Array.from({ length: n }, (_, i) => surfaceCode(tagsAt(i)));
  const hint = Array.from({ length: n }, (_, i) => {
    const t = tagsAt(i);
    let h = 0;
    if (t.bridge && t.bridge !== 'no') h |= HINT.bridge;
    if (t.tunnel && t.tunnel !== 'no') h |= HINT.tunnel;
    if (data.cliff?.[i] < 0) h |= HINT.cliffLeft;
    if (data.cliff?.[i] > 0) h |= HINT.cliffRight;
    return h;
  });
  const signs = [];
  const ahead = Math.ceil(SIGN_AHEAD_M / L);
  for (let i = 0; i < n; i++) {
    if (Math.abs(kappa[i]) > SIGN_KAPPA && (i === 0 || Math.abs(kappa[i - 1]) <= SIGN_KAPPA)) {
      const at = Math.max(0, i - ahead);
      const severity = Math.abs(kappa[i]) > 1 / 20 ? 2 : 1;
      signs.push({ i: at, dir: kappa[i] > 0 ? 1 : -1, severity });
    }
  }
  const lengthM = n * L;
  const geo = data.geo.filter((_, i) => i % 10 === 0).map(p => [Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6))]);
  return {
    id: cfg.id, name: cfg.name, place: cfg.place, desc: cfg.desc || '', kind: cfg.kind, laps: cfg.kind === 'loop' ? (cfg.laps || 3) : 1,
    lengthM, L, n,
    road: { halfM: Array.from({ length: n }, () => prof.halfM), shoulderL: prof.shoulderL, shoulderR: prof.shoulderR, edgeL: prof.edgeL, edgeR: prof.edgeR, lanes: prof.lanes, twoWay: prof.twoWay },
    kappa: kappa.map(k => Number(k.toFixed(5))),
    slope: slope.map(v => Number(v.toFixed(4))),
    y: y.map(v => Number(v.toFixed(1))),
    surface, hint, signs,
    sectorsZ: [Math.round(lengthM / 3), Math.round((2 * lengthM) / 3)],
    geo, startLatLon: [data.geo[0].lat, data.geo[0].lon], endLatLon: [data.geo[data.geo.length - 1].lat, data.geo[data.geo.length - 1].lon],
    scenery: cfg.scenery, weatherPresets: cfg.weatherPresets, trafficProfile: cfg.trafficProfile ?? null,
    attribution: {
      osm: '© OpenStreetMap contributors, ODbL 1.0', osmUrl: 'https://www.openstreetmap.org/copyright',
      elevation: 'SRTM 30 m (NASA/USGS) via Open Topo Data', fetchedAt: cfg.fetchedAt || new Date().toISOString(), wayIds: cfg.wayIds || [],
    },
  };
}

/** Kiểm tra JSON đường; trả về danh sách lỗi (rỗng = hợp lệ). */
export function validateTrack(t) {
  const errs = [];
  const arr = (name, len) => { if (!Array.isArray(t[name]) || t[name].length !== len) errs.push(`${name}: cần ${len} phần tử`); else if (t[name].some(v => typeof v !== 'number' || !Number.isFinite(v))) errs.push(`${name}: có NaN`); };
  if (!t.id || !t.name) errs.push('thiếu id/name');
  if (!['sprint', 'loop'].includes(t.kind)) errs.push('kind sai');
  if (!(t.n >= 100)) errs.push('quá ngắn');
  arr('kappa', t.n); arr('slope', t.n); arr('y', t.n + 1); arr('surface', t.n); arr('hint', t.n);
  if (!t.road || t.road.halfM?.length !== t.n) errs.push('road.halfM sai độ dài');
  if (t.kappa?.some(k => Math.abs(k) > 1 / 12 + 1e-9)) errs.push('|κ| > 1/12');
  if (t.slope?.some(s => Math.abs(s) > 0.12 + 1e-9)) errs.push('|slope| > 0.12');
  if (t.lengthM !== t.n * t.L) errs.push('lengthM ≠ n·L');
  if (t.kind === 'loop' && Math.abs(t.y[0] - t.y[t.n]) > 0.2) errs.push('loop không khép độ cao');
  if (!t.geo?.length) errs.push('thiếu geo');
  return errs;
}
