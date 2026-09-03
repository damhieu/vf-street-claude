# VF Street — đua xe VinFast trên cung đường thật Việt Nam

Game đua kiểu Need for Speed cổ điển (pseudo-3D) chạy trên trình duyệt, JavaScript thuần + Canvas 2D, không build tool, không thư viện ngoài.

- **6 xe VinFast** (VF 3, VF 5 Plus, VF 6 Plus, VF 7 Plus, VF 8 Plus AWD 2023–25, VF 9 Plus) với **vật lý theo thông số thật**: công suất, mô-men, khối lượng, dẫn động, tốc độ giới hạn điện tử, 0–100 km/h (hiệu chỉnh tự động), lốp, cản gió; vòng tròn ma sát cho phần ngang (quá tốc độ vào cua là trượt).
- **5 cung đường thật** dựng từ OpenStreetMap + độ cao SRTM: Đèo Hải Vân, Đèo Mã Pí Lèng, Đèo Ô Quy Hồ (sương mù), Cao tốc Hà Nội – Hải Phòng, Vòng cầu Đà Nẵng (circuit đêm).
- **Độ khó cao**: AI cùng vật lý với người chơi, phanh muộn, vượt sang làn ngược, chặn khi bị áp sát, không rubber-band; giao thông hai chiều kiểu Việt Nam (xe máy, xe khách, xe tải, container); sương mù, mưa, đêm; không trợ lái, không nitro.

## Chơi online

**https://damhieu.github.io/vf-street-claude/** — mở trên máy tính hoặc điện thoại, không cần cài gì.

**Trên điện thoại**: xoay ngang máy, pad ◀ ▶ bên trái để lái, nút GA / PHANH bên phải, ❚❚ để tạm dừng. Trên iPhone bấm ⛶ ở menu để xem cách *Thêm vào Màn hình chính* (chơi toàn màn hình, có icon VF Street); trên Android bấm ⛶ là vào toàn màn hình.

## Chạy local

```bash
python3 -m http.server 8080
```

Mở http://localhost:8080. Phím: `↑/W` ga, `↓/S` phanh, `←/→` hoặc `A/D` lái, `Enter` chọn, `Esc` tạm dừng/quay lại, `M` tắt tiếng. Ở màn chọn xe, `↑/↓` đổi màu sơn.

## Kiểm thử

```bash
npm test
```

`node --test` chạy các module thuần (vật lý, hiệu chỉnh, hình học tuyến, AI, va chạm, giao thông, lưu trữ). Kiểm thử trong trình duyệt: mở `?debug=1&paused=1` (thêm `&track=<id>&car=<id>&weather=<id>` để vào thẳng), rồi dùng `window.vfDebug`:

```js
vfDebug.press('confirm');          // đi qua menu bằng action (hoặc dispatch KeyboardEvent)
vfDebug.app.race.autopilot = true; // AI lái hộ
vfDebug.step(600);                 // bước 600 frame (10 s) — tab ẩn thì rAF không chạy
vfDebug.state();                   // snapshot HUD
vfDebug.bench(300);                // ms/frame update + render
```

## Dựng lại đường từ OpenStreetMap

```bash
node tools/build_tracks.mjs            # tất cả tuyến trong tools/routes.json
node tools/build_tracks.mjs --only haivan
node tools/build_tracks.mjs --offline  # dùng cache trong tools/cache/
```

Mỗi tuyến: Overpass API (way trong bbox theo filter) → đồ thị node → Dijkstra qua các waypoint → lấy mẫu đều 4 m → độ cong/độ dốc → độ cao Open Topo Data (SRTM 30 m) → `assets/tracks/<id>.json` + preview `tools/out/<id>.svg`. Thêm tuyến mới chỉ cần thêm một mục vào `tools/routes.json`.

## Cấu trúc

- `js/cars.js` thông số thật + kiểu dáng đuôi xe; `js/calibrate.js` hiệu chỉnh η theo 0–100; `js/physics.js` lực dọc/ngang; `js/ai.js` tay đua AI; `js/traffic.js` giao thông; `js/collision.js` va chạm; `js/race.js` orchestrator; `js/render.js`, `js/vehicles.js`, `js/effects.js` vẽ; `js/ui.js`, `js/hud.js` giao diện; `js/config.js` mọi nút chỉnh.
- `tools/` script dựng đường; `assets/tracks/` dữ liệu đường; `tests/` test.

## Ghi công

Dữ liệu đường © OpenStreetMap contributors (ODbL 1.0) — https://www.openstreetmap.org/copyright. Độ cao SRTM (NASA/USGS) qua Open Topo Data. Thông số xe tổng hợp từ Wikipedia, oto.com.vn, bonbanh.com, VnExpress, Tuổi Trẻ. Dự án cá nhân, không liên kết với VinFast.
