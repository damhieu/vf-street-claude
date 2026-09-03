#!/usr/bin/env bash
# Dựng video quảng cáo VF Street (16:9, 1280x720, 30 fps) từ:
#   - clip điện ảnh Higgsfield: assets/video/menu-bg.mp4
#   - cảnh chơi thật quay từ game: tools/cache/frames/<scene>_*.jpg
#   - thẻ chữ tiếng Việt render bằng canvas: tools/cache/frames/card_*.png
# Dùng: bash tools/build_ad.sh [thư-mục-tạm]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="${1:-$ROOT/tools/cache/ad}"
FRAMES="$ROOT/tools/cache/frames"
CINE="$ROOT/assets/video/menu-bg.mp4"
OUT="$ROOT/assets/video/vf-street-ad.mp4"
mkdir -p "$TMP"
V="scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30,format=yuv420p"

# 1) cảnh chơi: chuỗi ảnh -> mp4 (giữ độ dài mong muốn)
scene() { # tên  số-giây
  ffmpeg -y -loglevel error -framerate 30 -pattern_type glob -i "$FRAMES/$1_*.jpg" \
    -t "$2" -vf "$V" -c:v libx264 -crf 18 -preset medium "$TMP/g_$1.mp4"
}

# 2) một đoạn = nền video + thẻ chữ mờ dần vào/ra
seg() { # tệp-nền  bắt-đầu  dài  thẻ  tệp-ra
  local bg="$1" ss="$2" dur="$3" card="$4" out="$5"
  ffmpeg -y -loglevel error -ss "$ss" -t "$dur" -i "$bg" -loop 1 -t "$dur" -i "$FRAMES/$card" \
    -filter_complex "[0:v]$V[bg];[1:v]format=rgba,fade=in:st=0.15:d=0.45:alpha=1,fade=out:st=$(echo "$dur-0.5" | bc):d=0.45:alpha=1[c];[bg][c]overlay=0:0:format=auto,format=yuv420p[v]" \
    -map "[v]" -c:v libx264 -crf 18 -preset medium "$out"
}

echo "→ cảnh chơi"
scene haivan 5.0; scene ct04 4.5; scene mapileng 3.5; scene oquyho 3.5; scene danang 4.5

echo "→ ghép chữ"
seg "$CINE"            0   5.0 card_title.png   "$TMP/s1.mp4"
seg "$TMP/g_haivan.mp4"   0   5.0 card_roads.png   "$TMP/s2.mp4"
seg "$TMP/g_ct04.mp4"     0   4.5 card_speed.png   "$TMP/s3.mp4"
seg "$TMP/g_mapileng.mp4" 0   3.5 card_pass.png    "$TMP/s4.mp4"
seg "$TMP/g_oquyho.mp4"   0   3.5 card_fog.png     "$TMP/s5.mp4"
seg "$TMP/g_danang.mp4"   0   4.5 card_night.png   "$TMP/s6.mp4"
seg "$CINE"            9.0 4.0 card_physics.png "$TMP/s7.mp4"

echo "→ thẻ kết (zoom chậm)"
ffmpeg -y -loglevel error -loop 1 -t 5.2 -i "$FRAMES/card_end.png" \
  -vf "scale=2560:1440,zoompan=z='min(1+0.0006*on,1.09)':d=1:s=1280x720:fps=30,format=yuv420p" \
  -c:v libx264 -crf 18 -preset medium "$TMP/s8.mp4"

echo "→ nối và làm mờ đầu/cuối"
: > "$TMP/list.txt"
for i in 1 2 3 4 5 6 7 8; do echo "file '$TMP/s$i.mp4'" >> "$TMP/list.txt"; done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -c copy "$TMP/noaudio.mp4"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/noaudio.mp4")
ffmpeg -y -loglevel error -i "$TMP/noaudio.mp4" \
  -vf "fade=in:st=0:d=0.6,fade=out:st=$(echo "$DUR-0.8" | bc):d=0.8" \
  -c:v libx264 -crf 19 -preset slow -pix_fmt yuv420p -movflags +faststart "$TMP/picture.mp4"

if [ -f "$TMP/sound.wav" ]; then
  echo "→ ghép tiếng"
  ffmpeg -y -loglevel error -i "$TMP/picture.mp4" -i "$TMP/sound.wav" \
    -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"
else
  echo "→ chưa có tiếng, xuất bản hình"
  cp "$TMP/picture.mp4" "$OUT"
fi
echo "xong: $OUT ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s, $(du -h "$OUT" | cut -f1))"
