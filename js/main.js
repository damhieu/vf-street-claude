// Boot, state machine màn hình, vòng lặp bước cố định, hook debug.
import { CFG } from './config.js';
import { CARS, carById } from './cars.js';
import { makeStore } from './storage.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { createHud } from './hud.js';
import { hydrateTrack } from './track.js';
import { createRace } from './race.js';
import { createRenderer } from './render.js';
import * as vehicles from './vehicles.js';
import * as effects from './effects.js';
import { pickWeather } from './weather.js';
import { createAudio } from './audio.js';
import { createTouch, goFullscreen, isStandalone } from './touch.js';
import { GAME_INFO } from './gameinfo.js';

console.log(`VF Street v${GAME_INFO.version} — build ${GAME_INFO.built} — thiết kế bởi ${GAME_INFO.designer}`);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const store = makeStore();
const input = createInput(window);
const audio = createAudio(() => store.settings.muted);
const stage = document.getElementById('stage');
const DESIGN_W = 1100, DESIGN_H = 619;
function fitStage() {
  const s = Math.min(innerWidth / DESIGN_W, innerHeight / DESIGN_H, 1.3);
  stage.style.transform = `scale(${s})`;
  stage.style.left = `${Math.max(0, (innerWidth - DESIGN_W * s) / 2)}px`;
  stage.style.top = `${Math.max(0, (innerHeight - DESIGN_H * s) / 2)}px`;
}
fitStage();
addEventListener('resize', fitStage);
addEventListener('orientationchange', () => setTimeout(fitStage, 80));
window.addEventListener('keydown', () => audio.start(), { once: true });
window.addEventListener('pointerdown', () => audio.start());
const app = {
  carId: 'vf7',
  paint: null,
  trackId: null,
  tracks: [],
  race: null,
  renderer: null,
  paused: DEBUG && params.has('paused'),
};
app.paint = carById(app.carId).paints[0].hex;

const ui = createUI(document.getElementById('ui'), {
  toMenu: () => show('menu'),
  toCars: () => { refreshCars(); show('cars'); },
  toTracks: () => { refreshTracks(); show('tracks'); },
  toSettings: () => { ui.setSettings(store.settings); show('settings'); },
  toCredits: () => show('credits'),
  pickCar(id) { app.carId = id; app.paint = carById(id).paints[0].hex; refreshCars(); },
  pickPaint(hex) { app.paint = hex; refreshCars(); },
  pickTrack(id) { app.trackId = id; refreshTracks(); },
  setSetting(k, v) { store.saveSettings({ [k]: v }); if (ui.current === 'settings') ui.setSettings(store.settings); else refreshTracks(); },
  startRace: () => startRace(),
  resume: () => { app.paused = false; show('race'); },
  back(screen) {
    if (screen === 'menu') return;
    if (screen === 'cars' || screen === 'credits' || screen === 'settings') show('menu');
    else if (screen === 'tracks') { refreshCars(); show('cars'); }
    else if (screen === 'pause') { app.paused = false; show('race'); }
    else if (screen === 'result') { refreshTracks(); show('tracks'); }
  },
  previewCar: (cv, car, paint) => vehicles.preview(cv, car, paint),
  previewTrack: (cv, track) => effects.thumbnail(cv, track),
});
const touch = createTouch(input, {
  pause: () => { if (ui.current === 'race' && app.race && !app.race.finished) { app.paused = true; show('pause'); } },
  gesture: () => audio.start(),
  enabled: () => { touch.setRacing(ui.current === 'race'); fsBtn.classList.toggle('hidden', !(!isStandalone() && ui.current === 'menu')); fitStage(); },
});
const fsBtn = document.getElementById('fs-btn'), fsTip = document.getElementById('fs-tip');
fsBtn.addEventListener('click', () => { audio.start(); goFullscreen(true, () => fsTip.classList.remove('hidden')); });
document.getElementById('fs-tip-close').addEventListener('click', () => fsTip.classList.add('hidden'));
const hud = createHud(ui.raceEl);

const menuVideo = document.getElementById('menu-video');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function playMenuVideo() { if (!menuVideo || reducedMotion) return; menuVideo.play().catch(() => {}); } // iOS tiết kiệm pin chặn autoplay → poster hiện, thử lại khi chạm
window.addEventListener('pointerdown', () => { if (ui.current === 'menu') playMenuVideo(); });
function show(name) {
  ui.show(name);
  if (menuVideo) { const onMenu = name === 'menu'; menuVideo.classList.toggle('hidden', !onMenu); if (onMenu) playMenuVideo(); else menuVideo.pause(); }
  touch.setRacing(name === 'race');
  fsBtn.classList.toggle('hidden', !(touch.enabled && !isStandalone() && name === 'menu'));
  if (name === 'race' && touch.enabled) goFullscreen(false, () => {});
}
function refreshCars() { ui.setCars(CARS, app.carId, app.paint); }
function refreshTracks() {
  const bests = {};
  for (const t of app.tracks) bests[t.id] = store.getBest(t.id, app.carId);
  ui.setTracks(app.tracks, app.trackId, bests, store.settings);
}

