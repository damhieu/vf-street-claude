#!/usr/bin/env python3
"""Server nhỏ chỉ dùng lúc dựng video quảng cáo: nhận khung hình JPEG từ trình duyệt và ghi ra đĩa.

Chạy: python3 tools/capture_server.py <thư-mục-đích> [cổng]
Trình duyệt POST tới http://localhost:8099/upload?name=scene_0001.jpg với thân là JPEG nhị phân.
"""
import os, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

OUT = sys.argv[1] if len(sys.argv) > 1 else "tools/cache/frames"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8099
os.makedirs(OUT, exist_ok=True)


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        from urllib.parse import urlparse, parse_qs
        import base64, json
        q = parse_qs(urlparse(self.path).query)
        name = os.path.basename(q.get("name", ["frame.jpg"])[0])
        start = int(q.get("start", ["0"])[0])
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        written = 0
        if name.endswith((".jpg", ".png", ".txt", ".wav")):
            with open(os.path.join(OUT, name), "wb") as f:
                f.write(data)
            written = 1
        else:  # lô khung hình: JSON mảng data URL -> <name>_0000.jpg
            for i, url in enumerate(json.loads(data)):
                raw = base64.b64decode(url.split(",", 1)[1])
                with open(os.path.join(OUT, f"{name}_{start + i:04d}.jpg"), "wb") as f:
                    f.write(raw)
                written += 1
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(f"{name} {written}".encode())

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"nhận khung hình vào {OUT} tại cổng {PORT}", flush=True)
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
