// Lưu best time theo đường+xe và cài đặt. Backend inject được (test dùng Map); localStorage lỗi → bộ nhớ.
export const KEY = 'vf-street';

export const DEFAULT_SETTINGS = Object.freeze({
  randomWeather: false,
  trafficDensity: 1.0,
  mixedField: false,
  practice: false,
  muted: false,
  minimap: true,
  guideSeen: false,
});

function fromRaw(raw) {
  let obj = null;
  try { obj = raw ? JSON.parse(raw) : null; } catch { obj = null; }
  const best = {}, sectors = {};
  if (obj && obj.sectors && typeof obj.sectors === 'object') {
    for (const [track, byCar] of Object.entries(obj.sectors)) {
      if (!byCar || typeof byCar !== 'object') continue;
      for (const [car, arr] of Object.entries(byCar)) if (Array.isArray(arr) && arr.every(v => typeof v === 'number' && v > 0)) (sectors[track] ||= {})[car] = arr.slice();
    }
  }
  if (obj && obj.best && typeof obj.best === 'object') {
    for (const [track, byCar] of Object.entries(obj.best)) {
      if (!byCar || typeof byCar !== 'object') continue;
      for (const [car, t] of Object.entries(byCar)) {
        if (typeof t === 'number' && Number.isFinite(t) && t > 0) (best[track] ||= {})[car] = t;
      }
    }
  }
  const settings = { ...DEFAULT_SETTINGS };
  if (obj && obj.settings && typeof obj.settings === 'object') {
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (k in obj.settings && typeof obj.settings[k] === typeof DEFAULT_SETTINGS[k]) settings[k] = obj.settings[k];
    }
  }
  return { best, sectors, settings };
}

export function makeStore(backend) {
  const mem = new Map();
  const memBackend = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, v); },
    removeItem: k => { mem.delete(k); },
  };
  let be = backend || (typeof localStorage !== 'undefined' ? localStorage : memBackend);
  const safe = fn => {
    try { return fn(be); } catch { be = memBackend; return fn(be); }
  };
  let state = fromRaw(safe(b => b.getItem(KEY)));
  const persist = () => safe(b => b.setItem(KEY, JSON.stringify(state)));

  return {
    get settings() { return state.settings; },
    getBest(trackId, carId) { return state.best[trackId]?.[carId] ?? null; },
    /** Trả về true nếu là kỷ lục mới. */
    putBest(trackId, carId, seconds) {
      const cur = this.getBest(trackId, carId);
      if (cur != null && seconds >= cur) return false;
      (state.best[trackId] ||= {})[carId] = seconds;
      persist();
      return true;
    },
    getBestSectors(trackId, carId) { return (state.sectors[trackId]?.[carId] ?? []).slice(); },
    /** Ghi kỷ lục từng sector (chỉ giữ sector nhanh hơn). */
    putSectors(trackId, carId, times) {
      const cur = (state.sectors[trackId] ||= {})[carId] ||= [];
      times.forEach((t, i) => { if (typeof t === 'number' && t > 0 && (cur[i] == null || t < cur[i])) cur[i] = t; });
      persist();
    },
    saveSettings(partial) {
      for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in partial) state.settings[k] = partial[k];
      persist();
    },
    reset() { state = fromRaw(null); safe(b => b.removeItem(KEY)); },
  };
}
