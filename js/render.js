// Renderer pseudo-3D (Canvas 2D). Thế giới tính bằng mét; chỉ đọc state từ race.
import { CFG } from './config.js';
import { clamp, rng } from './util.js';
import { segIndexAt, wrapZ, yAt } from './track.js';
import { HINT } from '../tools/trackbuild.mjs';

const { W, H, CAM_H, FOV_DEG, DRAW_SEGS, PLAYER_AHEAD, PLAYER_SCALE } = CFG.RENDER;
const CAM_DEPTH = 1 / Math.tan(((FOV_DEG / 2) * Math.PI) / 180);
const HALF_W = W / 2;
const BACKDROP_W = Math.round(W * (360 / FOV_DEG));

const SCENERY = {
  coast: { groundL: ['#3b6b3a', '#356233'], groundR: ['#2f7fae', '#2a75a2'], rumble: ['#e8e8e8', '#c0392b'], lane: '#e6e6e6', road: ['#5d6068', '#585b63'], railR: true, railL: false },
  karst: { groundL: ['#6b7a5c', '#617052'], groundR: ['#4c5a48', '#445240'], rumble: ['#e8e8e8', '#c0392b'], lane: '#e0e0e0', road: ['#5a5d63', '#55585e'], railR: true, railL: false },
  pine: { groundL: ['#2f5a33', '#2a5030'], groundR: ['#2f5a33', '#2a5030'], rumble: ['#e6e6e6', '#c93636'], lane: '#dcdcdc', road: ['#55585f', '#50535a'], railR: true, railL: false },
  delta: { groundL: ['#5e8a3c', '#567f36'], groundR: ['#5e8a3c', '#567f36'], rumble: ['#f2f2f2', '#f2f2f2'], lane: '#f0f0f0', road: ['#4a4d55', '#45484f'], railR: true, railL: true },
  city: { groundL: ['#1a1c22', '#16181e'], groundR: ['#1a1c22', '#16181e'], rumble: ['#9a9da4', '#8d9097'], lane: '#c9c9cf', road: ['#2b2d35', '#26282f'], railR: false, railL: false },
};

