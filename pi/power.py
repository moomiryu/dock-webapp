#!/usr/bin/env python3
"""벽의 끄기 버튼이 보내는 신호를 받아 파이를 끈다(2026-10-21).

그전엔 선을 뽑아 껐다. 그러면 저장 카드에 쓰던 것이 반쯤 남아 카드가 상할 수
있다. 벽 오른쪽 아래의 끄기 버튼 → '종료하시겠어요?'에서 '예' → 벽이 옛 TV처럼
접혀 꺼진 뒤 → 이 프로그램이 신호를 받아 파이를 정상 종료한다.

**웹 페이지는 컴퓨터를 끌 수 없다** — 브라우저가 막는다. 그래서 파이 안에 이
작은 문지기를 두고, 벽 페이지가 여기에 한 번 두드린다.

아무나 두드리지 못하게 두 겹으로 막는다.
    - 파이 자신(127.0.0.1)에서만 받는다. 같은 와이파이의 다른 기기도 못 닿는다
    - 벽 주소(MEGAFONT_URL의 출처)에서 온 요청만 듣는다. 파이 브라우저에 다른
      사이트가 열려도 그 사이트는 못 끈다

끄는 명령은 `sudo -n systemctl poweroff` 하나뿐이고, install.sh가 sudoers에
그 명령 하나만 비밀번호 없이 허락해 둔다.

크롬 142부터 웹 페이지가 기기 안의 프로그램을 부르면 "로컬 네트워크 접근" 허락
창이 뜬다. 키오스크에서 그 창이 뜨면 아무도 못 누른다 — install.sh가 크로미움
관리 정책(LocalNetworkAccessAllowedForUrls)에 벽 주소를 미리 적어 둔다.

돌리는 법:
    MEGAFONT_URL=https://megafont.vercel.app/wall python3 power.py
설치하면 pi/install.sh가 systemd 서비스로 등록해 부팅 때 자동으로 돈다.

개발 PC에서 시험할 땐 끄는 명령을 바꿔 둔다(진짜로 꺼지지 않게):
    MEGAFONT_POWER_CMD="echo 끈다" MEGAFONT_URL=http://localhost:5173/wall python3 power.py

stdlib만 쓴다.
"""
import os
import shlex
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit

# 벽 페이지가 두드리는 자리 — src/components/WallPower.tsx의 POWER_URL과 같아야 한다
HOST, PORT = '127.0.0.1', 8765
_wall = urlsplit(os.environ.get('MEGAFONT_URL', 'https://megafont.vercel.app/wall'))
ORIGIN = f'{_wall.scheme}://{_wall.netloc}'
CMD = shlex.split(os.environ.get('MEGAFONT_POWER_CMD', 'sudo -n systemctl poweroff'))


class Door(BaseHTTPRequestHandler):
    def _allow(self) -> bool:
        """벽 주소에서 온 요청이면 브라우저가 대답을 읽을 수 있게 문을 열어 둔다"""
        if self.headers.get('Origin') != ORIGIN:
            return False
        self.send_header('Access-Control-Allow-Origin', ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'POST')
        # 옛 크롬의 '사설망 접근' 사전 확인에 대한 대답 — 없으면 요청이 막힌다
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        return True

    def do_OPTIONS(self):
        self.send_response(204)
        self._allow()
        self.end_headers()

    def do_POST(self):
        if self.path != '/poweroff' or self.headers.get('Origin') != ORIGIN:
            self.send_response(403)
            self.end_headers()
            print(f'거절: {self.path} · {self.headers.get("Origin")}', flush=True)
            return
        self.send_response(200)
        self._allow()
        self.end_headers()
        self.wfile.write(b'ok')
        self.wfile.flush()
        # 대답을 먼저 보내고 끈다 — 벽은 이미 접혀 꺼진 모습이다
        print('끈다', flush=True)
        subprocess.Popen(CMD)

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    print(f'끄기 문지기: {HOST}:{PORT} · 받는 출처 {ORIGIN} · 명령 {" ".join(CMD)}', flush=True)
    HTTPServer((HOST, PORT), Door).serve_forever()
