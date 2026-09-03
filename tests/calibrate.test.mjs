import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS, carById } from '../js/cars.js';
import { calibrateEta, simulateSprint, topSpeed } from '../js/calibrate.js';

test('calibrated efficiency reproduces the published 0–100 km/h time for every car', () => {
  for (const car of CARS) {
    const eta = calibrateEta(car);
    // Dải η hợp lý cho motor điện kể cả derating khi đề-pa; khối lượng sai (VF 3 = 1.190 kg) cho η > 1.
    assert.ok(eta >= 0.55 && eta <= 0.9, `${car.id} η=${eta.toFixed(3)} outside the plausible band → spec inconsistent`);
    const t = simulateSprint(car, eta).t0100;
    assert.ok(Math.abs(t - car.t0100) <= 0.4, `${car.id} 0–100 ${t.toFixed(2)} vs ${car.t0100}`);
  }
});

test('VF 3 also lands near its published 0–50 km/h time', () => {
  const car = carById('vf3');
  const t = simulateSprint(car, calibrateEta(car)).t0050;
  assert.ok(Math.abs(t - car.t0050) <= 1.0, `0–50 ${t.toFixed(2)} vs ${car.t0050}`);
});

test('every car reaches, and does not exceed, its electronic top speed on a flat road', () => {
  for (const car of CARS) {
    const v = topSpeed(car, calibrateEta(car));
    assert.ok(Math.abs(v * 3.6 - car.vLimKmh) <= 1, `${car.id} top ${(v * 3.6).toFixed(1)} vs ${car.vLimKmh}`);
  }
});
