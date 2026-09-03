// Các màn hình DOM (menu, chọn xe, chọn đường, tạm dừng, kết quả, credits, cài đặt). Không chứa logic game.
import { fmtTime } from './util.js';
import { WEATHER } from './weather.js';
import { GAME_INFO } from './gameinfo.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

const SETTING_LABELS = {
  randomWeather: 'Thời tiết ngẫu nhiên theo tuyến',
  trafficDensity: 'Mật độ giao thông',
  mixedField: 'Đối thủ đủ cả 6 mẫu (không cùng hạng)',
  practice: 'Tập lái — không AI, không giao thông',
  muted: 'Tắt tiếng',
  minimap: 'Hiện bản đồ tuyến',
};

export function createUI(root, on) {
  const screens = {};
  let current = null;
  const state = { cars: [], carId: null, paint: null, tracks: [], trackId: null, bests: {}, settings: {} };

  const screen = (name, cls) => { const s = el('section', `screen ${cls}`); s.dataset.screen = name; root.appendChild(s); screens[name] = s; return s; };
  const btn = (label, cls, handler) => { const b = el('button', cls, label); b.addEventListener('click', handler); return b; };

  // ---- Menu ----
  const menu = screen('menu', 'menu');
  menu.append(
    el('div', 'kicker', 'Đua xe điện Việt Nam'),
    el('h1', 'display', 'VF <span>Street</span>'),
    el('p', null, 'Sáu mẫu VinFast, năm cung đường thật, một vạch đích. Vật lý theo thông số xe thật, AI không nhường, giao thông kiểu Việt Nam.'),
  );
  const menuRow = el('div', 'row');
  menuRow.append(
    btn('Chơi ngay', 'primary', () => on.toCars()),
    btn('Cài đặt', '', () => on.toSettings()),
    btn('Credits', '', () => on.toCredits()),
    el('div', 'keys', '<span><b>↑ ↓</b> ga / phanh</span><span><b>← →</b> đánh lái</span><span><b>Esc</b> tạm dừng</span><span><b>M</b> tắt tiếng</span>'),
  );
  menu.append(menuRow);
  menu.append(el('div', 'version-line', `Thiết kế bởi ${esc(GAME_INFO.designer)} · v${esc(GAME_INFO.version)} · build ${esc(GAME_INFO.built)}`));

  // ---- Chọn xe ----
  const cars = screen('cars', 'pick');
  cars.append(el('header', null, '<div><div class="kicker">Bước 1 / 2</div><h2 class="display">Chọn xe</h2></div><div class="dim">Thông số thật · Đối thủ cùng hạng với xe bạn chọn</div>'));
  const carGrid = el('div', 'grid cars');
  const carFoot = el('footer');
  const carInfo = el('div', 'info');
  const carActions = el('div', 'actions');
  carActions.append(btn('Quay lại', '', () => on.toMenu()), btn('Chọn đường đua →', 'primary', () => on.toTracks()));
  carFoot.append(carInfo, carActions);
  cars.append(carGrid, carFoot);

  // ---- Chọn đường ----
  const tracks = screen('tracks', 'pick');
  tracks.append(el('header', null, '<div><div class="kicker">Bước 2 / 2</div><h2 class="display">Chọn đường đua</h2></div><div class="dim" data-r="trackHint"></div>'));
  const trackGrid = el('div', 'grid tracks');
  const trackFoot = el('footer');
  const toggles = el('div', 'toggles');
  const trackActions = el('div', 'actions');
  trackActions.append(btn('← Đổi xe', '', () => on.toCars()), btn('Bắt đầu đua', 'primary', () => on.startRace()));
  trackFoot.append(toggles, trackActions);
  tracks.append(trackGrid, trackFoot);

  // ---- Race (HUD do hud.js điền) ----
  screen('race', 'hud');

  // ---- Tạm dừng ----
  const pause = screen('pause', 'overlay');
  pause.append(el('h2', 'display', 'Tạm dừng'));
  const pauseActions = el('div', 'actions');
  pauseActions.append(btn('Tiếp tục', 'primary', () => on.resume()), btn('Đua lại', '', () => on.startRace()), btn('Bỏ cuộc', '', () => on.toTracks()));
  pause.append(pauseActions);

  // ---- Kết quả ----
  const result = screen('result', 'overlay result');
  const resKicker = el('div', 'kicker');
  const resHuge = el('div', 'display huge');
  const resTitle = el('div', 'display title');
  const resStats = el('div', 'stats');
  const resActions = el('div', 'actions');
  resActions.append(btn('Đổi xe', '', () => on.toCars()), btn('Đổi đường', '', () => on.toTracks()), btn('Đua lại', 'primary', () => on.startRace()));
  result.append(resKicker, resHuge, resTitle, resStats, resActions);

  // ---- Credits ----
  const credits = screen('credits', 'overlay');
  credits.append(el('h2', 'display', 'Credits'), el('div', 'list', `
    <p><b>Dữ liệu đường</b>: © OpenStreetMap contributors, giấy phép ODbL 1.0 — <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">openstreetmap.org/copyright</a>.</p>
    <p><b>Độ cao</b>: SRTM 30 m, NASA/USGS, truy xuất qua Open Topo Data (opentopodata.org).</p>
    <p><b>Thông số xe</b>: tổng hợp từ Wikipedia, oto.com.vn, bonbanh.com, VnExpress, Tuổi Trẻ. Hình xe vẽ bằng canvas theo tỉ lệ công bố; không dùng ảnh chụp.</p>
    <p><b>Engine</b>: pseudo-3D kiểu OutRun/NFS cổ điển, viết bằng JavaScript thuần. Không sử dụng thư viện ngoài.</p>
    <p><b>Video nền menu</b>: tạo bằng Higgsfield AI (ảnh nền Nano Banana, dựng chuyển động MiniMax H3). Cảnh hư cấu lấy cảm hứng từ đèo Hải Vân.</p>
    <p class="dim">VF Street là dự án cá nhân không liên kết với VinFast.</p>
    <p class="dim">Thiết kế bởi ${esc(GAME_INFO.designer)} · Phiên bản ${esc(GAME_INFO.version)} · Build ${esc(GAME_INFO.built)}</p>`));
  const credActions = el('div', 'actions');
  credActions.append(btn('Quay lại', 'primary', () => on.toMenu()));
  credits.append(credActions);

  // ---- Cài đặt ----
  const settings = screen('settings', 'overlay');
  settings.append(el('h2', 'display', 'Cài đặt'));
  const settingList = el('div');
  const setActions = el('div', 'actions');
  setActions.append(btn('Quay lại', 'primary', () => on.toMenu()));
  settings.append(settingList, setActions);

  screen('loading', 'loading').textContent = 'Đang tải…';

  // ---- Điều hướng bằng phím ----
  const focus = { items: [], idx: 0 };
  function collectFocus() {
    const s = screens[current];
    focus.items = s ? [...s.querySelectorAll('button')].filter(b => !b.classList.contains('paint')) : [];
    let idx = focus.items.findIndex(b => b.classList.contains('selected'));
    if (idx < 0) idx = focus.items.findIndex(b => b.classList.contains('primary'));
    focus.idx = Math.max(0, idx);
    paintFocus();
  }
  function paintFocus() { focus.items.forEach((b, i) => b.classList.toggle('focused', i === focus.idx)); }
  function move(delta) {
    if (!focus.items.length) return;
    focus.idx = (focus.idx + delta + focus.items.length) % focus.items.length;
    paintFocus();
    const b = focus.items[focus.idx];
    if (b.classList.contains('card')) b.click(); // di chuyển trên card = chọn luôn
  }

  function cyclePaint(delta) {
    const car = state.cars.find(c => c.id === state.carId);
    if (!car) return;
    const i = car.paints.findIndex(p => p.hex === state.paint);
    const next = car.paints[(i + delta + car.paints.length) % car.paints.length];
    on.pickPaint(next.hex);
  }

  /** Nhận action rời từ input: up/down/left/right/confirm/back. */
  function press(action) {
    if (current === 'race') return;
    if (action === 'back') { on.back(current); return; }
    if (action === 'confirm') {
      const b = focus.items[focus.idx];
      if (!b) return;
      if (b.classList.contains('card')) { (current === 'cars' ? on.toTracks : on.startRace)(); return; }
      b.click();
      return;
    }
    if (current === 'cars' && (action === 'up' || action === 'down')) { cyclePaint(action === 'down' ? 1 : -1); return; }
    if (action === 'left' || action === 'up') move(-1);
    if (action === 'right' || action === 'down') move(1);
  }

  function show(name) {
    current = name;
    for (const [k, s] of Object.entries(screens)) s.classList.toggle('active', k === name);
    collectFocus();
  }

  // ---- Render dữ liệu ----
  function renderCars() {
    carGrid.innerHTML = '';
    for (const c of state.cars) {
      const card = el('button', 'card' + (c.id === state.carId ? ' selected' : ''));
      card.dataset.id = c.id;
      const cv = el('canvas'); cv.width = 240; cv.height = 150;
      card.append(cv, el('div', 'name', esc(c.name)), el('div', 'cls', esc(c.cls)));
      card.append(el('div', 'spec', `
        <span>Công suất</span><b>${c.powerKw} kW</b>
        <span>Mô-men</span><b>${c.torqueNm} Nm</b>
        <span>0–100</span><b>${c.t0100 == null ? '—' : c.t0100.toFixed(1).replace('.', ',') + ' s'}</b>
        <span>Tối đa</span><b>${c.vLimKmh} km/h</b>
        <span>Nặng</span><b>${c.massKg.toLocaleString('vi-VN')} kg</b>
        <span>Dẫn động</span><b>${c.drive}</b>`));
      card.addEventListener('click', () => on.pickCar(c.id));
      carGrid.append(card);
      on.previewCar?.(cv, c, c.id === state.carId ? state.paint : '#9a9ea8');
    }
    const car = state.cars.find(c => c.id === state.carId);
    carInfo.innerHTML = '';
    if (car) {
      const paints = el('div', 'paints');
      for (const p of car.paints) {
        const b = el('button', 'paint' + (p.hex === state.paint ? ' selected' : ''));
        b.title = p.name; b.style.background = p.hex;
        b.addEventListener('click', () => on.pickPaint(p.hex));
        paints.append(b);
      }
      carInfo.append(el('div', 'big', esc(car.name)), el('div', 'muted', `${esc(car.desc)} · Sơn: <b>${esc(car.paints.find(p => p.hex === state.paint)?.name ?? '')}</b>`), paints);
    }
    if (current === 'cars') collectFocus();
  }

  function renderTracks() {
    trackGrid.innerHTML = '';
    if (!state.tracks.length) trackGrid.append(el('div', 'dim', 'Chưa có dữ liệu đường. Chạy <code>npm run tracks</code> để dựng từ OpenStreetMap.'));
    for (const t of state.tracks) {
      const card = el('button', 'card' + (t.id === state.trackId ? ' selected' : ''));
      const cv = el('canvas', 'thumb'); cv.width = 200; cv.height = 120;
      const best = state.bests[t.id];
      card.append(cv, el('div', 'kicker', esc(t.place)), el('div', 'name', esc(t.name)), el('div', 'cls', esc(t.desc || '')));
      card.append(el('div', 'len', `${t.kind === 'loop' ? 'Vòng' : 'Sprint'} · <b>${(t.lengthM / 1000).toFixed(1).replace('.', ',')} km</b>${t.kind === 'loop' ? ` × ${t.laps || 3}` : ''}<br>Thời tiết: ${esc((t.weatherPresets || []).map(w => WEATHER[w]?.label || w).join(', '))}<br>Kỷ lục: <b>${best == null ? '—' : fmtTime(best)}</b>`));
      card.addEventListener('click', () => on.pickTrack(t.id));
      trackGrid.append(card);
      on.previewTrack?.(cv, t);
    }
    toggles.innerHTML = '';
    for (const [k, label] of [['randomWeather', 'Thời tiết ngẫu nhiên'], ['practice', 'Tập lái'], ['mixedField', 'Đối thủ đủ 6 mẫu']]) {
      const lab = el('label');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!state.settings[k];
      cb.addEventListener('change', () => on.setSetting(k, cb.checked));
      lab.append(cb, document.createTextNode(label));
      toggles.append(lab);
    }
    const car = state.cars.find(c => c.id === state.carId);
    tracks.querySelector('[data-r="trackHint"]').textContent = car ? `Xe: ${car.name} · Giao thông ×${state.settings.trafficDensity ?? 1}` : '';
    if (current === 'tracks') collectFocus();
  }

  function renderSettings() {
    settingList.innerHTML = '';
    for (const [k, label] of Object.entries(SETTING_LABELS)) {
      const row = el('div', 'setting');
      const v = state.settings[k];
      const b = btn(typeof v === 'boolean' ? (v ? 'Bật' : 'Tắt') : `×${v}`, '', () => on.setSetting(k, typeof v === 'boolean' ? !v : v === 1 ? 1.5 : 1));
      row.append(el('span', null, esc(label)), b);
      settingList.append(row);
    }
    if (current === 'settings') collectFocus();
  }

  return {
    get current() { return current; },
    show,
    press,
    raceEl: screens.race,
    setCars(list, carId, paint) { state.cars = list; state.carId = carId; state.paint = paint; renderCars(); },
    setTracks(list, trackId, bests, settings) { state.tracks = list; state.trackId = trackId; state.bests = bests; state.settings = settings; renderTracks(); },
    setSettings(settings) { state.settings = settings; renderSettings(); },
    setResult(r) {
      resKicker.textContent = `${r.trackName} · ${r.carName}${r.weather ? ' · ' + r.weather : ''}`;
      resHuge.innerHTML = `${r.pos}<small>/${r.total}</small>`;
      const titles = { 1: ['Về nhất!', 'var(--accent)'], 2: ['Á quân', '#fff'], 3: ['Bục vinh quang', '#fff'] };
      const [title, color] = titles[r.pos] || [`Hạng ${r.pos}`, 'var(--muted)'];
      resTitle.textContent = title; resTitle.style.color = color;
      resStats.innerHTML = `
        <div><div class="k">Tổng thời gian</div><div class="v">${fmtTime(r.time)}</div></div>
        <div><div class="k">${r.isRecord ? 'Kỷ lục mới' : 'Kỷ lục cá nhân'}</div><div class="v accent">${fmtTime(r.best)}</div></div>
        <div><div class="k">Sector</div><div class="v" style="font-size:22px">${(r.sectors || []).map(fmtTime).join(' · ')}</div></div>
        ${r.incidents != null ? `<div><div class="k">Sự cố</div><div class="v">${r.incidents}</div></div>` : ''}`;
    },
  };
}
