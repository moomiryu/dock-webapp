#!/usr/bin/env python3
"""홈의 물리 스위치를 읽어 벽에 알린다.

폰이 홈에 꽂히면 스위치가 닫히고, 이 프로그램이 Firestore의
control/display.switch 를 true로 올린다. 폰을 빼면 false로 내린다.

**이 프로그램은 '어느 글이냐'를 모른다.** 그건 폰이 안다. 스위치는 "꽂혔다"만
말하고, 07 도킹 화면에 서 있던 폰이 그 말을 듣고 제 글의 id를 실어 벽에
보낸다. 그래서 여기서 할 일은 참/거짓 하나를 쓰는 것이 전부다.

핀: 11번(GPIO 17). 스위치의 반대쪽은 GND(6번 또는 9번 핀).
내부 풀업을 쓰므로 저항을 따로 달지 않는다 — 눌리면 GND로 떨어진다.

돌리는 법:
    MEGAFONT_PROJECT=... MEGAFONT_KEY=... python3 switch.py
설치하면 pi/install.sh가 systemd 서비스로 등록해 부팅 때 자동으로 돈다.

stdlib만 쓴다(urllib). gpiozero는 라즈베리파이 OS에 이미 들어 있다.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

from gpiozero import Button
from signal import pause

PIN = 17            # 11번 핀
BOUNCE_S = 0.05     # 접점이 떠는 동안(채터링)을 무시한다

PROJECT = os.environ.get('MEGAFONT_PROJECT')
KEY = os.environ.get('MEGAFONT_KEY')
if not PROJECT or not KEY:
    sys.exit('MEGAFONT_PROJECT / MEGAFONT_KEY 가 없다. pi/megafont.env 를 보라.')

URL = (
    f'https://firestore.googleapis.com/v1/projects/{PROJECT}'
    f'/databases/(default)/documents/control/display'
    f'?key={KEY}&updateMask.fieldPaths=switch'
)


def write(on: bool) -> None:
    """control/display.switch 한 칸만 고친다.

    updateMask가 있어서 showTrigger·showId·docked 는 건드리지 않는다 —
    그 셋은 폰이 쓰는 칸이다. 여기서 문서를 통째로 쓰면 폰이 방금 올린
    신호를 지워 버린다.
    """
    body = json.dumps({'fields': {'switch': {'booleanValue': on}}}).encode()
    req = urllib.request.Request(
        URL, data=body, method='PATCH',
        headers={'Content-Type': 'application/json'}
    )
    # 캠퍼스 와이파이가 잠깐 끊기는 일은 흔하다. 세 번까지 다시 걸어 본다 —
    # 여기서 포기하면 사람이 폰을 꽂았는데 벽이 가만히 있는 것으로 보인다.
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                print(f'switch={on} ok ({res.status})', flush=True)
                return
        except (urllib.error.URLError, OSError) as e:
            print(f'switch={on} 실패 {attempt + 1}/3: {e}', flush=True)
            time.sleep(0.6)


button = Button(PIN, pull_up=True, bounce_time=BOUNCE_S)
button.when_pressed = lambda: write(True)
button.when_released = lambda: write(False)

# 켤 때 한 번 맞춰 둔다. 지난번에 빼면서 false를 못 쓰고 꺼졌을 수 있다.
write(button.is_pressed)
print(f'GPIO {PIN} 감시 시작 (지금 {"꽂힘" if button.is_pressed else "비어 있음"})', flush=True)
pause()
