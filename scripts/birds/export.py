# 고른 새(design/bird-photo) → 앱이 읽는 자료(src/lib/birdPhoto.data.ts).
#
#   python scripts/birds/export.py
#
# 새마다: 앉은 윤곽(칸 격자 폭 256의 안팎 비트 + 윤곽 점)과, 작은 새는 날갯짓 세 장면(올림 · 수평 · 내림)의 윤곽을 같은 좌표로.
# 까마귀의 나는 모습은 큰까마귀 연속 사진 한 벌(RAVEN_FLY) — 세 장면이 겹치는 몸(비트)에 글을 맞춘다.
# 칸 격자는 담지 않는다 — 앱(birdPhoto.ts)이 윤곽 점으로 칠한다(그리는 윤곽 = 재는 윤곽, 자료가 285KB → 1/3).
import json, os
import cv2, numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BP = os.path.join(ROOT, 'design', 'bird-photo')
OUT = os.path.join(ROOT, 'src', 'lib', 'birdPhoto.data.ts')
GW = 256
B = json.load(open(os.path.join(BP, 'birds.json'), encoding='utf-8'))
# 머리가 오른쪽 = 1 — 격자(design/landscape-bird-photo-round.png · -crow.png)에서 읽었다
FACE = {'r1546': 1, 'r1127': -1, 'r870': -1, 'r1062': 1, 'r561': 1, 'r012': 1, 'r1148': 1, 'r254': -1, 'r764': 1,
        'c470': 1, 'c396': -1, 'c511': -1, 'c639': 1, 'c671': 1, 'c504': -1, 'c513': -1, 'c656': 1, 'c825': -1, 'c385': 1, 'c590': -1, 'c868': -1}


def read(path):
    return (cv2.imread(path, cv2.IMREAD_GRAYSCALE) > 127).astype(np.uint8)


def outline(m, L=None):
    """구름 · 새 대조표와 같은 결 — 긴 쪽의 0.4%로 뭉개고 가장 큰 덩이의 윤곽, 점 줄이기 0.15%.
    L을 주면 그 길이로 — 날갯짓 장면은 앉은 몸의 길이로 줄인다(판이 큰 장면만 거칠게 줄여 몸 모서리가 깎였다)"""
    ys, xs = np.nonzero(m); L = L or max(np.ptp(xs), np.ptp(ys))
    b = cv2.GaussianBlur(m.astype(np.float32), (0, 0), max(0.8, 0.004 * L)) > 0.5
    cs, _ = cv2.findContours(b.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    return cv2.approxPolyDP(max(cs, key=cv2.contourArea), 0.0015 * L, True)[:, 0, :].astype(np.float64)


def frame_of(masks):
    """여러 판을 하나의 좌표로 — 모두를 합친 테두리, 긴 쪽이 GW"""
    U = np.zeros_like(masks[0])
    for m in masks: U |= m
    ys, xs = np.nonzero(U)
    x0, y0, w, h = xs.min(), ys.min(), np.ptp(xs) + 1, np.ptp(ys) + 1
    s = GW / max(w, h)
    return (x0, y0, s), max(1, round(h * s)), max(1, round(w * s))


def to_grid(pts, fr):
    (x0, y0, s) = fr
    return (pts - [x0, y0]) * s


def fmt(pts):
    return '[' + ','.join(f'[{round(float(x), 1)},{round(float(y), 1)}]' for x, y in pts) + ']'


rows = []
for id_ in B['round']:
    F = os.path.join(BP, 'fly', 'frames')
    ms = {k: read(os.path.join(F, f'{id_}-{k}.png')) for k in ('sit', 'up', 'mid', 'down')}
    fr, gh, gw = frame_of(list(ms.values()))
    ys, xs = np.nonzero(ms['sit']); Ls = max(np.ptp(xs), np.ptp(ys))
    P = {k: to_grid(outline(m, Ls), fr) for k, m in ms.items()}
    rows.append({'id': id_, 'kind': 'round', 'face': FACE[id_], 'w': GW, 'h': gh, 'pts': P['sit'],
                 'fly': {k: P[k] for k in ('up', 'mid', 'down')}})
for id_ in B['crow']:
    m = read(os.path.join(BP, 'mask', id_ + '.png'))
    fr, gh, gw = frame_of([m])
    P = to_grid(outline(m), fr)
    rows.append({'id': id_, 'kind': 'crow', 'face': FACE[id_], 'w': GW, 'h': gh, 'pts': P})

# 까마귀가 날 때 — 큰까마귀 세 장면(머리 · 꼬리로 맞춰 겹친 판). 글은 세 장면이 모두 덮는 몸에 맞춘다(앱이 칠해 겹친다)
F = os.path.join(BP, 'fly', 'frames')
rm = {k: read(os.path.join(F, f'crow-{k}.png')) for k in ('up', 'mid', 'down')}
fr, gh, gw = frame_of(list(rm.values()))
RP = {k: to_grid(outline(m), fr) for k, m in rm.items()}

lines = [
    '// 자동 생성 — scripts/birds/export.py가 design/bird-photo에서 만든다. 손으로 고치지 않는다.',
    '// 유머있는의 새(2026-10-01, 디자이너가 격자로 고른 판): 귀여운 = 배가 둥근 작은 새 9, 시니컬한 = 까마귀 12. 앉은 옆모습 · 다리 없음.',
    '// 좌표는 칸 격자(긴 쪽 256) 기준. pts = 앉은 윤곽 점(칸 단위) — 글 자리를 찾는 칸 격자는 앱이 이 점으로 칠한다.',
    '// face = 머리가 오른쪽이면 1. fly = 날갯짓 세 장면(작은 새 — 앉은 몸에 종다리 날개를 붙였다, 앉은 윤곽과 같은 좌표).',
    '// RAVEN_FLY = 까마귀가 날 때의 큰까마귀 세 장면(머리가 왼쪽) — 글은 세 장면이 모두 덮는 몸에 맞춘다.',
    '',
    "type Pts = readonly (readonly [number, number])[];",
    "export interface BirdShape { id: string; kind: 'round' | 'crow'; face: 1 | -1; w: number; h: number; pts: Pts; fly?: { up: Pts; mid: Pts; down: Pts } }",
    'export interface BirdFly { w: number; h: number; up: Pts; mid: Pts; down: Pts }',
    '',
    'export const BIRD_PHOTOS: readonly BirdShape[] = [',
]
for r in rows:
    fly = f", fly: {{ up: {fmt(r['fly']['up'])}, mid: {fmt(r['fly']['mid'])}, down: {fmt(r['fly']['down'])} }}" if 'fly' in r else ''
    lines.append(f"  {{ id: '{r['id']}', kind: '{r['kind']}', face: {r['face']}, w: {r['w']}, h: {r['h']}, pts: {fmt(r['pts'])}{fly} }},")
lines.append('];')
lines.append('')
lines.append(f"export const RAVEN_FLY: BirdFly = {{ w: {GW}, h: {gh}, up: {fmt(RP['up'])}, mid: {fmt(RP['mid'])}, down: {fmt(RP['down'])} }};")
open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
print('내보냄', len(rows), '마리 →', os.path.relpath(OUT, ROOT), f'{os.path.getsize(OUT) / 1024:.0f}KB',
      '점 수', [len(r['pts']) for r in rows], '큰까마귀', [len(RP[k]) for k in RP])
