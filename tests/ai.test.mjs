import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../js/config.js';
import { carById } from '../js/cars.js';
import { preparedCar } from '../js/calibrate.js';
import { hydrateTrack, vMax } from '../js/track.js';
import { stepLateral } from '../js/physics.js';
import { makeCar } from '../js/race.js';
import { WEATHER } from '../js/weather.js';
import { makeDriver, targetSpeed, aiDecide } from '../js/ai.js';
import { syntheticTrackJson } from './helpers.mjs';

const track = hydrateTrack(syntheticTrackJson('sprint'));
const MU = 0.95;
const spec = carById('vf7'), P = preparedCar(spec);
const driver = (over = {}) => ({ ...makeDriver(() => 0.5), cornerFrac: 0.95, brakeFrac: 1.0, aggression: 0.8, ...over });
const ctx = (over = {}) => ({ track, weather: WEATHER.clear, mu: MU, player: null, cars: [], traffic: [], time: 10, random: () => 0.5, ...over });
const ai = (z, v, x = 1.5) => { const c = makeCar(spec, P, { z, x }); c.v = v; c.driver = driver(); return c; };

test('targetSpeed brakes for the corner ahead and lifts the cap on a clear straight', () => {
  const d = driver();
  const far = targetSpeed(track, 0, 40, MU, d, P);
  assert.ok(far > 40, `xa cua: ${far}`);
  const inCorner = targetSpeed(track, 482, 40, MU, d, P);
  assert.ok(Math.abs(inCorner - 0.95 * vMax(0.02, MU)) < 0.05, `trong cua: ${inCorner}`);
  let prev = Infinity;
  for (let z = 200; z < 480; z += 20) { const t = targetSpeed(track, z, 40, MU, d, P); assert.ok(t <= prev + 1e-9, `giảm dần tới cua (z=${z})`); prev = t; }
});

test('aiDecide throttles when below target and brakes when above it', () => {
  const slow = ai(0, 10);
  const a = aiDecide(slow, ctx(), CFG.STEP);
  assert.equal(a.throttle, 1); assert.equal(a.brake, 0);
  const fast = ai(400, 45);
  const b = aiDecide(fast, ctx(), CFG.STEP);
  assert.equal(b.throttle, 0); assert.ok(b.brake > 0);
});

test('a closing player right behind triggers a block toward the player side', () => {
  const car = ai(300, 30, 1.5);
  const player = makeCar(spec, P, { z: 285, x: -1.5, isPlayer: true }); player.v = 36;
  aiDecide(car, ctx({ player }), CFG.STEP);
  assert.ok(car.driver.xTarget < 1.5, `xTarget dịch về phía người chơi: ${car.driver.xTarget}`);
  const calm = ai(300, 30, 1.5);
  const slowPlayer = makeCar(spec, P, { z: 285, x: -1.5, isPlayer: true }); slowPlayer.v = 25;
  aiDecide(calm, ctx({ player: slowPlayer }), CFG.STEP);
  assert.equal(calm.driver.xTarget, 1.5, 'người chơi chậm hơn → không chặn');
});

test('overtaking into the oncoming lane is refused while oncoming traffic is inside the gap', () => {
  const truck = { z: 330, x: 1.5, v: 12, dir: 1, w: 2.4, len: 8, kind: 'truck' };
  const oncoming = { z: 480, x: -1.5, v: 15, dir: -1, w: 1.8, len: 4.5, kind: 'car' };
  const blocked = ai(300, 25);
  aiDecide(blocked, ctx({ traffic: [truck, oncoming] }), CFG.STEP);
  assert.ok(blocked.driver.xTarget > 0, `không vượt khi có xe ngược: ${blocked.driver.xTarget}`);
  assert.ok(blocked.driver.speedCap <= 12 + 0.5, `bám sau xe tải: ${blocked.driver.speedCap}`);
  const free = ai(300, 25);
  aiDecide(free, ctx({ traffic: [truck] }), CFG.STEP);
  assert.ok(free.driver.xTarget < 0, `vượt sang làn trái khi trống: ${free.driver.xTarget}`);
});

test('the AI holds its lane through the corner using the shared lateral physics', () => {
  const car = ai(440, 18, 1.5); car.aAct = 0;
  const c = ctx();
  let input = { steer: 0, throttle: 0, brake: 0 };
  for (let t = 0; t < 4; t += CFG.STEP) {
    c.time += CFG.STEP;
    input = aiDecide(car, c, CFG.STEP);
    const seg = track.segments[Math.floor(car.z / track.L)];
    stepLateral(P, car, input.steer, seg.kappa, MU, CFG.STEP);
    car.z += car.v * CFG.STEP;
  }
  assert.ok(Math.abs(car.x - car.driver.xTarget) < 0.6, `x ${car.x} bám xTarget ${car.driver.xTarget} qua cua`);
  assert.ok(Math.abs(car.x) < 3, 'trên mặt đường');
});

test('the AI never demands more lateral grip than the friction circle leaves after throttle/brake', () => {
  const car = ai(500, 20, -2.5); car.aTyre = 4; // đang ga mạnh trong cua, lệch làn nhiều → muốn về làn
  const out = aiDecide(car, ctx(), CFG.STEP);
  const muG = MU * CFG.G, aAvail = Math.sqrt(muG * muG - 16);
  const demanded = Math.abs(out.steer) * Math.min(CFG.PHYS.STEER_OVER * muG, (20 * 20) / P.rMin);
  assert.ok(demanded <= aAvail + 1e-6, `đòi ${demanded.toFixed(2)} > khả dụng ${aAvail.toFixed(2)}`);
});

