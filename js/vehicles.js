// Vẽ xe bằng canvas theo kích thước/đặc điểm thật (đuôi xe cho góc nhìn đuổi, mặt trước cho xe ngược chiều) và xe giao thông.
import { wheelRadiusM } from './cars.js';

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function trap(ctx, cx, top, bottom, wTop, wBottom, rTop, rBottom) {
  const h = Math.max(1, bottom - top);
  rTop = Math.min(rTop, wTop / 2, h / 2); rBottom = Math.min(rBottom, wBottom / 2, h / 2);
  const xt1 = cx - wTop / 2, xt2 = cx + wTop / 2, xb1 = cx - wBottom / 2, xb2 = cx + wBottom / 2;
  ctx.beginPath();
  ctx.moveTo(xt1 + rTop, top); ctx.lineTo(xt2 - rTop, top); ctx.quadraticCurveTo(xt2, top, xt2 + ((xb2 - xt2) * rTop) / h, top + rTop);
  ctx.lineTo(xb2 - ((xb2 - xt2) * rBottom) / h, bottom - rBottom); ctx.quadraticCurveTo(xb2, bottom, xb2 - rBottom, bottom);
  ctx.lineTo(xb1 + rBottom, bottom); ctx.quadraticCurveTo(xb1, bottom, xb1 + ((xt1 - xb1) * rBottom) / h, bottom - rBottom);
  ctx.lineTo(xt1 + ((xb1 - xt1) * rTop) / h, top + rTop); ctx.quadraticCurveTo(xt1, top, xt1 + rTop, top); ctx.closePath();
}
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/**
 * Đuôi xe. cx: tâm, by: mép dưới bánh (mặt đường), w: bề rộng thân (px).
 * o: { steer (-1..1), night, brake, lights (đèn pha/hậu sáng), alpha }
 */
