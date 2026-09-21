#!/usr/bin/env python3
"""홈의 물리 스위치를 읽어 벽에 알린다.

폰이 홈에 꽂히면 스위치가 닫히고, 이 프로그램이 Firestore의 `control/dock`에
**꽂혔다는 사실과 그 순간의 시각**을 쓴다. 폰을 빼면 풀렸다고 쓴다.

**이 프로그램은 '어느 글이냐'를 모른다.** 그건 폰이 안다. 스위치는 "꽂혔다"와
"언제"만 말하고, 07 도킹 화면에서 대기 자리에 제 이름을 올려 둔 폰이 그 말을
듣고 제 글의 id를 실어 송출을 시작한다.

쓰는 칸은 넷이다.

    plugged    지금 꽂혀 있나
    switchId   **눌릴 때마다 새로 생기는 번호.** 같은 번호면 같은 꽂음이다.
               07에 선 폰은 제가 도착했을 때의 번호를 기억해 두고, 그것과
               다른 번호가 나타날 때만 제 꽂음으로 센다 — 앞사람이 안 빼고
               간 상태로 들어온 사람이 닿자마자 넘어가지 않게 하는 장치다
    switchAt   그 순간(ms). **폰과 벽이 여기서 30초를 센다**
    piAt       살아 있다는 표시. 30초마다 찍는다 — 이게 멎으면 07 화면이
               "설치물과 연결이 안 돼요"라고 말한다

문서가 `control/display`에서 `control/dock`으로 옮겨 왔다. 그 문서에는 옛
필드가 남아 있어서, 이름이 겹치는 칸을 새 뜻으로 다시 쓰면 배포가 반쯤 된
동안 옛 값이 새 판정을 오염시킨다.

**시각이 이 프로그램의 산출물이 됐다.** 파이에는 시계 배터리가 없어 부팅
직후의 시각은 지난번 꺼진 때이거나 1970년이다. 그대로 쓰면 꽂은 순간이
엉뚱한 곳에 찍히고, 폰의 남은 시간이 처음부터 0이 된다. 그래서 NTP가
맞춰 줄 때까지 기다렸다 시작한다.

핀: 11번(GPIO 17). 스위치의 반대쪽은 GND(6번 또는 9번 핀).
내부 풀업을 쓰므로 저항을 따로 달지 않는다 — 눌리면 GND로 떨어진다.

돌리는 법:
    MEGAFONT_PROJECT=... MEGAFONT_KEY=... python3 switch.py
설치하면 pi/install.sh가 systemd 서비스로 등록해 부팅 때 자동으로 돈다.

stdlib만 쓴다(urllib). gpiozero는 라즈베리파이 OS에 이미 들어 있다.
"""

import json
import os
import random
import sys
import threading
import time
import urllib.error
import urllib.request

from gpiozero import Button

PIN = 17            # 11번 핀
BOUNCE_S = 0.05     # 접점이 떠는 동안(채터링)을 무시한다

#: 살아 있다는 표시를 찍는 간격. 웹은 90초까지 기다렸다 끊긴 것으로 본다 —
#: 세 번 놓쳐야 죽었다고 하는 셈이라 한두 번의 실패로는 안 흔들린다.
HEARTBEAT_S = 30

#: 못 보낸 것이 있을 때 다시 거는 간격. 사람이 폰을 꽂아 두고 벽을 올려다보는
#: 동안이라 30초를 기다릴 수 없다.
RETRY_S = 2

#: 시계를 기다리는 한도. 넘으면 그냥 시작한다 — 시각이 틀린 채로라도 도는
#: 편이, 스위치가 아예 안 듣는 것보다 낫다.
CLOCK_WAIT_S = 120

PROJECT = os.environ.get('MEGAFONT_PROJECT')
KEY = os.environ.get('MEGAFONT_KEY')
if not PROJECT or not KEY:
    sys.exit('MEGAFONT_PROJECT / MEGAFONT_KEY 가 없다. pi/megafont.env 를 보라.')

DOC = (
    f'https://firestore.googleapis.com/v1/projects/{PROJECT}'
    f'/databases/(default)/documents/control/dock'
)


def now_ms() -> int:
    return int(time.time() * 1000)


def clock_is_set() -> bool:
    """시계가 맞춰졌나.

    이 파일보다 현재 시각이 앞서 있으면 아직 안 맞춰진 것이다 — 파일은
    적어도 여기 옮겨진 그 시각에는 있었으므로, 그보다 과거일 수는 없다.
    `timedatectl` 같은 것에 기대지 않아서 데스크톱이 없는 판에서도 듣는다.
    """
    try:
        return time.time() > os.path.getmtime(__file__)
    except OSError:
        return True


