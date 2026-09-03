// HUD trong lúc đua: chỉ đọc snapshot từ race, chỉ ghi DOM khi giá trị đổi.
import { fmtTime, fmtDelta } from './util.js';

export function createHud(container) {
  container.className = 'screen hud';
  container.innerHTML = `
    <div class="pos"><div class="label">Vị trí</div><div class="display val"><span data-r="pos">–</span><small> / <span data-r="total">–</span></small></div></div>
    <div class="lap"><div class="label" data-r="lapLabel">Thời gian</div><div class="time" data-r="time">00:00.00</div></div>
    <div class="sector hidden" data-r="sector"></div>
    <div class="toast hidden" data-r="toast"></div>
    <div class="warn hidden" data-r="warn"><span class="arrow" data-r="warnArrow">↰</span><span data-r="warnText">Cua gấp</span></div>
    <div class="weather" data-r="weather"></div>
    <canvas class="minimap hidden" data-r="minimap" width="300" height="300"></canvas>
    <div class="dist" data-r="dist"><small data-r="distLabel">Còn</small><span data-r="distVal">–</span></div>
    <div class="power"><i data-r="power"></i></div>
    <div class="speed"><div class="display val"><span data-r="kmh">0</span><small> KM/H</small></div><div class="sub" data-r="sub"></div></div>
  `;
  const r = {};
  container.querySelectorAll('[data-r]').forEach(e => { r[e.dataset.r] = e; });
  const last = {};
  const set = (key, text) => { if (last[key] !== text) { last[key] = text; r[key].textContent = text; } };
  let toastUntil = 0, sectorUntil = 0;

  return {
    el: container,
    minimap: r.minimap,
    update(s) {
      set('kmh', String(Math.round(s.kmh)));
      set('pos', String(s.pos));
      set('total', String(s.total));
      set('time', fmtTime(s.time));
      set('lapLabel', s.kind === 'loop' ? `Vòng ${s.lap}/${s.laps}` : 'Thời gian');
      set('sub', s.sub || '');
      set('weather', s.weather || '');
      if (s.kind === 'loop') { set('distLabel', 'Vòng'); set('distVal', `${s.lap} / ${s.laps}`); }
      else { set('distLabel', 'Còn'); set('distVal', `${(Math.max(0, s.distToFinish) / 1000).toFixed(2)} km`); }
      const p = Math.max(-1, Math.min(1, s.powerFrac || 0));
      const bar = r.power;
      bar.className = p < 0 ? 'regen' : '';
      bar.style.left = p < 0 ? `${50 + p * 50}%` : '50%';
      bar.style.width = `${Math.abs(p) * 50}%`;
      if (s.warn) {
        r.warn.classList.remove('hidden');
        set('warnArrow', s.warn.dir < 0 ? '↰' : '↱');
        set('warnText', s.warn.text);
      } else r.warn.classList.add('hidden');
      const now = s.time;
      if (toastUntil && now > toastUntil) { r.toast.classList.add('hidden'); toastUntil = 0; }
      if (sectorUntil && now > sectorUntil) { r.sector.classList.add('hidden'); sectorUntil = 0; }
      if (s.toast && s.toast.until !== last.toastId) { last.toastId = s.toast.until; r.toast.textContent = s.toast.text; r.toast.classList.remove('hidden'); toastUntil = s.toast.until; }
      if (s.sector && s.sector.until !== last.sectorId) {
        last.sectorId = s.sector.until;
        r.sector.textContent = `S${s.sector.index} ${fmtTime(s.sector.time)}${s.sector.delta == null ? '' : ' · ' + fmtDelta(s.sector.delta)}`;
        r.sector.className = 'sector ' + (s.sector.delta == null ? '' : s.sector.delta <= 0 ? 'good' : 'bad');
        sectorUntil = s.sector.until;
      }
    },
    showMinimap(on) { r.minimap.classList.toggle('hidden', !on); },
    /** Gọi khi bắt đầu ván mới: xoá toast/sector còn sót. */
    reset() {
      for (const k of Object.keys(last)) delete last[k];
      toastUntil = 0; sectorUntil = 0;
      r.toast.classList.add('hidden'); r.sector.classList.add('hidden'); r.warn.classList.add('hidden');
    },
  };
}