test('the AI eases the throttle while cornering near the limit', () => {
  const v = 0.9 * vMax(0.02, MU); // dưới mục tiêu 0,95·vMax một chút → vẫn ga, nhưng phải nhả bớt
  const car = ai(500, v, 1.5);
  const out = aiDecide(car, ctx(), CFG.STEP);
  assert.ok(out.throttle > 0 && out.throttle < 0.6, `throttle ${out.throttle}`);
});

test('braking for a corner uses a firm brake command, not a feather', () => {
  const car = ai(400, 45, 1.5);
  const out = aiDecide(car, ctx(), CFG.STEP);
  assert.ok(out.brake >= 0.6, `brake ${out.brake}`);
});

test('while sliding the AI backs off below the reduced grip to recover', () => {
  const car = ai(500, 20, -2.5); car.aTyre = 0; car.slideT = 0.4; car.excess = 2;
  const out = aiDecide(car, ctx(), CFG.STEP);
  const demanded = Math.abs(out.steer) * Math.min(CFG.PHYS.STEER_OVER * MU * CFG.G, (20 * 20) / P.rMin);
  assert.ok(demanded <= MU * CFG.G * CFG.PHYS.MU_SLIDE * 0.9 + 1e-6, `đòi ${demanded.toFixed(2)} khi đang trượt`);
});

test('the AI turns in before the corner to cover its steering lag', () => {
  const early = ai(796, 13, 1.5); // 4 m trước cua κ=-0.05 (bắt đầu z=800); nhìn trước v·1.5·τ ≈ 7.6 m
  const outEarly = aiDecide(early, ctx(), CFG.STEP);
  assert.ok(outEarly.steer < -0.3, `đã đánh lái sớm: ${outEarly.steer}`);
  const far = ai(760, 13, 1.5);
  const outFar = aiDecide(far, ctx({ time: 11 }), CFG.STEP);
  assert.ok(Math.abs(outFar.steer) < 0.15, `còn xa thì chưa: ${outFar.steer}`);
});

test('on a clear two-way road the AI takes the inside line before a corner, but stays right when oncoming traffic is near', () => {
  const clear = ai(400, 25, 1.5);
  aiDecide(clear, ctx({ time: 12 }), CFG.STEP);
  assert.ok(clear.driver.xTarget < 0, `vào phía trong cua phải (κ>0 → trái): ${clear.driver.xTarget}`);
  const oncoming = { z: 520, x: -1.5, v: 15, dir: -1, w: 1.8, len: 4.5, kind: 'car' };
  const careful = ai(400, 25, 1.5);
  aiDecide(careful, ctx({ time: 12, traffic: [oncoming] }), CFG.STEP);
  assert.equal(careful.driver.xTarget, 1.5, 'có xe ngược → giữ làn phải');
});

test('the AI keeps lateral clearance from a car running alongside instead of cutting into it', () => {
  const me = ai(400, 25, 1.5); // sắp tới cua phải → muốn vào phía trong (trái)
  const beside = makeCar(spec, P, { z: 401, x: -0.6 }); beside.v = 25; beside.driver = driver();
  aiDecide(me, ctx({ time: 12, cars: [me, beside] }), CFG.STEP);
  assert.ok(me.driver.xTarget - beside.x >= 1.9, `giữ khoảng cách ngang: xTarget ${me.driver.xTarget} vs xe bên ${beside.x}`);
  assert.ok(me.driver.xTarget <= 3 - 0.9, 'vẫn trên mặt đường');
});

test('an AI stopped behind a stalled vehicle still decides to overtake when the oncoming lane is clear', () => {
  const stalled = { z: 306, x: 1.5, v: 0, dir: 1, w: 1.8, len: 4.5, kind: 'car' };
  const me = ai(300, 0, 1.5);
  aiDecide(me, ctx({ traffic: [stalled] }), CFG.STEP);
  assert.ok(me.driver.xTarget < 0, `vượt dù đang đứng: ${me.driver.xTarget}`);
  assert.ok(me.driver.speedCap === Infinity || me.driver.speedCap > 5, 'không bị kẹp tốc độ 0');
});

test('following too closely makes the AI drop below the leader speed to reopen the gap', () => {
  const leader = { z: 312, x: 1.5, v: 20, dir: 1, w: 1.8, len: 4.5, kind: 'car' };
  const me = ai(300, 22, 1.5); // gap 12 m − 4,5 m thân xe ≈ 7,5 m, cần ≈ 1,4·22 + 5 = 36 m
  aiDecide(me, ctx({ traffic: [leader] }), CFG.STEP);
  assert.ok(me.driver.speedCap < 20 - 1, `speedCap ${me.driver.speedCap} < tốc độ xe trước`);
  const comfy = ai(250, 22, 1.5); // gap 62 m
  aiDecide(comfy, ctx({ traffic: [leader] }), CFG.STEP);
  assert.equal(comfy.driver.speedCap, Infinity);
});

test('while overtaking, the speed cap is lifted only once the car is laterally clear of the leader', () => {
  const leader = { z: 310, x: 1.5, v: 10, dir: 1, w: 1.8, len: 4.5, kind: 'car' };
  const me = ai(300, 25, 1.5);
  aiDecide(me, ctx({ traffic: [leader] }), CFG.STEP); // quyết định vượt (làn trái trống)
  assert.ok(me.driver.overtaking, 'đang vượt');
  assert.ok(me.driver.speedCap <= 10 + 1e-9, `chưa lệch làn thì vẫn bám sau: ${me.driver.speedCap}`);
  me.x = -1.4; // đã sang làn trái
  aiDecide(me, ctx({ traffic: [leader], time: 10.2 }), CFG.STEP);
  assert.equal(me.driver.speedCap, Infinity);
});