def wait_for_clock() -> None:
    if clock_is_set():
        return
    print('시계가 아직 안 맞춰졌다. NTP를 기다린다…', flush=True)
    for _ in range(CLOCK_WAIT_S):
        time.sleep(1)
        if clock_is_set():
            print(f'시계 맞춰짐: {time.strftime("%Y-%m-%d %H:%M:%S")}', flush=True)
            return
    print(f'⚠ {CLOCK_WAIT_S}초를 기다려도 안 맞춰졌다. 그대로 시작한다 — '
          f'폰의 남은 시간이 어긋날 수 있다.', flush=True)


def patch(fields: dict) -> bool:
    """지정한 칸만 고친다.

    updateMask가 있어서 폰이 쓰는 칸(대기 자리·송출 사건)은 건드리지 않는다 —
    문서를 통째로 쓰면 폰이 방금 올린 신호를 지워 버린다.
    """
    mask = '&'.join(f'updateMask.fieldPaths={k}' for k in fields)
    body = json.dumps({'fields': fields}).encode()
    req = urllib.request.Request(
        f'{DOC}?key={KEY}&{mask}', data=body, method='PATCH',
        headers={'Content-Type': 'application/json'}
    )
    # 캠퍼스 와이파이가 잠깐 끊기는 일은 흔하다. 여기서 두 번 걸어 보고,
    # 그래도 안 되면 아래 루프가 2초마다 계속 맡는다 — **포기하지 않는다.**
    # 여기서 놓아 버리면 사람이 폰을 꽂았는데 벽이 가만히 있는 것으로 보인다.
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                return 200 <= res.status < 300
        except (urllib.error.URLError, OSError) as e:
            print(f'쓰기 실패 {attempt + 1}/2: {e}', flush=True)
            time.sleep(0.6)
    return False


lock = threading.Lock()

#: 아직 벽이 모르는 스위치 상태. 보내는 데 성공하면 비운다.
#: 이게 비어 있지 않은 동안은 루프가 2초마다 다시 건다.
pending: dict | None = None


def flush(label: str) -> None:
    """못 보낸 스위치 상태가 있으면 보낸다. 살아 있다는 표시는 늘 함께 찍는다."""
    global pending
    with lock:
        mine = pending

    fields: dict = {'piAt': {'integerValue': str(now_ms())}}
    if mine is not None:
        fields['plugged'] = {'booleanValue': mine['plugged']}
        fields['switchAt'] = {'integerValue': str(mine['switchAt'])}
        # 뗄 때는 번호를 새로 만들지 않는다. 번호는 **꽂음**을 가리키는 것이고,
        # 여기서 바꾸면 07에 선 폰이 아무도 안 꽂았는데 꽂힘을 본다.
        if mine['switchId']:
            fields['switchId'] = {'stringValue': mine['switchId']}

    if not patch(fields):
        return

    if mine is not None:
        with lock:
            if pending is mine:
                pending = None
        print(f'{label}: plugged={mine["plugged"]} at={mine["switchAt"]}', flush=True)


def mark(plugged: bool, new_press: bool) -> None:
    global pending
    at = now_ms()
    with lock:
        pending = {
            'plugged': plugged,
            # 꽂음 하나에 번호 하나. 계속 누르고 있어도 gpiozero는 눌린
            # 순간에만 부르므로 번호도 그때 한 번만 생긴다.
            'switchId': f'{at:x}-{random.randrange(1 << 24):06x}' if new_press else None,
            'switchAt': at
        }


button = Button(PIN, pull_up=True, bounce_time=BOUNCE_S)
button.when_pressed = lambda: (mark(True, True), flush('꽂힘'))
button.when_released = lambda: (mark(False, False), flush('빠짐'))

wait_for_clock()

# 켤 때 지금 상태를 한 번 맞춰 둔다. 지난번에 빼면서 못 쓰고 꺼졌을 수 있다.
# **꽂음 번호는 새로 만들지 않는다** — 부팅은 누가 꽂은 사건이 아니다.
# 여기서 새 번호를 쓰면 07 화면에 서 있던 폰이 그걸 제 꽂음으로 읽는다.
mark(button.is_pressed, False)
flush('시작')
print(f'GPIO {PIN} 감시 시작 (지금 {"꽂힘" if button.is_pressed else "비어 있음"})', flush=True)

while True:
    with lock:
        waiting = pending is not None
    time.sleep(RETRY_S if waiting else HEARTBEAT_S)
    flush('재시도' if waiting else '생존')
