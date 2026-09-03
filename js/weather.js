// Preset thời tiết / thời điểm: hệ số bám, tầm nhìn (m), màu trời/sương, đêm, mưa (0/1/2), ánh sáng môi trường.
export const WEATHER = {
  clear: { id: 'clear', label: 'Nắng', muMult: 1.0, visibilityM: 550, sky: ['#5aa7dc', '#e5f1fa'], fogColor: '#e5f1fa', night: false, lights: false, rain: 0, ambient: 1.0 },
  haze: { id: 'haze', label: 'Mây mù nhẹ', muMult: 1.0, visibilityM: 350, sky: ['#8fb3cf', '#dde8ee'], fogColor: '#dde8ee', night: false, lights: false, rain: 0, ambient: 0.9 },
  rain: { id: 'rain', label: 'Mưa', muMult: 0.74, visibilityM: 220, sky: ['#5c6772', '#aab4bd'], fogColor: '#aab4bd', night: false, lights: true, rain: 1, ambient: 0.72 },
  heavyRain: { id: 'heavyRain', label: 'Mưa to', muMult: 0.65, visibilityM: 150, sky: ['#4a535c', '#8d979f'], fogColor: '#8d979f', night: false, lights: true, rain: 2, ambient: 0.62 },
  fog: { id: 'fog', label: 'Sương mù', muMult: 0.95, visibilityM: 110, sky: ['#b8c3cc', '#d9e0e5'], fogColor: '#d9e0e5', night: false, lights: true, rain: 0, ambient: 0.85 },
  dusk: { id: 'dusk', label: 'Chạng vạng', muMult: 1.0, visibilityM: 400, sky: ['#2b2f55', '#f2a26b'], fogColor: '#7a6a7a', night: false, lights: true, rain: 0, ambient: 0.6 },
  night: { id: 'night', label: 'Đêm', muMult: 1.0, visibilityM: 160, sky: ['#070914', '#1a1d3a'], fogColor: '#0a0c16', night: true, lights: true, rain: 0, ambient: 0.35 },
  nightRain: { id: 'nightRain', label: 'Đêm mưa', muMult: 0.74, visibilityM: 130, sky: ['#070914', '#161a2e'], fogColor: '#0a0c16', night: true, lights: true, rain: 1, ambient: 0.3 },
};

/** Preset đầu là mặc định của tuyến; ngẫu nhiên có trọng số (preset đầu ×2). */
export function pickWeather(presets, random, rnd = Math.random) {
  if (!random || presets.length < 2) return presets[0];
  const weights = presets.map((_, i) => (i === 0 ? 2 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < presets.length; i++) { r -= weights[i]; if (r < 0) return presets[i]; }
  return presets[presets.length - 1];
}
