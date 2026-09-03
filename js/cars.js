// Catalog 6 xe VinFast với thông số thật (nguồn ghi trong `source`). Giá trị ước lượng ghi trong `estimates`.
// Đơn vị: kW, Nm, kg (không tải), km/h, s, mm. cdA (m²), crr, hCg (m) là ước lượng theo lớp xe để hiệu chỉnh.

const PAINT = {
  brahminyWhite: { name: 'Brahminy White', hex: '#eef0f2' },
  jetBlack: { name: 'Jet Black', hex: '#0b0b0d' },
  crimsonRed: { name: 'Crimson Red', hex: '#a3132b' },
  neptuneGrey: { name: 'Neptune Grey', hex: '#6b7079' },
  vinfastBlue: { name: 'VinFast Blue', hex: '#1b4db1' },
  deepOcean: { name: 'Deep Ocean', hex: '#12324f' },
  sunsetOrange: { name: 'Sunset Orange', hex: '#e4552b' },
  desatSilver: { name: 'Desat Silver', hex: '#c4c7cc' },
  luxuryBlue: { name: 'Luxury Blue', hex: '#1f4fd1' },
  futureBlue: { name: 'Future Blue', hex: '#2e86de' },
  mistiqueRed: { name: 'Mistique Red', hex: '#8e1a3a' },
};

