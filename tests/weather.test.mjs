import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEATHER, pickWeather } from '../js/weather.js';

test('every preset referenced by routes.json exists and is well-formed', () => {
  const routes = JSON.parse(fs.readFileSync(new URL('../tools/routes.json', import.meta.url), 'utf8'));
  for (const r of routes) for (const id of r.weatherPresets) {
    const w = WEATHER[id];
    assert.ok(w, `thiếu preset ${id} (tuyến ${r.id})`);
    assert.ok(w.label && w.muMult > 0.5 && w.muMult <= 1 && w.visibilityM >= 60, id);
    assert.ok(Array.isArray(w.sky) && w.sky.length === 2 && w.fogColor, id);
    assert.equal(typeof w.night, 'boolean', id);
  }
  assert.equal(WEATHER.clear.muMult, 1);
  assert.ok(WEATHER.rain.muMult < WEATHER.clear.muMult && WEATHER.heavyRain.muMult < WEATHER.rain.muMult);
});

test('pickWeather takes the first preset unless random is requested', () => {
  const presets = ['fog', 'clear', 'rain'];
  assert.equal(pickWeather(presets, false, () => 0.99), 'fog');
  const picks = new Set(Array.from({ length: 50 }, (_, i) => pickWeather(presets, true, () => (i % 10) / 10)));
  assert.ok(picks.size > 1 && [...picks].every(p => presets.includes(p)));
});
