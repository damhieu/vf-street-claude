// Điều khiển cảm ứng (điện thoại/tablet): pad lái trái (ngón đặt sau thắng), nút GA/PHANH phải, nút tạm dừng.
export function createTouch(input, on) {
  const $ = id => document.getElementById(id);
  const ui = $('touch-ui');
  if (!ui) return { enabled: false, setRacing() {} };
  let enabled = false;
  const enable = () => { if (enabled) return; enabled = true; document.body.classList.add('touch'); queueMicrotask(() => on.enabled?.()); };
  if (matchMedia('(pointer: coarse)').matches) enable();
  else addEventListener('touchstart', enable, { once: true, passive: true });
  ui.addEventListener('contextmenu', e => e.preventDefault());

  const pad = $('tpad'), pads = new Map();
  const sideOf = e => { const r = pad.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? 'left' : 'right'; };
  const updPad = () => {
    const arr = [...pads.values()], last = arr.length ? arr[arr.length - 1] : null;
    input.setTouch({ left: last === 'left', right: last === 'right' });
    $('tbtn-left').classList.toggle('pressed', last === 'left');
    $('tbtn-right').classList.toggle('pressed', last === 'right');
  };
  pad.addEventListener('pointerdown', e => { try { pad.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } pads.delete(e.pointerId); pads.set(e.pointerId, sideOf(e)); updPad(); e.preventDefault(); on.gesture?.(); });
  pad.addEventListener('pointermove', e => { if (!pads.has(e.pointerId)) return; const s = sideOf(e); if (pads.get(e.pointerId) !== s) { pads.delete(e.pointerId); pads.set(e.pointerId, s); updPad(); } });
  const padEnd = e => { if (pads.delete(e.pointerId)) updPad(); };
  pad.addEventListener('pointerup', padEnd); pad.addEventListener('pointercancel', padEnd);

  const bindHold = (id, key) => {
    const b = $(id), ids = new Set();
    b.addEventListener('pointerdown', e => { try { b.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } ids.add(e.pointerId); b.classList.add('pressed'); input.setTouch({ [key]: true }); e.preventDefault(); on.gesture?.(); });
    const end = e => { if (!ids.delete(e.pointerId) || ids.size) return; b.classList.remove('pressed'); input.setTouch({ [key]: false }); };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
  };
  bindHold('tbtn-gas', 'throttle');
  bindHold('tbtn-brake', 'brake');
  $('tbtn-pause').addEventListener('click', () => on.pause?.());

  return {
    get enabled() { return enabled; },
    setRacing(onRace) { ui.classList.toggle('hidden', !(enabled && onRace)); if (!onRace) { pads.clear(); input.setTouch({ left: false, right: false, throttle: false, brake: false }); } },
  };
}

/** Toàn màn hình + khoá ngang (best-effort). manual: từ nút bấm → nếu không được (Safari iPhone) hiện hướng dẫn. */
export function goFullscreen(manual, showTip) {
  if (document.fullscreenElement) return;
  const el = document.documentElement;
  const req = el.requestFullscreen ? () => el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen ? () => el.webkitRequestFullscreen() : null;
  if (!req) { if (manual) showTip(); return; }
  try {
    const after = () => { if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {}); };
    const p = req();
    if (p?.then) p.then(after).catch(() => { if (manual) showTip(); }); else after();
  } catch { if (manual) showTip(); }
}

export const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
