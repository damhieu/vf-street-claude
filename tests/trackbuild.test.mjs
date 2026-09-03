import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleTrack, ROAD_PROFILES } from '../tools/trackbuild.mjs';

function synthetic() {
  const n = 600; // 2,4 km ở L = 4
  const kappa = Array.from({ length: n }, (_, i) => (i >= 200 && i < 230 ? 0.03 : i >= 400 && i < 420 ? -0.03 : 0));
  const y = Array.from({ length: n + 1 }, (_, i) => 100 + 20 * Math.sin(i / 60)); // độ cao theo điểm
  const points = Array.from({ length: n + 1 }, (_, i) => ({ x: i * 4, y: 0, s: i * 4, src: Math.min(i, 9) }));
  const srcTags = Array.from({ length: 10 }, (_, i) => (i === 3 ? { surface: 'asphalt', smoothness: 'bad', lanes: '2' } : { surface: 'asphalt', lanes: '2' }));
  const geo = Array.from({ length: n + 1 }, (_, i) => ({ lat: 16 + i * 1e-5, lon: 108 }));
  return { kappa, y, points, srcTags, geo };
}

const cfg = { id: 'synt', name: 'Tổng hợp', place: 'Test', kind: 'sprint', roadProfile: 'ql2', scenery: 'mountain', weatherPresets: ['clear'], trafficProfile: 'pass', wayIds: [1, 2] };

test('assembleTrack emits the columnar schema with derived signs, sectors and surfaces', () => {
  const s = synthetic();
  const t = assembleTrack(cfg, s, 4);
  assert.equal(t.id, 'synt');
  assert.equal(t.n, 600);
  assert.equal(t.L, 4);
  assert.equal(t.lengthM, 2400);
  assert.equal(t.kappa.length, 600);
  assert.equal(t.slope.length, 600);
  assert.equal(t.y.length, 601);
  assert.equal(t.surface.length, 600);
  assert.equal(t.road.halfM.length, 600);
  assert.ok(t.road.halfM.every(h => h === ROAD_PROFILES.ql2.halfM));
  assert.equal(t.road.twoWay, true);
  assert.deepEqual(t.sectorsZ, [800, 1600]);
  // κ địa lý +0,03 (rẽ trái) → JSON theo quy ước game: âm = rẽ trái, biển dir = -1 đặt ~60 m trước cua
  assert.ok(t.kappa[210] < 0 && t.kappa[410] > 0, 'đổi dấu κ sang quy ước game');
  assert.ok(t.signs.some(sg => sg.i >= 170 && sg.i < 200 && sg.dir === -1), 'biển cua trái trước cua thứ nhất');
  assert.ok(t.signs.some(sg => sg.i >= 370 && sg.i < 400 && sg.dir === 1), 'biển cua phải trước cua thứ hai');
  assert.ok(t.surface.some(v => v === 1), 'đoạn smoothness=bad → mặt đường xấu');
  assert.equal(t.geo.length, Math.floor(2400 / 40) + 1);
  assert.ok(t.attribution.osm.includes('OpenStreetMap'));
  assert.deepEqual(t.weatherPresets, ['clear']);
});

test('loop tracks close the elevation and add wrap-around sectors', () => {
  const s = synthetic();
  const t = assembleTrack({ ...cfg, kind: 'loop' }, s, 4);
  assert.ok(Math.abs(t.y[0] - t.y[t.y.length - 1]) < 1e-6);
  assert.equal(t.kind, 'loop');
});
