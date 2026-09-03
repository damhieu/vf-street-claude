// Âm thanh tổng hợp bằng WebAudio (không dùng file): tiếng motor điện theo tốc độ, tiếng gió/mặt đường,
// lốp rít khi trượt, mưa, và tiếng va chạm. Context được tiêm để test được bằng node --test.

const defaultFactory = () => new (window.AudioContext || window.webkitAudioContext)();

export const MASTER_GAIN = 0.9;

export function createAudio(getMuted, ctxFactory = defaultFactory) {
  let ac = null, started = false;
  let master = null, motor = null, motorHarm = null, motorSub = null, motorGain = null, motorFilter = null;
  let road = null, roadGain = null, squeal = null, squealGain = null, rain = null, rainGain = null;

  const noiseBuffer = (ctx, seconds = 2, pink = true) => {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (pink) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // gió/mưa: nhiễu hồng nghe dày
      else d[i] = w; // lốp rít: nhiễu trắng mới có năng lượng ở tần số cao
    }
    return buf;
  };
  const noiseChain = (ctx, type, freq, q, dest, pink = true) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 3, pink);
    src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q != null) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(dest);
    src.start();
    return { src, filter: f, gain: g };
  };

  function start() {
    if (started) { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); return; } // iOS/Chrome: resume sau cử chỉ
    try {
      ac = ctxFactory();
      master = ac.createGain();
      master.gain.value = getMuted() ? 0 : MASTER_GAIN;
      master.connect(ac.destination);

      // motor điện: răng cưa + hoạ âm bậc hai + sub, qua lowpass mở dần theo tốc độ
      motorFilter = ac.createBiquadFilter(); motorFilter.type = 'lowpass'; motorFilter.frequency.value = 900; motorFilter.Q.value = 1.2;
      motorGain = ac.createGain(); motorGain.gain.value = 0;
      motor = ac.createOscillator(); motor.type = 'sawtooth'; motor.frequency.value = 70;
      motorHarm = ac.createOscillator(); motorHarm.type = 'triangle'; motorHarm.frequency.value = 140;
      motorSub = ac.createOscillator(); motorSub.type = 'sine'; motorSub.frequency.value = 35;
      motor.connect(motorFilter); motorHarm.connect(motorFilter); motorSub.connect(motorFilter);
      motorFilter.connect(motorGain); motorGain.connect(master);
      motor.start(); motorHarm.start(); motorSub.start();

      const r = noiseChain(ac, 'bandpass', 700, 0.7, master); road = r.src; roadGain = r.gain;   // gió + mặt đường
      const s = noiseChain(ac, 'bandpass', 2600, 3, master, false); squeal = s.src; squealGain = s.gain; // lốp rít
      const w = noiseChain(ac, 'lowpass', 1100, null, master); rain = w.src; rainGain = w.gain;   // mưa
      started = true;
    } catch (e) { console.warn('Không khởi tạo được âm thanh', e); }
  }

  const ramp = (param, v, t = 0.08) => { if (ac) param.setTargetAtTime(v, ac.currentTime, t); };

  return {
    start,
    /** Mở lại context sau khi tab bị ẩn / iOS treo. */
    resume() { if (started && ac && ac.state === 'suspended') ac.resume().catch(() => {}); },
    /** Gọi mỗi khung hình với snapshot của cuộc đua. */
    update(s) {
      if (!started || !s) return;
      const muted = getMuted();
      ramp(master.gain, muted ? 0 : MASTER_GAIN, 0.05);
      const sp = Math.min(1, Math.max(0, s.kmh / 200));
      const load = 0.55 + 0.45 * Math.min(1, Math.abs(s.powerFrac || 0));
      const hz = 70 + sp * 620;
      ramp(motor.frequency, hz, 0.05);
      ramp(motorHarm.frequency, hz * 2, 0.05);
      ramp(motorSub.frequency, hz * 0.5, 0.05);
      ramp(motorFilter.frequency, 700 + sp * 3200, 0.05);
      ramp(motorGain.gain, (0.1 + sp * 0.22) * load);
      ramp(roadGain.gain, 0.05 + sp * 0.16 + (s.offroad ? 0.12 : 0), 0.12);
      ramp(squealGain.gain, s.sliding ? 0.5 + 0.3 * Math.min(1, s.excess || 0) : 0, 0.04);
      ramp(rainGain.gain, s.rain ? 0.06 * s.rain : 0, 0.3);
    },
    /** Tiếng động một lần: va chạm, về đích… */
    event(kind) {
      if (!started || getMuted()) return;
      const o = ac.createOscillator(), g = ac.createGain();
      const specs = { crash: [90, 0.5, 0.35], hit: [150, 0.35, 0.2], bike: [120, 0.45, 0.3], finish: [880, 0.25, 0.7] };
      const [f, vol, dur] = specs[kind] || specs.hit;
      o.type = kind === 'finish' ? 'sine' : 'sawtooth';
      o.frequency.setValueAtTime(f, ac.currentTime);
      if (kind !== 'finish') o.frequency.exponentialRampToValueAtTime(Math.max(30, f * 0.35), ac.currentTime + dur);
      g.gain.setValueAtTime(vol, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ac.currentTime + dur);
    },
    /** Rời màn đua: tắt mọi tiếng đang phát. */
    silence() {
      if (!started) return;
      ramp(motorGain.gain, 0); ramp(roadGain.gain, 0); ramp(squealGain.gain, 0); ramp(rainGain.gain, 0);
    },
    /** Chẩn đoán (?debug=1). */
    debug() {
      return {
        started, state: ac?.state ?? null, muted: getMuted(),
        masterGain: master?.gain.value ?? null, motorGain: motorGain?.gain.value ?? null, motorHz: motor?.frequency.value ?? null,
        roadGain: roadGain?.gain.value ?? null, squealGain: squealGain?.gain.value ?? null, rainGain: rainGain?.gain.value ?? null,
      };
    },
  };
}
