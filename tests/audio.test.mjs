import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../js/audio.js';

// AudioContext giả: ghi lại giá trị đích cuối cùng của từng AudioParam.
function mockContext() {
  const param = (v = 0) => ({ value: v, target: v, setTargetAtTime(t) { this.target = t; this.value = t; }, setValueAtTime(t) { this.target = t; this.value = t; }, exponentialRampToValueAtTime(t) { this.ramped = t; }, cancelScheduledValues() {} });
  const node = extra => ({ connect(dst) { this.dst = dst; return dst; }, disconnect() {}, ...extra });
  const ctx = {
    state: 'running', currentTime: 0, sampleRate: 48000, destination: node({ isDestination: true }),
    resumed: 0, oscillators: [], gains: [], sources: [],
    resume() { ctx.resumed++; ctx.state = 'running'; return Promise.resolve(); },
    createOscillator() { const o = node({ type: 'sine', frequency: param(440), start() { this.started = true; }, stop() { this.stopped = true; } }); ctx.oscillators.push(o); return o; },
    createGain() { const g = node({ gain: param(0) }); ctx.gains.push(g); return g; },
    createBiquadFilter() { return node({ type: 'lowpass', frequency: param(1000), Q: param(1) }); },
    createBuffer(ch, len, rate) { return { length: len, sampleRate: rate, getChannelData: () => new Float32Array(len) }; },
    createBufferSource() { const s = node({ buffer: null, loop: false, playbackRate: param(1), start() { this.started = true; }, stop() { this.stopped = true; } }); ctx.sources.push(s); return s; },
  };
  return ctx;
}

const snap = (over = {}) => ({ kmh: 120, powerFrac: 0.8, sliding: false, excess: 0, rain: 0, offroad: false, surface: 'asphalt', ...over });

test('không tạo AudioContext trước khi có cử chỉ người dùng', () => {
  let made = 0;
  const a = createAudio(() => false, () => { made++; return mockContext(); });
  assert.equal(made, 0);
  assert.equal(a.debug().started, false);
  a.update(snap()); // không được nổ khi chưa start
  a.silence();
});

test('start() dựng đồ thị âm thanh và nối tới đầu ra', () => {
  const ctx = mockContext();
  const a = createAudio(() => false, () => ctx);
  a.start();
  const d = a.debug();
  assert.equal(d.started, true);
  assert.equal(d.state, 'running');
  assert.ok(ctx.oscillators.length >= 2, 'có dao động cho motor');
  assert.ok(ctx.oscillators.every(o => o.started), 'mọi oscillator đã start');
  assert.ok(ctx.sources.every(s => s.started), 'mọi nguồn nhiễu đã start');
  assert.ok(d.masterGain > 0, `master gain phải > 0, đang ${d.masterGain}`);
  const master = ctx.gains.find(g => g.dst === ctx.destination);
  assert.ok(master, 'có một gain nối thẳng ra destination');
});

test('start() gọi lại chỉ resume, không dựng thêm đồ thị', () => {
  const ctx = mockContext();
  const a = createAudio(() => false, () => ctx);
  a.start();
  const n = ctx.oscillators.length;
  ctx.state = 'suspended';
  a.start();
  assert.equal(ctx.oscillators.length, n, 'không tạo thêm oscillator');
  assert.equal(ctx.resumed, 1, 'đã resume context bị treo');
});

test('chạy xe làm tiếng motor kêu to lên theo tốc độ và nghe được', () => {
  const ctx = mockContext();
  const a = createAudio(() => false, () => ctx);
  a.start();
  a.update(snap({ kmh: 0, powerFrac: 0 }));
  const idle = a.debug();
  a.update(snap({ kmh: 160, powerFrac: 1 }));
  const fast = a.debug();
  assert.ok(fast.motorHz > idle.motorHz + 100, `cao độ tăng theo tốc độ: ${idle.motorHz} → ${fast.motorHz}`);
  assert.ok(fast.motorGain > idle.motorGain, 'to hơn khi chạy nhanh');
  assert.ok(fast.motorGain >= 0.15, `phải đủ nghe trên loa laptop, đang ${fast.motorGain}`);
});

test('tắt tiếng đưa mọi gain về 0, bật lại thì kêu tiếp', () => {
  const ctx = mockContext();
  let muted = false;
  const a = createAudio(() => muted, () => ctx);
  a.start();
  a.update(snap());
  assert.ok(a.debug().masterGain > 0);
  muted = true;
  a.update(snap());
  assert.equal(a.debug().masterGain, 0, 'tắt tiếng thì im hẳn');
  muted = false;
  a.update(snap());
  assert.ok(a.debug().masterGain > 0, 'bật lại thì kêu tiếp');
});

test('trượt bánh kêu rít, hết trượt thì thôi', () => {
  const ctx = mockContext();
  const a = createAudio(() => false, () => ctx);
  a.start();
  a.update(snap({ sliding: true, excess: 3 }));
  assert.ok(a.debug().squealGain > 0);
  a.update(snap({ sliding: false, excess: 0 }));
  assert.equal(a.debug().squealGain, 0);
});

test('silence() tắt mọi tiếng đang phát (rời màn đua)', () => {
  const ctx = mockContext();
  const a = createAudio(() => false, () => ctx);
  a.start();
  a.update(snap({ sliding: true, excess: 2, rain: 2 }));
  a.silence();
  const d = a.debug();
  assert.equal(d.motorGain, 0);
  assert.equal(d.squealGain, 0);
  assert.equal(d.rainGain, 0);
});

test('event() phát một tiếng động ngắn rồi tự tắt', () => {
  const ctx = mockContext();
  const a = createAudio(() => false, () => ctx);
  a.start();
  const before = ctx.oscillators.length;
  a.event('crash');
  const o = ctx.oscillators[ctx.oscillators.length - 1];
  assert.equal(ctx.oscillators.length, before + 1);
  assert.ok(o.started && o.stopped, 'có start và stop');
});

test('event() im lặng khi đang tắt tiếng', () => {
  const ctx = mockContext();
  const a = createAudio(() => true, () => ctx);
  a.start();
  const before = ctx.oscillators.length;
  a.event('crash');
  assert.equal(ctx.oscillators.length, before, 'không tạo tiếng khi tắt tiếng');
});
