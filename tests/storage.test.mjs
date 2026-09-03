import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeStore, DEFAULT_SETTINGS } from '../js/storage.js';

const memBackend = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
};

test('putBest keeps only the fastest time per track and car', () => {
  const s = makeStore(memBackend());
  assert.equal(s.getBest('haivan', 'vf3'), null);
  assert.equal(s.putBest('haivan', 'vf3', 300.5), true);
  assert.equal(s.putBest('haivan', 'vf3', 320), false);
  assert.equal(s.getBest('haivan', 'vf3'), 300.5);
  assert.equal(s.putBest('haivan', 'vf3', 290.25), true);
  assert.equal(s.getBest('haivan', 'vf3'), 290.25);
  assert.equal(s.getBest('haivan', 'vf9'), null);
});

test('state persists across store instances sharing a backend', () => {
  const b = memBackend();
  makeStore(b).putBest('ct04', 'vf8', 200);
  makeStore(b).saveSettings({ randomWeather: true });
  const s = makeStore(b);
  assert.equal(s.getBest('ct04', 'vf8'), 200);
  assert.equal(s.settings.randomWeather, true);
});

test('corrupted JSON falls back to defaults', () => {
  const b = memBackend();
  b.setItem('vf-street', '{not json');
  const s = makeStore(b);
  assert.equal(s.getBest('haivan', 'vf3'), null);
  assert.deepEqual(s.settings, DEFAULT_SETTINGS);
});

test('a throwing backend degrades to in-memory storage', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const s = makeStore(bad);
  assert.equal(s.putBest('haivan', 'vf3', 100), true);
  assert.equal(s.getBest('haivan', 'vf3'), 100);
});

test('saveSettings merges with defaults and ignores unknown keys', () => {
  const s = makeStore(memBackend());
  s.saveSettings({ trafficDensity: 1.5, bogus: 1 });
  assert.equal(s.settings.trafficDensity, 1.5);
  assert.equal(s.settings.randomWeather, DEFAULT_SETTINGS.randomWeather);
  assert.equal('bogus' in s.settings, false);
});

test('sector bests are kept per track and car, each sector independently', () => {
  const s = makeStore(memBackend());
  assert.deepEqual(s.getBestSectors('haivan', 'vf3'), []);
  s.putSectors('haivan', 'vf3', [60, 70, 80]);
  s.putSectors('haivan', 'vf3', [65, 66, 85]);
  assert.deepEqual(s.getBestSectors('haivan', 'vf3'), [60, 66, 80]);
  s.putSectors('haivan', 'vf3', [59]);
  assert.deepEqual(s.getBestSectors('haivan', 'vf3'), [59, 66, 80]);
});