export function drawCar(ctx, cx, by, w, car, paint, o = {}) {
  const st = car.style, h = w * (car.heightMm / car.widthMm);
  const wheelOD = (2 * wheelRadiusM(car) * 1000) / car.heightMm; // phần chiều cao xe
  const wh = h * wheelOD * 0.5, ww = w * 0.17;
  const detail = w > 18, fine = w > 60;
  const shoulderW = w * 0.97, glassH = h * st.glass;
  const cabTop = by - h, shoulderY = cabTop + glassH;
  const bumperBottom = by - wh * 0.45;
  const lit = o.lights || o.night;
  const alpha = ctx.globalAlpha;
  if (o.alpha != null) ctx.globalAlpha = alpha * o.alpha;

  // bóng
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(cx, by, w * 0.58, Math.max(1, wh * 0.35), 0, 0, Math.PI * 2); ctx.fill();
  // bánh
  for (const x of [cx - w / 2 + w * 0.03, cx + w / 2 - w * 0.03 - ww]) {
    ctx.fillStyle = '#0c0d10'; rr(ctx, x, by - wh, ww, wh, ww * 0.25); ctx.fill();
    if (detail) { ctx.fillStyle = '#262a31'; rr(ctx, x + ww * 0.22, by - wh * 0.85, ww * 0.56, wh * 0.7, ww * 0.12); ctx.fill(); }
  }
  // cản dưới / diffuser
  ctx.fillStyle = '#1a1c21'; rr(ctx, cx - w * 0.48, bumperBottom - h * 0.06, w * 0.96, wh * 0.55 + h * 0.06, w * 0.03); ctx.fill();
  // thân
  ctx.fillStyle = paint; trap(ctx, cx, shoulderY, bumperBottom, shoulderW, w, w * 0.05, w * 0.05); ctx.fill();
  if (detail) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(cx - shoulderW / 2 + w * 0.02, shoulderY, shoulderW - w * 0.04, Math.max(1, h * 0.05));
    ctx.fillStyle = shade(paint, 0.72); ctx.fillRect(cx - w * 0.47, bumperBottom - h * 0.16, w * 0.94, h * 0.16);
  }
  // đèn hậu theo mẫu
  const red = o.brake ? '#ff3b4a' : '#d9202f', glow = o.brake ? 'rgba(255,60,70,0.55)' : lit ? 'rgba(255,60,70,0.3)' : null;
  const lt = Math.max(1.2, h * 0.05), ly = shoulderY + h * 0.09, lw = shoulderW * 0.92;
  ctx.fillStyle = red;
  const drawGlow = (x, y, gw, gh) => { if (!glow) return; ctx.fillStyle = glow; rr(ctx, x - gw * 0.1, y - gh * 0.6, gw * 1.2, gh * 2.2, gh); ctx.fill(); ctx.fillStyle = red; };
  switch (st.light) {
    case 'split': { // VF 3: hai cụm dọc ở góc, thanh crom nối
      const bw = lw * 0.16, bh = lt * 3.2;
      drawGlow(cx - lw / 2, ly, bw, bh); rr(ctx, cx - lw / 2, ly - bh * 0.3, bw, bh, bw * 0.3); ctx.fill();
      drawGlow(cx + lw / 2 - bw, ly, bw, bh); rr(ctx, cx + lw / 2 - bw, ly - bh * 0.3, bw, bh, bw * 0.3); ctx.fill();
      if (detail) { ctx.fillStyle = st.chrome ? '#c9ccd2' : shade(paint, 0.8); ctx.fillRect(cx - lw / 2 + bw, ly + lt * 0.4, lw - 2 * bw, Math.max(1, lt * 0.6)); }
      break; }
    case 'bar': // VF 5: thanh ngang cao trên cốp
      drawGlow(cx - lw / 2, ly, lw, lt); rr(ctx, cx - lw / 2, ly, lw, lt, lt / 2); ctx.fill();
      break;
    case 'wingV': { // VF 7: hai "cánh" tam giác nối bằng dải chữ V
      const wing = lw * 0.28, wh2 = lt * 3;
      drawGlow(cx - lw / 2, ly, lw, lt);
      ctx.beginPath(); ctx.moveTo(cx - lw / 2, ly); ctx.lineTo(cx - lw / 2 + wing, ly); ctx.lineTo(cx - lw / 2 + wing * 0.6, ly + wh2); ctx.lineTo(cx - lw / 2 + wing * 0.1, ly + wh2 * 0.6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + lw / 2, ly); ctx.lineTo(cx + lw / 2 - wing, ly); ctx.lineTo(cx + lw / 2 - wing * 0.6, ly + wh2); ctx.lineTo(cx + lw / 2 - wing * 0.1, ly + wh2 * 0.6); ctx.closePath(); ctx.fill();
      ctx.lineWidth = Math.max(1, lt * 0.8); ctx.strokeStyle = red;
      ctx.beginPath(); ctx.moveTo(cx - lw / 2 + wing, ly + lt * 0.4); ctx.lineTo(cx, ly + lt * 1.6); ctx.lineTo(cx + lw / 2 - wing, ly + lt * 0.4); ctx.stroke();
      break; }
    default: { // barV: dải full-width với điểm nhấn chữ V ở giữa (VF 6/8/9)
      drawGlow(cx - lw / 2, ly, lw, lt); rr(ctx, cx - lw / 2, ly, lw, lt, lt / 2); ctx.fill();
      const vw = lw * 0.12;
      ctx.lineWidth = Math.max(1, lt * 0.7); ctx.strokeStyle = red;
      ctx.beginPath(); ctx.moveTo(cx - vw, ly + lt * 0.5); ctx.lineTo(cx, ly + lt * 1.9); ctx.lineTo(cx + vw, ly + lt * 0.5); ctx.stroke();
      const ew = lw * 0.14, eh = lt * 2.4;
      rr(ctx, cx - lw / 2, ly - lt * 0.5, ew, eh, lt * 0.5); ctx.fill(); rr(ctx, cx + lw / 2 - ew, ly - lt * 0.5, ew, eh, lt * 0.5); ctx.fill();
    }
  }
  if (fine) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; rr(ctx, cx - lw / 2 + lw * 0.02, ly + lt * 0.25, lw * 0.1, lt * 0.35, lt * 0.2); ctx.fill(); rr(ctx, cx + lw / 2 - lw * 0.12, ly + lt * 0.25, lw * 0.1, lt * 0.35, lt * 0.2); ctx.fill(); }
  // khoang kính
  const cabW = w * 0.9, roofW = w * st.roofW, cxs = cx + (o.steer || 0) * w * 0.02;
  ctx.fillStyle = st.blackRoof ? '#101216' : paint; trap(ctx, cxs, cabTop, shoulderY + h * 0.01, roofW, cabW, w * st.roofR, w * 0.02); ctx.fill();
  const gi = detail ? 0.07 : 0.04;
  const gg = ctx.createLinearGradient(0, cabTop, 0, shoulderY);
  gg.addColorStop(0, o.night ? '#1b2236' : '#3a4d66'); gg.addColorStop(1, o.night ? '#0c1019' : '#1b2533');
  ctx.fillStyle = gg; trap(ctx, cxs, cabTop + glassH * 0.2, shoulderY - glassH * 0.12, roofW - w * gi * 2, cabW - w * gi * 2, w * st.roofR * 0.7, w * 0.015); ctx.fill();
  if (fine) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; trap(ctx, cxs, cabTop + glassH * 0.22, cabTop + glassH * 0.45, roofW - w * gi * 2.4, roofW - w * gi * 1.2, w * st.roofR * 0.6, 0); ctx.fill(); }
  if (st.spoiler && detail) { ctx.fillStyle = st.blackRoof ? '#0b0c0f' : shade(paint, 0.8); rr(ctx, cxs - roofW / 2 - w * 0.03 * st.spoiler, cabTop - h * 0.02 * st.spoiler, roofW + w * 0.06 * st.spoiler, h * 0.05 + h * 0.03 * st.spoiler, w * 0.02); ctx.fill(); }
  if (st.rails && detail) { ctx.fillStyle = '#2a2d33'; const rw = w * 0.035, rh = h * 0.06; rr(ctx, cxs - roofW / 2 + w * 0.03, cabTop - rh, rw, rh, rw / 2); ctx.fill(); rr(ctx, cxs + roofW / 2 - w * 0.03 - rw, cabTop - rh, rw, rh, rw / 2); ctx.fill(); }
  // biển số
  if (detail) { const pw = w * st.plate, ph = h * 0.07, py = ly + lt * 2.6 + h * 0.03; ctx.fillStyle = '#eceef2'; rr(ctx, cx - pw / 2, py, pw, ph, ph * 0.15); ctx.fill(); if (fine) { ctx.fillStyle = '#1f2330'; ctx.fillRect(cx - pw * 0.36, py + ph * 0.3, pw * 0.72, ph * 0.4); } }
  ctx.globalAlpha = alpha;
}

