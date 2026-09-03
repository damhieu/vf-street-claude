#!/usr/bin/env node
// Dựng assets/tracks/<id>.json từ OpenStreetMap (Overpass) + độ cao SRTM (Open Topo Data).
// Dùng: node tools/build_tracks.mjs [--only <id>] [--offline] [--refresh]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildGraph, routeThrough } from './osmgraph.mjs';
import { toLocalMeters, fromLocalMeters, buildProfile, interpolateNulls, movingAverage } from '../js/geo.js';
import { assembleTrack, validateTrack } from './trackbuild.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const OFFLINE = flag('--offline'), REFRESH = flag('--refresh');
const L = 4, ELEV_STEP_PTS = 5; // độ cao lấy mỗi 20 m
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const UA = 'VFStreet-trackbuilder/0.1 (personal browser racing game; offline data build)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cached(file, producer) {
  const p = path.join(ROOT, 'tools/cache', file);
  if (!REFRESH) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { /* chưa có cache */ } }
  if (OFFLINE) throw new Error(`--offline nhưng thiếu cache ${file}`);
  const data = await producer();
  await fs.writeFile(p, JSON.stringify(data));
  return data;
}

async function fetchJson(url, init, timeoutMs = 120000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal, headers: { 'User-Agent': UA, ...(init?.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

async function overpass(query) {
  let lastErr;
  for (const ep of OVERPASS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fetchJson(ep, { method: 'POST', body: new URLSearchParams({ data: query }) });
      } catch (e) { lastErr = e; console.warn(`  Overpass ${ep} lỗi (${e.message}), thử lại…`); await sleep(2000 * 2 ** attempt); }
    }
  }
  throw lastErr;
}

async function elevations(latlons) {
  const out = [];
  for (let i = 0; i < latlons.length; i += 100) {
    const chunk = latlons.slice(i, i + 100).map(p => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join('|');
    let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { data = await fetchJson(`https://api.opentopodata.org/v1/srtm30m?locations=${chunk}`, {}, 60000); break; }
      catch (e) { console.warn(`  Open Topo Data lỗi (${e.message}), thử lại…`); await sleep(3000); }
    }
    if (!data) throw new Error('Không lấy được độ cao');
    out.push(...data.results.map(r => r.elevation));
    await sleep(1100); // 1 request/s
  }
  return out;
}

function svgPreview(local, y, track) {
  const xs = local.map(p => p.x), ys = local.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 800, H = 500, pad = 30;
  const sc = Math.min((W - 2 * pad) / Math.max(1, maxX - minX), (H - 2 * pad) / Math.max(1, maxY - minY));
  const px = p => `${(pad + (p.x - minX) * sc).toFixed(1)},${(H - pad - (p.y - minY) * sc).toFixed(1)}`;
  const yMin = Math.min(...y), yMax = Math.max(...y);
  const ep = y.map((v, i) => `${(pad + (i / (y.length - 1)) * (W - 2 * pad)).toFixed(1)},${(H + 120 - 10 - ((v - yMin) / Math.max(1, yMax - yMin)) * 100).toFixed(1)}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 130}" style="background:#0f1117;font-family:sans-serif">
  <polyline fill="none" stroke="#3ee8c8" stroke-width="2" points="${local.map(px).join(' ')}"/>
  <circle cx="${px(local[0]).split(',')[0]}" cy="${px(local[0]).split(',')[1]}" r="6" fill="#4caf50"/>
  <circle cx="${px(local[local.length - 1]).split(',')[0]}" cy="${px(local[local.length - 1]).split(',')[1]}" r="6" fill="#ff4d5e"/>
  <text x="10" y="20" fill="#eef0f4" font-size="14">${track.name} · ${(track.lengthM / 1000).toFixed(2)} km · ${track.kind} · độ cao ${yMin.toFixed(0)}–${yMax.toFixed(0)} m</text>
  <polyline fill="none" stroke="#f2a900" stroke-width="2" points="${ep}"/>
  <text x="10" y="${H + 125}" fill="#a7adba" font-size="12">độ cao theo chiều dài (Bắc lên trên ở hình tuyến; xanh = xuất phát, đỏ = đích)</text>
</svg>`;
}

function report(track, route, prof) {
  const absK = track.kappa.map(Math.abs);
  let corners = 0, hairpins = 0;
  for (let i = 1; i < absK.length; i++) { if (absK[i] > 1 / 40 && absK[i - 1] <= 1 / 40) corners++; if (absK[i] > 1 / 20 && absK[i - 1] <= 1 / 20) hairpins++; }
  const dev = route.expectedLengthM ? ((track.lengthM - route.expectedLengthM) / route.expectedLengthM * 100).toFixed(1) + ' %' : 'n/a';
  console.log(`  chiều dài ${(track.lengthM / 1000).toFixed(2)} km (kỳ vọng ${route.expectedLengthM ? (route.expectedLengthM / 1000).toFixed(1) + ' km, lệch ' + dev : 'n/a'}), κ max 1/${(1 / Math.max(...absK)).toFixed(0)} m, cua ${corners} (gấp ${hairpins}), dốc max ${(Math.max(...track.slope.map(Math.abs)) * 100).toFixed(1)} %, độ cao ${Math.min(...track.y).toFixed(0)}–${Math.max(...track.y).toFixed(0)} m, biển ${track.signs.length}, polyline gốc ${prof.points.length} điểm`);
}

async function buildRoute(route) {
  console.log(`\n▶ ${route.id} — ${route.name}`);
  const [s, w, n, e] = route.bbox;
  const query = `[out:json][timeout:90];(way${route.filter}(${s},${w},${n},${e}););out body;>;out skel qt;`;
  const osm = await cached(`${route.id}.${createHash('sha1').update(query).digest('hex').slice(0, 8)}.overpass.json`, () => overpass(query));
  console.log(`  OSM: ${osm.elements.filter(x => x.type === 'way').length} way, ${osm.elements.filter(x => x.type === 'node').length} node`);
  const g = buildGraph(osm.elements, { ignoreOneway: !!route.ignoreOneway }); // circuit đóng đường: bỏ hạn chế một chiều
  const wps = [route.start, ...(route.via || []), route.end, ...(route.kind === 'loop' ? [route.start] : [])].map(([lat, lon]) => ({ lat, lon }));
  const r = routeThrough(g, wps);
  const local = toLocalMeters(r.points);
  const prof = buildProfile(local, L, { kappaMax: 1 / 12 });
  const geo = fromLocalMeters(prof.points, r.points[0]);
  const sampleIdx = []; for (let i = 0; i < geo.length; i += ELEV_STEP_PTS) sampleIdx.push(i); if (sampleIdx[sampleIdx.length - 1] !== geo.length - 1) sampleIdx.push(geo.length - 1);
  const samples = sampleIdx.map(i => geo[i]);
  const elevKey = createHash('sha1').update(samples.map(p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|')).digest('hex').slice(0, 8);
  const elev = await cached(`${route.id}.${elevKey}.elev.json`, () => elevations(samples));
  const smoothPts = Math.max(1, Math.round((route.elevSmoothM || 60) / (L * ELEV_STEP_PTS)));
  const filled = movingAverage(interpolateNulls(elev), smoothPts % 2 ? smoothPts : smoothPts + 1);
  const y = geo.map((_, i) => {
    const k = Math.min(sampleIdx.length - 2, Math.floor(i / ELEV_STEP_PTS));
    const a = sampleIdx[k], b = sampleIdx[k + 1];
    const t = b === a ? 0 : (i - a) / (b - a);
    return filled[k] + (filled[k + 1] - filled[k]) * t;
  });
  const srcTags = r.points.map(p => p.tags);
  const track = assembleTrack({ ...route, wayIds: [...new Set(r.points.map(p => p.wayId))], fetchedAt: new Date().toISOString() }, { kappa: prof.kappa, y, points: prof.points, srcTags, geo }, L);
  const errs = validateTrack(track);
  report(track, route, prof);
  if (errs.length) { console.error('  ✖ lỗi:', errs.join('; ')); return null; }
  await fs.writeFile(path.join(ROOT, 'assets/tracks', `${route.id}.json`), JSON.stringify(track));
  await fs.writeFile(path.join(ROOT, 'tools/out', `${route.id}.svg`), svgPreview(local, track.y, track));
  console.log(`  ✔ assets/tracks/${route.id}.json, tools/out/${route.id}.svg`);
  return track;
}

const routes = JSON.parse(await fs.readFile(path.join(ROOT, 'tools/routes.json'), 'utf8'));
const index = [];
for (const route of routes) {
  if (only && route.id !== only) { try { const t = JSON.parse(await fs.readFile(path.join(ROOT, 'assets/tracks', `${route.id}.json`), 'utf8')); index.push(t); } catch { /* chưa dựng */ } continue; }
  try { const t = await buildRoute(route); if (t) index.push(t); }
  catch (e) { console.error(`  ✖ ${route.id}: ${e.message}`); }
}
const summary = index.map(t => ({ id: t.id, name: t.name, place: t.place, desc: t.desc, kind: t.kind, laps: t.laps, lengthM: t.lengthM, weatherPresets: t.weatherPresets, trafficProfile: t.trafficProfile, geo: t.geo, y: [Math.min(...t.y), Math.max(...t.y)] }));
await fs.writeFile(path.join(ROOT, 'assets/tracks/index.json'), JSON.stringify(summary));
console.log(`\nindex.json: ${summary.map(t => t.id).join(', ')}`);
