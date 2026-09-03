// Hiệu ứng và hình phụ trợ: thumbnail tuyến từ toạ độ thật (minimap/mưa/đêm bổ sung sau).
import { toLocalMeters } from './geo.js';

/** Vẽ hình tuyến (polyline lat/lon) vào canvas, xanh = xuất phát, đỏ = đích. */
export function thumbnail(canvas, track, { stroke = '#3ee8c8', bg = '#0b0c10' } = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const geo = track.geo || [];
  if (geo.length < 2) return;
  const pts = toLocalMeters(geo.map(([lat, lon]) => ({ lat, lon })));
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 10, sc = Math.min((W - 2 * pad) / Math.max(1, maxX - minX), (H - 2 * pad) / Math.max(1, maxY - minY));
  const ox = (W - (maxX - minX) * sc) / 2, oy = (H - (maxY - minY) * sc) / 2;
  const px = p => [ox + (p.x - minX) * sc, H - oy - (p.y - minY) * sc];
  ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = px(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  const [sx, sy] = px(pts[0]), [ex, ey] = px(pts[pts.length - 1]);
  ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, 7); ctx.fill();
  if (track.kind !== 'loop') { ctx.fillStyle = '#ff4d5e'; ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, 7); ctx.fill(); }
  return px;
}

/** Lớp mưa vẽ sẵn (vệt chéo), cuộn theo thời gian; intensity 1 hoặc 2. */
export function makeRainLayer(W, H, intensity = 1) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const n = 90 * intensity;
  ctx.strokeStyle = 'rgba(220,230,240,0.35)'; ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const x = Math.random() * W, y = Math.random() * H, len = 10 + Math.random() * 18;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * 0.18, y + len); ctx.stroke();
  }
  return cv;
}

export function drawRain(ctx, layer, t, W, H) {
  const off = (t * 520) % H;
  ctx.drawImage(layer, 0, off - H); ctx.drawImage(layer, 0, off);
}

/** Mặt đường ướt: ánh phản chiếu nhẹ từ chân trời xuống. */
export function drawWetSheen(ctx, W, H, alpha = 0.10) {
  const g = ctx.createLinearGradient(0, H / 2, 0, H);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`); g.addColorStop(0.5, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, H / 2, W, H / 2);
}

/** Ban đêm: tối dần ra rìa, sáng vùng trước mũi xe (chùm đèn pha). */
export function drawNightMask(ctx, W, H, strength = 0.55) {
  const g = ctx.createRadialGradient(W / 2, H * 0.62, W * 0.08, W / 2, H * 0.62, W * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, `rgba(0,0,0,${strength * 0.35})`); g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const cone = ctx.createRadialGradient(W / 2, H - 40, 10, W / 2, H - 40, H * 0.55);
  cone.addColorStop(0, 'rgba(255,240,200,0.16)'); cone.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = cone; ctx.fillRect(0, H * 0.3, W, H * 0.7);
}

/** Bụi nước sau xe khi mưa: elip mờ ở gầm, to theo tốc độ. */
export function drawSpray(ctx, x, y, w, speedFrac, alpha = 0.35) {
  if (speedFrac < 0.1) return;
  ctx.fillStyle = `rgba(225,232,240,${alpha * Math.min(1, speedFrac)})`;
  ctx.beginPath(); ctx.ellipse(x, y + 2, w * (0.5 + speedFrac * 0.5), w * 0.12 * (1 + speedFrac), 0, 0, Math.PI * 2); ctx.fill();
}

/** Minimap: nền vẽ một lần (thumbnail), mỗi frame chấm vị trí xe theo geo thật. */
export function createMinimap(canvas, track) {
  const base = document.createElement('canvas');
  base.width = canvas.width; base.height = canvas.height;
  const px = thumbnail(base, track, { stroke: 'rgba(62,232,200,0.9)', bg: 'rgba(11,12,16,0.55)' });
  const pts = toLocalMeters((track.geo || []).map(([lat, lon]) => ({ lat, lon })));
  const ctx = canvas.getContext('2d');
  const at = z => { if (!px || !pts.length) return null; const i = Math.min(pts.length - 1, Math.max(0, Math.round(z / 40))); return px(pts[i]); };
  return {
    draw(player, cars, traffic) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0);
      for (const c of cars) { const p = at(c.z); if (!p) continue; ctx.fillStyle = '#a7adba'; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 7); ctx.fill(); }
      const p = at(player.z);
      if (p) { ctx.fillStyle = '#3ee8c8'; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    },
  };
}
