# 고른 돌 다섯(design/stone-photo/stones.json) → 앱이 읽는 자료(src/lib/stonePhoto.data.ts) + 결 재료(src/assets/stones/<id>.png).
#
#   python scripts/stones/export.py
#
# 윤곽 점: 글이 기우는 각도(걸기 셋)마다 돌을 돌려 놓고 칸 격자를 짓는 일은 앱이 한다(cloud.ts photoStoneFor).
# 점은 돌 상자 안의 비율(가로 0~1, 세로 0~1, 밑 = 1 — 밑면은 y = 1인 곧은 변 하나)이고 aspect = 가로 ÷ 세로.
#
# 결 재료(2026-10-04, 빗금 결 — design/landscape.md '돌'의 결): 원본 사진의 밝기를 돌 상자에 맞춰 TEX_W 폭으로 줄이고 둘로 가른다.
#   R = 잔 결(면 · 금) + 128 — 밝기 − 큰 명암
#   G = 큰 명암(빛) — 돌 안의 밝기만 돌 폭의 15%로 넓게 뭉갠 판(돌 밖까지 이어진다 — 앱이 거울로 비춰 쓸 때 돌 밖 자리도 읽는다)
#   B = 돌 안(255) · 밖(0)
# light = 사진의 빛이 오는 쪽(밝기의 가로 기울기 부호). 벽의 빛은 오른쪽 위 하나 — 앱이 좌우 뒤집기와 빛을 맞춘다: 잔 결은 돌과 함께
# 뒤집고, 큰 명암은 사진 빛이 벽과 같으면 그대로 · 반대면 거울로(StoneArt). 배(땅에 묻힌 아랫부분)도 앱이 비춰 짓는다.
# 결의 문턱 · 정리 · 빗금은 앱이 글마다 한다 — 재료는 사진에서 온 밝기뿐이다.
import json, os
import cv2, numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PHOTO = os.path.join(ROOT, 'design', 'stone-photo')
SRC = os.path.join(PHOTO, 'stones.json')
OUT = os.path.join(ROOT, 'src', 'lib', 'stonePhoto.data.ts')
TEX = os.path.join(ROOT, 'src', 'assets', 'stones')
TEX_W = 256           # 결 재료의 폭 — 앱은 그 위를 돌 키의 2.5%로 뭉개 쓰니 벽(돌 키 150px 안팎)에도 폰에도 넉넉하다
GRAIN = 0.008         # 잔 얼룩을 걷는 뭉개기(돌 키의 몫) — 격자에서 벽 1.2px(키 150)
LOW = 0.15            # 큰 명암(빛)을 뜨는 뭉개기(돌 폭의 몫)


def norm_pts(P):
    # 윤곽 점의 바깥끝(화소 끝이라 0.998쯤)을 상자에 꼭 맞춘다 — 밑면이 정확히 y = 1에 선다
    x0, x1 = min(p[0] for p in P), max(p[0] for p in P); y0, y1 = min(p[1] for p in P), max(p[1] for p in P)
    return [(round((x - x0) / (x1 - x0), 4), round((y - y0) / (y1 - y0), 4)) for x, y in P]


def texture(s, pts):
    name = s['name']
    im = cv2.imread(os.path.join(PHOTO, 'src', name + '.jpg')); sh = cv2.imread(os.path.join(PHOTO, 'shape', name + '.png'), 0)
    ys, xs = np.nonzero(sh > 127); x0, y0 = xs.min(), ys.min()
    crop = im[y0:y0 + s['h'], x0:x0 + s['w']]
    W = TEX_W; H = max(8, round(W * s['h'] / s['w']))
    L = cv2.cvtColor(cv2.resize(crop, (W, H), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2LAB)[:, :, 0].astype(np.float32)
    L = cv2.GaussianBlur(L, (0, 0), GRAIN * H)
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array([(x * (W - 1), y * (H - 1)) for x, y in pts], np.float32).round().astype(np.int32)], 1)
    sig = LOW * W
    low = cv2.GaussianBlur(L * m, (0, 0), sig) / np.maximum(cv2.GaussianBlur(m.astype(np.float32), (0, 0), sig), 1e-4)
    det = L - low
    yy, xx = np.nonzero(m)
    A = np.c_[np.ones(len(xx)), xx - xx.mean(), yy - yy.mean()]
    slope = np.linalg.lstsq(A, L[m > 0], rcond=None)[0][1]
    img = np.dstack([np.clip(m * 255, 0, 255), np.clip(low, 0, 255), np.clip(det + 128, 0, 255)]).round().astype(np.uint8)  # BGR로 쓴다
    os.makedirs(TEX, exist_ok=True)
    cv2.imwrite(os.path.join(TEX, name + '.png'), img)
    return 'R' if slope > 0 else 'L', W, H, float(np.abs(det[m > 0]).max())


S = json.load(open(SRC, encoding='utf-8'))['stones']
lines = [
    '// 자동 생성 — scripts/stones/export.py가 design/stone-photo/stones.json에서 만든다. 손으로 고치지 않는다.',
    '// 차분한의 사진 돌 다섯(2026-10-01, 디자이너가 격자로 고른 판 — 빙하 바위 넷 CC0 · 아폴로 17 Tracy\'s Rock 공공).',
    '// pts = 윤곽 점(돌 상자 안의 비율, 밑 = 1), aspect = 가로 ÷ 세로.',
    '// tex = 결 재료(R 잔 결 + 128 · G 큰 명암 · B 돌 안, 폭 ' + str(TEX_W) + '), light = 사진의 빛이 오는 쪽(L 왼쪽 · R 오른쪽) — 2026-10-04 빗금 결.',
    '',
    "export interface StoneShape { id: string; aspect: number; pts: readonly (readonly [number, number])[]; tex: string; light: 'L' | 'R' }",
    '',
    'export const STONE_PHOTOS: readonly StoneShape[] = [',
]
for s in S:
    P = norm_pts(s['points'])
    light, W, H, dmax = texture(s, P)
    pts = ', '.join(f'[{x:g}, {y:g}]' for x, y in P)
    lines.append(f"  {{ id: '{s['name']}', aspect: {s['aspect']}, pts: [{pts}], tex: new URL('../assets/stones/{s['name']}.png', import.meta.url).href, light: '{light}' }},")
    print(s['name'], '빛', light, f'결 {W}×{H}', '잔 결 최대', round(dmax, 1))
lines.append('];')
open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
print(OUT, len(S))