/** Xem trước trong thẻ chọn xe. */
export function preview(canvas, car, paint) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const w = W * 0.78 * (car.widthMm / 1900);
  drawCar(ctx, W / 2, H * 0.95, w, car, paint, { lights: false });
}

const ASPECT = { bike: 2.0, car: 0.83, coach: 1.4, truck: 1.33, container: 1.6 };

function lights(ctx, x, y, w, h, front, night) {
  const r = Math.max(1, w * 0.11);
  if (front) {
    ctx.fillStyle = night ? 'rgba(255,240,200,0.35)' : 'rgba(255,240,200,0.0)';
    if (night) { ctx.beginPath(); ctx.arc(x - w * 0.32, y, r * 3, 0, 7); ctx.arc(x + w * 0.32, y, r * 3, 0, 7); ctx.fill(); }
    ctx.fillStyle = night ? '#fff8d6' : '#e8e4d0';
    ctx.beginPath(); ctx.arc(x - w * 0.32, y, r, 0, 7); ctx.arc(x + w * 0.32, y, r, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = night ? '#ff4a58' : '#d9202f';
    ctx.fillRect(x - w * 0.42, y - h * 0.5, w * 0.16, h); ctx.fillRect(x + w * 0.26, y - h * 0.5, w * 0.16, h);
  }
}

/** Xe giao thông: thân hình khối theo loại; dir = -1 nhìn thấy mặt trước (đèn pha). */
export function drawTraffic(ctx, sx, sy, w, c, weather) {
  const h = w * (ASPECT[c.kind] || 1), front = c.dir === -1, night = weather.night, color = c.color || '#888';
  const detail = w > 10;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.55, Math.max(1, w * 0.12), 0, 0, Math.PI * 2); ctx.fill();
  if (c.kind === 'bike') {
    const wh = h * 0.28;
    ctx.fillStyle = '#111'; ctx.fillRect(sx - w * 0.16, sy - wh, w * 0.32, wh); // bánh
    ctx.fillStyle = color; rr(ctx, sx - w * 0.5, sy - h * 0.55, w, h * 0.3, w * 0.15); ctx.fill(); // thân
    ctx.fillStyle = '#2c2c2c'; rr(ctx, sx - w * 0.42, sy - h * 0.95, w * 0.84, h * 0.45, w * 0.2); ctx.fill(); // người lái
    ctx.fillStyle = '#e0c060'; ctx.beginPath(); ctx.arc(sx, sy - h * 1.02, w * 0.28, 0, 7); ctx.fill(); // mũ bảo hiểm
    if (front) { ctx.fillStyle = night ? '#fff8d6' : '#e8e4d0'; ctx.beginPath(); ctx.arc(sx, sy - h * 0.42, Math.max(1, w * 0.14), 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#d9202f'; ctx.fillRect(sx - w * 0.14, sy - h * 0.42, w * 0.28, Math.max(1, h * 0.05)); }
    return;
  }
  const wh = w * 0.2;
  ctx.fillStyle = '#0c0d10'; ctx.fillRect(sx - w * 0.47, sy - wh, w * 0.17, wh); ctx.fillRect(sx + w * 0.3, sy - wh, w * 0.17, wh);
  const bodyTop = sy - h, bodyBottom = sy - wh * 0.4;
  ctx.fillStyle = color; rr(ctx, sx - w / 2, bodyTop, w, bodyBottom - bodyTop, w * 0.05); ctx.fill();
  if (c.kind === 'car') {
    ctx.fillStyle = night ? '#141a2a' : '#2a3a50'; rr(ctx, sx - w * 0.4, bodyTop + h * 0.08, w * 0.8, h * 0.3, w * 0.05); ctx.fill();
    lights(ctx, sx, bodyBottom - h * 0.32, w, Math.max(1, h * 0.08), front, night);
  } else if (c.kind === 'coach') {
    ctx.fillStyle = night ? '#1b2436' : '#3a4d66'; ctx.fillRect(sx - w * 0.44, bodyTop + h * 0.1, w * 0.88, h * 0.32);
    if (detail) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(sx - w * 0.44, bodyTop + h * 0.48, w * 0.88, Math.max(1, h * 0.03)); }
    lights(ctx, sx, bodyBottom - h * 0.12, w, Math.max(1, h * 0.06), front, night);
  } else { // truck / container
    if (front) { ctx.fillStyle = night ? '#1b2436' : '#3a4d66'; ctx.fillRect(sx - w * 0.42, bodyTop + h * 0.12, w * 0.84, h * 0.22); }
    else if (detail) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx - 1, bodyTop + h * 0.05, 2, h * 0.7); }
    if (c.kind === 'container' && detail) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 1; i < 6; i++) ctx.fillRect(sx - w / 2, bodyTop + (h * i) / 6, w, 1); }
    lights(ctx, sx, bodyBottom - h * 0.1, w, Math.max(1, h * 0.05), front, night);
  }
  if (detail) { ctx.fillStyle = '#eceef2'; ctx.fillRect(sx - w * 0.12, bodyBottom - h * 0.06, w * 0.24, Math.max(1, h * 0.05)); }
}

/** Vẽ một xe trong thế giới (AI hoặc giao thông) tại tâm sx, đáy sy, bề rộng w px. */
export function drawVehicle(ctx, sx, sy, w, c, weather) {
  if (c.spec) { drawCar(ctx, sx, sy, w, c.spec, c.paint, { night: weather.night, brake: c.braking, lights: weather.lights }); return; }
  drawTraffic(ctx, sx, sy, w, c, weather);
}