input.setOnPress((action) => {
  if (ui.current === 'race') {
    if (action === 'back') { app.paused = true; show('pause'); }
    else if (action === 'mute') store.saveSettings({ muted: !store.settings.muted });
    return;
  }
  ui.press(action);
});

async function loadTrackIndex() {
  try {
    const res = await fetch('assets/tracks/index.json');
    if (!res.ok) throw new Error(res.status);
    app.tracks = await res.json();
  } catch { app.tracks = []; }
  app.trackId = app.tracks[0]?.id ?? null;
}

async function startRace() {
  const track = app.tracks.find(t => t.id === app.trackId);
  if (!track) { show('tracks'); return; }
  show('loading');
  let data;
  try { data = hydrateTrack(await (await fetch(`assets/tracks/${track.id}.json`)).json()); }
  catch (e) { console.error('Không tải được đường', e); show('tracks'); return; }
  const weatherId = params.get('weather') || pickWeather(data.weatherPresets, store.settings.randomWeather);
  app.race = createRace({ track: data, carId: app.carId, paint: app.paint, settings: store.settings, seed: Date.now() % 100000, weatherId, bestSectors: store.getBestSectors(track.id, app.carId) });
  app.renderer = createRenderer(ctx, app.race, { vehicles, effects, minimap: store.settings.minimap ? hud.minimap : null });
  hud.reset();
  hud.showMinimap(store.settings.minimap);
  input.reset();
  app.paused = DEBUG && params.has('paused');
  show('race');
}

function finishRace(result) {
  const isRecord = store.putBest(app.trackId, app.carId, result.time);
  if (result.sectors?.length) store.putSectors(app.trackId, app.carId, result.sectors);
  audio.event('finish');
  const track = app.tracks.find(t => t.id === app.trackId);
  ui.setResult({ ...result, isRecord, best: store.getBest(app.trackId, app.carId), trackName: track.name, carName: carById(app.carId).name });
  show('result');
}

// ---- Vòng lặp ----
let last = performance.now(), acc = 0;
function stepOnce() {
  const race = app.race;
  if (!race) return;
  race.input = input.step(CFG.STEP);
  const incBefore = race.incidents;
  race.update(race.input, CFG.STEP);
  if (race.incidents > incBefore) audio.event(/RÀO/.test(race.toast?.text || '') ? 'crash' : /XE MÁY/.test(race.toast?.text || '') ? 'bike' : 'hit');
  if (race.finished && !race.reported) { race.reported = true; finishRace(race.result()); }
}
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (ui.current === 'race' && app.race && !app.paused) {
    acc += dt;
    let n = 0;
    while (acc >= CFG.STEP && n < CFG.MAX_STEPS_PER_FRAME) { stepOnce(); acc -= CFG.STEP; n++; }
    if (n === CFG.MAX_STEPS_PER_FRAME) acc = 0;
  }
  if ((ui.current === 'race' || ui.current === 'pause') && app.renderer) {
    app.renderer.draw();
    const snap = app.race.snapshot();
    hud.update(snap);
    if (ui.current === 'race' && !app.paused) audio.update(snap); else audio.silence();
  } else if (ui.current !== 'race') {
    drawBackdrop();
    audio.silence();
  }
  requestAnimationFrame(frame);
}
function drawBackdrop() {
  const { W, H } = CFG.RENDER;
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, W, H);
}

if (DEBUG) {
  window.vfDebug = {
    get screen() { return ui.current; },
    get app() { return app; },
    press: a => { if (ui.current === 'race' && a === 'back') { app.paused = true; show('pause'); } else ui.press(a); },
    step(n = 60) { for (let i = 0; i < n; i++) stepOnce(); if (app.renderer) { app.renderer.draw(); hud.update(app.race.snapshot()); } return app.race?.snapshot(); },
    state: () => app.race?.snapshot(),
    setInput: v => input.setVirtual(v),
    pause: v => { app.paused = v; },
    bench(n = 300) {
      if (!app.race) return null;
      let tu = 0, tr = 0;
      for (let i = 0; i < n; i++) {
        let t = performance.now(); stepOnce(); tu += performance.now() - t;
        t = performance.now(); app.renderer.draw(); tr += performance.now() - t;
      }
      return { updateMs: tu / n, renderMs: tr / n };
    },
  };
}

await loadTrackIndex();
if (params.get('car') && carById(params.get('car'))) { app.carId = params.get('car'); app.paint = carById(app.carId).paints[0].hex; }
if (params.get('track') && app.tracks.some(t => t.id === params.get('track'))) app.trackId = params.get('track');
refreshCars();
show('menu');
requestAnimationFrame(frame);
