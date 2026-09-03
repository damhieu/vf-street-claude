// Âm thanh tổng hợp bằng WebAudio (không file): rít motor điện theo tốc độ/công suất, lốp rít khi trượt, mưa, va chạm.
export function createAudio(getMuted) {
  let ac = null, motor = null, motorGain = null, squeal = null, squealGain = null, rain = null, rainGain = null, started = false;
  const noiseBuffer = (ctx, seconds = 2) => {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  };
  function start() {
    if (started) { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); return; } // iOS: resume sau cử chỉ
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      motor = ac.createOscillator(); motor.type = 'triangle'; motor.frequency.value = 60;
      const motor2 = ac.createOscillator(); motor2.type = 'sine'; motor2.frequency.value = 120;
      motorGain = ac.createGain(); motorGain.gain.value = 0;
      motor.connect(motorGain); motor2.connect(motorGain); motorGain.connect(ac.destination);
      motor.start(); motor2.start();
      motor.harmonic = motor2;
      squeal = ac.createBufferSource(); squeal.buffer = noiseBuffer(ac); squeal.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 3;
      squealGain = ac.createGain(); squealGain.gain.value = 0;
      squeal.connect(bp); bp.connect(squealGain); squealGain.connect(ac.destination); squeal.start();
      rain = ac.createBufferSource(); rain.buffer = noiseBuffer(ac, 3); rain.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      rainGain = ac.createGain(); rainGain.gain.value = 0;
      rain.connect(lp); lp.connect(rainGain); rainGain.connect(ac.destination); rain.start();
      started = true;
    } catch (e) { console.warn('Không khởi tạo được âm thanh', e); }
  }
  const set = (param, v, t = 0.08) => { if (!ac) return; param.setTargetAtTime(getMuted() ? 0 : v, ac.currentTime, t); };
  return {
    start,
    /** Gọi mỗi frame với snapshot đua. */
    update(s) {
      if (!started || !s) return;
      const sp = Math.min(1, s.kmh / 200);
      motor.frequency.setTargetAtTime(70 + sp * 520, ac.currentTime, 0.05);
      motor.harmonic.frequency.setTargetAtTime(140 + sp * 1040, ac.currentTime, 0.05);
      set(motorGain.gain, (0.012 + sp * 0.05) * (0.6 + 0.4 * Math.abs(s.powerFrac || 0)));
      set(squealGain.gain, s.sliding ? 0.05 + 0.03 * Math.min(1, s.excess || 0) : 0, 0.05);
      set(rainGain.gain, s.rain ? 0.03 * s.rain : 0, 0.3);
    },
    event(kind) {
      if (!started || getMuted()) return;
      const o = ac.createOscillator(), g = ac.createGain();
      const specs = { crash: [90, 0.35, 0.25], hit: [160, 0.2, 0.15], finish: [880, 0.08, 0.6], bike: [120, 0.3, 0.3] };
      const [f, vol, dur] = specs[kind] || specs.hit;
      o.type = kind === 'finish' ? 'sine' : 'sawtooth'; o.frequency.value = f;
      g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
    },
    silence() { if (!started) return; set(motorGain.gain, 0); set(squealGain.gain, 0); set(rainGain.gain, 0); },
  };
}