export const CARS = [
  {
    id: 'vf3', name: 'VF 3', tier: 1, cls: 'Mini SUV · 2 cửa',
    desc: 'Nhỏ, cao, lốp hẹp 175. Chỉ 43 mã lực nhưng nhẹ nhất dải — bám cua khiêm tốn, ra đèo phải giữ đà.',
    powerKw: 32, torqueNm: 110, drive: 'RWD', motors: 1, massKg: 857, vLimKmh: 100, t0100: 19.3, t0050: 5.3, torqueBaseKmh: 30,
    lengthMm: 3190, widthMm: 1679, heightMm: 1622, wheelbaseMm: 2075,
    tyre: { width: 175, aspect: 75, rim: 16 }, batteryKwh: 18.64,
    cdA: 0.88, crr: 0.011, hCg: 0.62, gripFactor: 0.94, staticShare: 0.45,
    style: { light: 'split', blackRoof: true, rails: false, glass: 0.44, roofW: 0.86, roofR: 0.05, spoiler: 0, plate: 0.3, chrome: true },
    paints: [
      { name: 'Trắng', hex: '#f2f3f5' }, { name: 'Đỏ', hex: '#c8102e' }, { name: 'Xanh dương đậm', hex: '#1b3a8a' }, { name: 'Xám', hex: '#6d7079' },
      { name: 'Vàng · nóc trắng', hex: '#f2c020' }, { name: 'Hồng tím', hex: '#b565c9' }, { name: 'Xanh lá nhạt', hex: '#a9d8a0' }, { name: 'Xanh dương nhạt · nóc trắng', hex: '#8fc1e8' }, { name: 'Hồng phấn · nóc trắng', hex: '#f4b6c7' },
    ],
    estimates: ['cdA', 'crr', 'hCg', 'torqueBaseKmh'],
    source: 'Wikipedia EN (VinFast VF 3); oto.com.vn thông số 2025: 857 kg, 0–50 5,3 s, 0–100 19,3 s (hiệu chỉnh η ≈ 0,68 khớp cả hai mốc)',
  },
  {
    id: 'vf5', name: 'VF 5 Plus', tier: 2, cls: 'SUV hạng A',
    desc: 'Cầu trước 134 mã lực, 1,36 tấn. Dễ lái, đề-pa hay mất bám bánh trước khi mưa.',
    powerKw: 100, torqueNm: 135, drive: 'FWD', motors: 1, massKg: 1360, vLimKmh: 130, t0100: 10.9,
    lengthMm: 3965, widthMm: 1720, heightMm: 1580, wheelbaseMm: 2513,
    tyre: { width: 205, aspect: 55, rim: 17 }, batteryKwh: 37.23,
    cdA: 0.79, crr: 0.011, hCg: 0.58, gripFactor: 0.95, staticShare: 0.58,
    style: { light: 'bar', blackRoof: true, rails: false, glass: 0.38, roofW: 0.76, roofR: 0.1, spoiler: 0.4, plate: 0.28, chrome: false },
    paints: [PAINT.brahminyWhite, PAINT.jetBlack, PAINT.desatSilver, PAINT.neptuneGrey, PAINT.luxuryBlue, PAINT.futureBlue, PAINT.mistiqueRed, PAINT.deepOcean],
    estimates: ['cdA', 'crr', 'hCg'],
    source: 'Wikipedia EN (VinFast VF 5); bonbanh.com VF 5 Plus',
  },
  {
    id: 'vf6', name: 'VF 6 Plus', tier: 3, cls: 'SUV hạng B',
    desc: '201 mã lực cầu trước, 310 Nm. Cân bằng nhất trong nhóm nhỏ; lốp 235 bám tốt hơn hẳn VF 5.',
    powerKw: 150, torqueNm: 310, drive: 'FWD', motors: 1, massKg: 1600, vLimKmh: 150, t0100: 8.0,
    lengthMm: 4238, widthMm: 1820, heightMm: 1594, wheelbaseMm: 2730,
    tyre: { width: 235, aspect: 45, rim: 19 }, batteryKwh: 59.6,
    cdA: 0.79, crr: 0.012, hCg: 0.58, gripFactor: 0.97, staticShare: 0.58,
    style: { light: 'barV', blackRoof: false, rails: false, glass: 0.35, roofW: 0.7, roofR: 0.16, spoiler: 0.7, plate: 0.26, chrome: false },
    paints: [PAINT.brahminyWhite, PAINT.jetBlack, PAINT.desatSilver, PAINT.deepOcean, PAINT.crimsonRed],
    estimates: ['t0100', 'cdA', 'crr', 'hCg'],
    source: 'Wikipedia EN (VinFast VF 6); bonbanh.com VF 6 Plus 2026; 0–100 không công bố → ước lượng 8,0 s theo P/m so với xe cùng lớp',
  },
  {
    id: 'vf7', name: 'VF 7 Plus', tier: 4, cls: 'SUV hạng C · coupe',
    desc: 'Hai motor 349 mã lực, 500 Nm, AWD. 0–100 trong 5,8 s; lốp 235/45 R20 là tham chiếu bám của dải.',
    powerKw: 260, torqueNm: 500, drive: 'AWD', motors: 2, massKg: 2020, vLimKmh: 175, t0100: 5.8,
    lengthMm: 4545, widthMm: 1890, heightMm: 1636, wheelbaseMm: 2840,
    tyre: { width: 235, aspect: 45, rim: 20 }, batteryKwh: 75.3,
    cdA: 0.82, crr: 0.012, hCg: 0.6, gripFactor: 1.0, staticShare: 0.5,
    style: { light: 'wingV', blackRoof: false, rails: false, glass: 0.34, roofW: 0.62, roofR: 0.22, spoiler: 1.0, plate: 0.26, chrome: false },
    paints: [PAINT.brahminyWhite, PAINT.jetBlack, PAINT.crimsonRed, PAINT.neptuneGrey, PAINT.vinfastBlue, PAINT.deepOcean],
    estimates: ['cdA', 'crr', 'hCg'],
    source: 'Wikipedia EN (VinFast VF 7); bonbanh.com VF 7 Plus 2026',
  },
  {
    id: 'vf8', name: 'VF 8 Plus', tier: 5, cls: 'SUV hạng D (thế hệ 2023–25)',
    desc: '402 mã lực, 620 Nm, AWD, ~2,4 tấn. Mạnh nhất trên cao tốc; nặng nên phanh sớm hơn VF 7.',
    powerKw: 300, torqueNm: 620, drive: 'AWD', motors: 2, massKg: 2370, vLimKmh: 200, t0100: 5.5,
    lengthMm: 4750, widthMm: 1900, heightMm: 1660, wheelbaseMm: 2950,
    tyre: { width: 245, aspect: 50, rim: 19 }, batteryKwh: 87.7,
    cdA: 0.88, crr: 0.013, hCg: 0.62, gripFactor: 0.98, staticShare: 0.5,
    style: { light: 'barV', blackRoof: false, rails: true, glass: 0.37, roofW: 0.76, roofR: 0.1, spoiler: 0.5, plate: 0.26, chrome: false },
    paints: [PAINT.brahminyWhite, PAINT.crimsonRed, PAINT.neptuneGrey, PAINT.jetBlack, PAINT.vinfastBlue, PAINT.deepOcean, PAINT.sunsetOrange],
    estimates: ['massKg', 'vLimKmh', 'tyre', 'cdA', 'crr', 'hCg'],
    source: 'Wikipedia EN (VinFast VF 8, bản Plus AWD); sự kiện Thử & Tin xác nhận 0–100 5,5 s; khối lượng/tốc độ tối đa/lốp ước lượng',
  },
  {
    id: 'vf9', name: 'VF 9 Plus', tier: 6, cls: 'SUV hạng E · 7 chỗ',
    desc: 'Gần 3 tấn, 402 mã lực, dài 5,12 m. Đỉnh tốc 200 km/h nhưng vào cua như con tàu — quán tính là kẻ thù.',
    powerKw: 300, torqueNm: 620, drive: 'AWD', motors: 2, massKg: 2968, vLimKmh: 200, t0100: 7.5,
    lengthMm: 5118, widthMm: 2000, heightMm: 1696, wheelbaseMm: 3150,
    tyre: { width: 265, aspect: 45, rim: 21 }, batteryKwh: 123,
    cdA: 0.95, crr: 0.013, hCg: 0.66, gripFactor: 0.95, staticShare: 0.5,
    style: { light: 'barV', blackRoof: false, rails: true, glass: 0.4, roofW: 0.84, roofR: 0.07, spoiler: 0.5, plate: 0.25, chrome: false },
    paints: [PAINT.brahminyWhite, PAINT.desatSilver, PAINT.crimsonRed, PAINT.neptuneGrey, PAINT.vinfastBlue, PAINT.deepOcean, PAINT.jetBlack, PAINT.sunsetOrange],
    estimates: ['tyre', 'cdA', 'crr', 'hCg'],
    source: 'Wikipedia EN (VinFast VF 9); bonbanh.com VF 9 Plus 7S 2026 (pin CATL 123 kWh, 2.968 kg, 0–100 7,5 s)',
  },
];

export const carById = id => CARS.find(c => c.id === id);

/** Bán kính lăn (m) từ cỡ lốp width/aspect R rim. */
export const wheelRadiusM = car => ((car.tyre.rim * 25.4) / 2 + (car.tyre.width * car.tyre.aspect) / 100) / 1000;

export const paintsFor = id => carById(id)?.paints ?? [];


/** Xe AI cùng hạng với xe người chơi (dải 3 tier quanh xe, kẹp trong catalog), hoặc cả dải nếu mixed. */
export function fieldFor(carId, mixed = false) {
  if (mixed) return CARS.slice();
  const t = carById(carId)?.tier ?? 1;
  const lo = Math.max(1, Math.min(t - 1, CARS.length - 2));
  return CARS.filter(c => c.tier >= lo && c.tier <= lo + 2);
}