function dim(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(clamp(c * k, 0, 255));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function poly(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
}
function project(p, camX, camY, camZ) {
  p.camera.z = p.world.z - camZ;
  p.screen.scale = CAM_DEPTH / p.camera.z;
  p.screen.x = Math.round(HALF_W + p.screen.scale * (p.world.x - camX) * HALF_W);
  p.screen.y = Math.round(H / 2 - p.screen.scale * (p.world.y - camY) * (H / 2));
}

/** Đặt cảnh ven đường theo preset (một lần). offset tính bằng mét từ tâm đường, + là phải. */
function placeScenery(track, seed) {
  const r = rng(seed), sc = track.scenery, road = track.road;
  const outerL = s => -(s.halfM + road.shoulderL), outerR = s => s.halfM + road.shoulderR;
  track.segments.forEach((s, i) => {
    s.sprites = [];
    const cliffR = (s.hint & HINT.cliffRight) !== 0, cliffL = (s.hint & HINT.cliffLeft) !== 0;
    if (sc === 'coast') {
      if (i % 3 === 0) s.sprites.push({ k: r() > 0.7 ? 'palm' : 'tree', o: outerL(s) - 2 - r() * 6, w: 1.6 + r(), h: 4 + r() * 3 });
      if (i % 11 === 5) s.sprites.push({ k: 'rock', o: outerL(s) - 1 - r() * 2, w: 1.2 + r(), h: 0.8 + r() * 0.6 });
    } else if (sc === 'karst') {
      if (i % 4 === 1) s.sprites.push({ k: 'rock', o: (r() > 0.5 ? 1 : -1) * (outerR(s) + 1.5 + r() * 4), w: 1.5 + r() * 2, h: 1 + r() * 2 });
      if (i % 7 === 3) s.sprites.push({ k: 'tree', o: outerL(s) - 3 - r() * 8, w: 1.4, h: 3 + r() * 2 });
    } else if (sc === 'pine') {
      if (i % 2 === 0) s.sprites.push({ k: 'pine', o: outerL(s) - 1.5 - r() * 6, w: 2 + r(), h: 6 + r() * 5 });
      if (i % 2 === 1) s.sprites.push({ k: 'pine', o: outerR(s) + 1.5 + r() * 6, w: 2 + r(), h: 6 + r() * 5 });
    } else if (sc === 'delta') {
      if (i % 12 === 0) s.sprites.push({ k: 'pole', o: outerR(s) + 6, w: 0.3, h: 9 });
      if (i % 9 === 4) s.sprites.push({ k: 'tree', o: (r() > 0.5 ? 1 : -1) * (outerR(s) + 14 + r() * 20), w: 2.5, h: 5 + r() * 3 });
    } else if (sc === 'city') {
      if (i % 8 === 0) { s.sprites.push({ k: 'lamp', o: outerL(s) - 0.8, w: 0.3, h: 9 }); s.sprites.push({ k: 'lamp', o: outerR(s) + 0.8, w: 0.3, h: 9 }); }
      if (i % 6 === 2) s.sprites.push({ k: 'bld', o: outerL(s) - 10 - r() * 8, w: 10 + r() * 12, h: 14 + r() * 30, s: r() });
      if (i % 6 === 5) s.sprites.push({ k: 'bld', o: outerR(s) + 10 + r() * 8, w: 10 + r() * 12, h: 14 + r() * 30, s: r() });
    }
    if (cliffR) s.rail = 'R'; if (cliffL) s.rail = 'L';
    if (i % Math.round(1000 / track.L) === 0 && i > 0) s.sprites.push({ k: 'kmpost', o: outerR(s) + 0.6, w: 0.3, h: 1.1, n: Math.round((i * track.L) / 1000) });
  });
  for (const sg of track.signs) {
    const s = track.segments[sg.i];
    s.sprites.push({ k: 'chevron', o: sg.dir > 0 ? outerL(s) - 0.8 : outerR(s) + 0.8, w: 1.2, h: 2.4, dir: sg.dir, severity: sg.severity });
  }
}

function makeBackdrop(scenery, weather) {
  const cv = document.createElement('canvas');
  cv.width = BACKDROP_W; cv.height = H / 2 + 60;
  const ctx = cv.getContext('2d'), r = rng(99), Y = H / 2, k = weather.ambient;
  const night = weather.night;
  if (scenery === 'coast') {
    ctx.fillStyle = dim('#2f7fae', k); ctx.fillRect(0, Y - 8, cv.width, 80);
    ctx.fillStyle = dim('#5f8fa8', k);
    for (let i = 0; i < 12; i++) { const x = r() * cv.width, w = 200 + r() * 400, h = 30 + r() * 70; ctx.beginPath(); ctx.moveTo(x - w, Y); ctx.lineTo(x, Y - h); ctx.lineTo(x + w, Y); ctx.fill(); }
    if (!night) { ctx.fillStyle = '#fff2c2'; ctx.beginPath(); ctx.arc(cv.width * 0.3, Y * 0.35, 34, 0, 7); ctx.fill(); }
  } else if (scenery === 'karst') {
    for (const [c, n, hh] of [['#7f8ea1', 14, 160], ['#5f6f66', 18, 110], ['#4b5b4a', 24, 70]]) {
      ctx.fillStyle = dim(c, k);
      for (let i = 0; i < n; i++) { const x = r() * cv.width, w = 60 + r() * 120, h = hh * (0.6 + r() * 0.6); ctx.beginPath(); ctx.moveTo(x - w, Y + 10); ctx.lineTo(x - w * 0.3, Y - h); ctx.lineTo(x + w * 0.2, Y - h * 0.9); ctx.lineTo(x + w, Y + 10); ctx.fill(); }
    }
  } else if (scenery === 'pine') {
    for (const [c, n, hh] of [['#6f8fa8', 10, 140], ['#4f7360', 14, 90]]) {
      ctx.fillStyle = dim(c, k);
      for (let i = 0; i < n; i++) { const x = r() * cv.width, w = 150 + r() * 300, h = hh * (0.6 + r() * 0.7); ctx.beginPath(); ctx.moveTo(x - w, Y + 10); ctx.quadraticCurveTo(x, Y - h * 1.6, x + w, Y + 10); ctx.fill(); }
    }
  } else if (scenery === 'delta') {
    ctx.fillStyle = dim('#5c7a4a', k); ctx.fillRect(0, Y - 6, cv.width, 30);
    ctx.fillStyle = dim('#3f5a38', k);
    for (let i = 0; i < 60; i++) { const x = r() * cv.width; ctx.fillRect(x, Y - 12 - r() * 8, 6 + r() * 14, 12); }
  } else {
    for (let i = 0; i < 90; i++) {
      const bw = 24 + r() * 50, bh = 30 + r() * 150, x = r() * cv.width;
      ctx.fillStyle = night ? '#0d1022' : dim('#4a5566', k); ctx.fillRect(x, Y - bh, bw, bh + 12);
      if (night) { ctx.fillStyle = r() > 0.5 ? 'rgba(255,200,120,0.55)' : 'rgba(120,220,255,0.5)'; for (let y = Y - bh + 6; y < Y - 6; y += 12) for (let xx = x + 4; xx < x + bw - 4; xx += 9) if (r() > 0.5) ctx.fillRect(xx, y, 3, 5); }
    }
    if (night) { ctx.fillStyle = '#e8e6d8'; ctx.beginPath(); ctx.arc(cv.width * 0.72, Y * 0.3, 22, 0, 7); ctx.fill(); }
  }
  return cv;
}

function drawSprite(ctx, sp, x, y, scale, clipY, weather) {
  const dw = scale * HALF_W * sp.w, dh = scale * HALF_W * sp.h;
  if (dw < 0.6) return;
  const dx = x - dw / 2, dy = y - dh;
  if (dy > clipY) return;
  const k = weather.ambient, night = weather.night;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, clipY); ctx.clip();
  switch (sp.k) {
    case 'tree': ctx.fillStyle = dim('#6b4a2e', k); ctx.fillRect(x - dw * 0.07, dy + dh * 0.55, dw * 0.14, dh * 0.45); ctx.fillStyle = dim('#2f7a3a', k); ctx.beginPath(); ctx.ellipse(x, dy + dh * 0.35, dw / 2, dh * 0.38, 0, 0, 7); ctx.fill(); break;
    case 'palm': ctx.fillStyle = dim('#7a5a3a', k); ctx.fillRect(x - dw * 0.05, dy + dh * 0.25, dw * 0.1, dh * 0.75); ctx.fillStyle = dim('#2f8a4a', k); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * dw * 0.25, dy + dh * 0.25 + Math.sin(a) * dw * 0.12, dw * 0.32, dw * 0.1, a, 0, 7); ctx.fill(); } break;
    case 'pine': ctx.fillStyle = dim('#4a3324', k); ctx.fillRect(x - dw * 0.05, dy + dh * 0.7, dw * 0.1, dh * 0.3); ctx.fillStyle = dim('#245c33', k); ctx.beginPath(); ctx.moveTo(x, dy); ctx.lineTo(x + dw / 2, dy + dh * 0.78); ctx.lineTo(x - dw / 2, dy + dh * 0.78); ctx.fill(); ctx.fillStyle = dim('#2f7a42', k); ctx.beginPath(); ctx.moveTo(x, dy + dh * 0.1); ctx.lineTo(x + dw * 0.35, dy + dh * 0.5); ctx.lineTo(x - dw * 0.35, dy + dh * 0.5); ctx.fill(); break;
    case 'rock': ctx.fillStyle = dim('#7e8288', k); ctx.beginPath(); ctx.ellipse(x, dy + dh, dw / 2, dh, 0, Math.PI, 0); ctx.fill(); break;
    case 'pole': ctx.fillStyle = dim('#8a8f96', k); ctx.fillRect(x - dw / 2, dy, dw, dh); ctx.fillRect(x - dw * 3, dy + dh * 0.08, dw * 6, dw * 0.8); break;
    case 'lamp': ctx.fillStyle = dim('#5a5f6b', k); ctx.fillRect(x - dw / 2, dy, dw, dh); if (night) { ctx.fillStyle = 'rgba(255,225,160,0.25)'; ctx.beginPath(); ctx.arc(x, dy, dw * 3, 0, 7); ctx.fill(); ctx.fillStyle = '#fff1c4'; ctx.beginPath(); ctx.arc(x, dy, dw * 1.2, 0, 7); ctx.fill(); } break;
    case 'bld': { ctx.fillStyle = night ? '#12142a' : dim('#8d95a3', k); ctx.fillRect(dx, dy, dw, dh); if (dw > 8) { ctx.fillStyle = night ? (sp.s > 0.5 ? 'rgba(255,190,110,0.7)' : 'rgba(120,225,255,0.7)') : 'rgba(30,40,60,0.35)'; const cw = dw / 6, ch = dh / Math.max(3, Math.round(sp.h / 3)); for (let rI = 0; rI < Math.round(sp.h / 3); rI++) for (let c = 0; c < 6; c++) if (((rI * 7 + c * 3 + Math.round(sp.s * 50)) % 5) !== 0) ctx.fillRect(dx + c * cw + cw * 0.25, dy + rI * ch + ch * 0.25, cw * 0.5, ch * 0.45); } break; }
    case 'kmpost': ctx.fillStyle = '#f4f4f4'; ctx.fillRect(dx, dy, dw, dh); ctx.fillStyle = '#c0392b'; ctx.fillRect(dx, dy, dw, dh * 0.3); if (dw > 6) { ctx.fillStyle = '#111'; ctx.font = `${Math.max(6, dw * 0.9)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(String(sp.n), x, dy + dh * 0.8); } break;
    case 'chevron': { ctx.fillStyle = dim('#4b5058', k); ctx.fillRect(x - dw * 0.05, dy + dh * 0.5, dw * 0.1, dh * 0.5); ctx.fillStyle = sp.severity > 1 ? '#f2c020' : '#f2f2f2'; ctx.fillRect(dx, dy, dw, dh * 0.5); if (dw > 5) { ctx.fillStyle = '#111'; ctx.lineWidth = Math.max(1, dw * 0.12); ctx.strokeStyle = '#111'; const d = sp.dir, m = dw * 0.28; ctx.beginPath(); ctx.moveTo(x - d * m, dy + dh * 0.08); ctx.lineTo(x + d * m * 0.4, dy + dh * 0.25); ctx.lineTo(x - d * m, dy + dh * 0.42); ctx.stroke(); } break; }
  }
  ctx.restore();
}

export function createRenderer(ctx, race, mods) {
  const { track, weather } = race;
  const pal = SCENERY[track.scenery] || SCENERY.coast;
  const k = weather.ambient;
  const P = {
    groundL: pal.groundL.map(c => dim(c, k)), groundR: pal.groundR.map(c => dim(c, k)), rumble: pal.rumble.map(c => dim(c, k)),
    lane: dim(pal.lane, Math.max(0.7, k)), road: pal.road.map(c => dim(c, k)), rail: dim('#c9ccd2', k), post: dim('#6b7079', k),
  };
  placeScenery(track, 7);
  const backdrop = makeBackdrop(track.scenery, weather);
  const rainLayer = weather.rain ? mods.effects.makeRainLayer(W, H, weather.rain) : null;
  const minimap = mods.minimap ? mods.effects.createMinimap(mods.minimap, track) : null;
  const fogK = 2.3 / (weather.visibilityM * weather.visibilityM);
  const fogOf = d => 1 - Math.exp(-d * d * fogK);

  const nearP = { world: { x: 0, y: 0, z: 0 }, camera: {}, screen: {} }; // mép gần của segment đầu, kéo sát camera

  function renderSegment(s, alt, p1 = s.p1) {
    const p2 = s.p2, x1 = p1.screen.x, y1 = p1.screen.y, x2 = p2.screen.x, y2 = p2.screen.y;
    const w1 = p1.screen.scale * s.halfM * HALF_W, w2 = p2.screen.scale * s.halfM * HALF_W;
    const sl1 = p1.screen.scale * track.road.shoulderL * HALF_W, sl2 = p2.screen.scale * track.road.shoulderL * HALF_W;
    const sr1 = p1.screen.scale * track.road.shoulderR * HALF_W, sr2 = p2.screen.scale * track.road.shoulderR * HALF_W;
    poly(ctx, 0, y1, x1 - w1 - sl1, y1, x2 - w2 - sl2, y2, 0, y2, P.groundL[alt]);
    poly(ctx, x1 + w1 + sr1, y1, W, y1, W, y2, x2 + w2 + sr2, y2, P.groundR[alt]);
    poly(ctx, x1 - w1 - sl1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - sl2, y2, P.rumble[alt]);
    poly(ctx, x1 + w1, y1, x1 + w1 + sr1, y1, x2 + w2 + sr2, y2, x2 + w2, y2, P.rumble[alt]);
    poly(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, P.road[alt]);
    const lanes = track.road.lanes;
    const lw1 = Math.max(1, p1.screen.scale * 0.15 * HALF_W), lw2 = Math.max(1, p2.screen.scale * 0.15 * HALF_W);
    if (lanes > 1 && s.i % 3 === 0) {
      for (let l = 1; l < lanes; l++) {
        const f = -1 + (2 * l) / lanes;
        poly(ctx, x1 + f * w1 - lw1 / 2, y1, x1 + f * w1 + lw1 / 2, y1, x2 + f * w2 + lw2 / 2, y2, x2 + f * w2 - lw2 / 2, y2, P.lane);
      }
    }
    if (!track.road.twoWay || lanes > 2) { // vạch biên liền
      poly(ctx, x1 - w1, y1, x1 - w1 + lw1, y1, x2 - w2 + lw2, y2, x2 - w2, y2, P.lane);
      poly(ctx, x1 + w1 - lw1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 - lw2, y2, P.lane);
    }
    // hộ lan tôn sóng
    const railR = s.rail === 'R' || (pal.railR && s.rail !== 'L'), railL = s.rail === 'L' || pal.railL;
    const rh1 = p1.screen.scale * 0.75 * HALF_W, rh2 = p2.screen.scale * 0.75 * HALF_W;
    if (railR && rh1 > 0.8) { const ox1 = x1 + w1 + sr1, ox2 = x2 + w2 + sr2; poly(ctx, ox1, y1 - rh1 * 0.6, ox1, y1 - rh1 * 0.95, ox2, y2 - rh2 * 0.95, ox2, y2 - rh2 * 0.6, P.rail); if (s.i % 2 === 0) { ctx.fillStyle = P.post; ctx.fillRect(ox1 - 1, y1 - rh1 * 0.95, Math.max(1, rh1 * 0.08), rh1 * 0.95); } }
    if (railL && rh1 > 0.8) { const ox1 = x1 - w1 - sl1, ox2 = x2 - w2 - sl2; poly(ctx, ox1, y1 - rh1 * 0.6, ox1, y1 - rh1 * 0.95, ox2, y2 - rh2 * 0.95, ox2, y2 - rh2 * 0.6, P.rail); }
    if (s.i < 3 || (track.kind === 'loop' && s.i > track.n - 3)) { // vạch xuất phát/đích kẻ ô
      const cells = 8;
      for (let c = 0; c < cells; c++) { const f1 = -1 + (2 * c) / cells, f2 = -1 + (2 * (c + 1)) / cells; poly(ctx, x1 + f1 * w1, y1, x1 + f2 * w1, y1, x2 + f2 * w2, y2, x2 + f1 * w2, y2, (c + s.i) % 2 ? '#111' : '#eee'); }
    }
  }

  function draw() {
    const p = race.player;
    const camZ = p.z - PLAYER_AHEAD;
    const camY = yAt(track, p.z) + CAM_H;
    // trời
    const g = ctx.createLinearGradient(0, 0, 0, H / 2); g.addColorStop(0, weather.sky[0]); g.addColorStop(1, weather.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // backdrop parallax theo heading thật
    let ox = -(((p.heading / (2 * Math.PI)) * BACKDROP_W) % BACKDROP_W); if (ox > 0) ox -= BACKDROP_W;
    ctx.drawImage(backdrop, ox, H / 2 - backdrop.height + 60); ctx.drawImage(backdrop, ox + BACKDROP_W, H / 2 - backdrop.height + 60);
    // đường
    const baseIdx = segIndexAt(track, camZ);
    const base = track.segments[baseIdx];
    const basePct = clamp((wrapZ(track, camZ) - base.z0) / track.L, 0, 1);
    let maxy = H, x = 0, dx = -(base.curve * basePct);
    const drawn = [];
    for (let n = 0; n < DRAW_SEGS; n++) {
      const idx = baseIdx + n;
      if (idx >= track.n && track.kind !== 'loop') break;
      const s = track.segments[idx % track.n];
      const zOff = idx >= track.n ? track.lengthM : 0;
      s.fog = fogOf(n * track.L); s.clip = maxy;
      project(s.p1, p.x - x, camY, camZ - zOff); project(s.p2, p.x - x - dx, camY, camZ - zOff);
      x += dx; dx += s.curve;
      s.visible = false;
      let p1 = s.p1;
      if (s.p2.camera.z <= CAM_DEPTH) continue; // cả segment nằm sau mặt phẳng gần
      if (s.p1.camera.z <= CAM_DEPTH) { // mép gần sau camera (L = 4 m > khoảng camera→mép màn hình): chiếu điểm ngay trước camera
        const zNear = camZ + CAM_DEPTH * 1.02;
        nearP.world.z = zNear; nearP.world.y = yAt(track, zNear); nearP.world.x = 0;
        project(nearP, p.x - x + dx, camY, camZ); p1 = nearP;
      }
      if (s.p2.screen.y >= p1.screen.y || s.p2.screen.y >= maxy) continue;
      s.visible = true;
      renderSegment(s, Math.floor(s.i / 3) % 2, p1);
      if (s.fog > 0.01) { ctx.globalAlpha = s.fog; ctx.fillStyle = weather.fogColor; ctx.fillRect(0, s.p2.screen.y, W, p1.screen.y - s.p2.screen.y); ctx.globalAlpha = 1; }
      maxy = p1.screen.y;
      drawn.push(s);
    }
    // sprite & xe: từ xa tới gần
    for (let i = drawn.length - 1; i >= 0; i--) {
      const s = drawn[i];
      ctx.globalAlpha = Math.max(0.05, 1 - s.fog);
      for (const sp of s.sprites) drawSprite(ctx, sp, s.p1.screen.x + s.p1.screen.scale * sp.o * HALF_W, s.p1.screen.y, s.p1.screen.scale, s.clip, weather);
      for (const c of s.cars) {
        const pct = clamp((wrapZ(track, c.z) - s.z0) / track.L, 0, 1);
        const sc = s.p1.screen.scale + (s.p2.screen.scale - s.p1.screen.scale) * pct;
        const sx = s.p1.screen.x + (s.p2.screen.x - s.p1.screen.x) * pct + sc * c.x * HALF_W;
        const sy = s.p1.screen.y + (s.p2.screen.y - s.p1.screen.y) * pct;
        const w = sc * HALF_W * (c.spec ? c.spec.widthMm / 1000 : c.w);
        if (w < 2 || sy - w > s.clip) continue;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, s.clip); ctx.clip();
        if (weather.rain) mods.effects.drawSpray(ctx, sx, sy, w, c.v / 40);
        mods.vehicles.drawVehicle(ctx, sx, sy, w, c, weather);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    if (weather.rain) mods.effects.drawWetSheen(ctx, W, H, weather.rain > 1 ? 0.14 : 0.1);
    // xe người chơi
    const inp = race.input || {};
    const pw = (CAM_DEPTH / PLAYER_AHEAD) * HALF_W * (race.spec.widthMm / 1000) * PLAYER_SCALE;
    const bounce = (Math.random() - 0.5) * 2 * (p.v / 60) * (p.offroad ? 3 : 0.6);
    if (weather.rain) mods.effects.drawSpray(ctx, W / 2, H - 14, pw, p.v / 40, 0.45);
    mods.vehicles.drawCar(ctx, W / 2 + p.vLat * 6, H - 14 + bounce, pw, race.spec, p.paint, { steer: inp.steer || 0, night: weather.night, brake: (inp.brake || 0) > 0 || p.powerW < -0.15 * race.spec.powerKw * 1000, lights: weather.lights });
    if (weather.night) mods.effects.drawNightMask(ctx, W, H, weather.rain ? 0.6 : 0.55);
    if (rainLayer) mods.effects.drawRain(ctx, rainLayer, race.clock, W, H);
    if (minimap) minimap.draw(p, race.cars, race.traffic);
    // đếm ngược
    if (race.phase === 'countdown') {
      const n = Math.ceil(race.countdown);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.fillStyle = n <= 1 ? '#3ee8c8' : '#fff';
      ctx.font = '800 180px "Avenir Next Condensed", Impact, sans-serif';
      ctx.fillText(n > 3 ? 'SẴN SÀNG' : String(n), W / 2, H / 2 + 60);
    }
  }
  return { draw };
}
