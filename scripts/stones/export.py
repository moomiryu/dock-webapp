# 고른 돌 다섯(design/stone-photo/stones.json) → 앱이 읽는 자료(src/lib/stonePhoto.data.ts).
#
#   python scripts/stones/export.py
#
# 윤곽 점만 담는다 — 글이 기우는 각도(걸기 셋)마다 돌을 돌려 놓고 칸 격자를 짓는 일은 앱이 한다(cloud.ts photoStoneFor).
# 점은 돌 상자 안의 비율(가로 0~1, 세로 0~1, 밑 = 1 — 밑면은 y = 1인 곧은 변 하나)이고 aspect = 가로 ÷ 세로.
import json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design', 'stone-photo', 'stones.json')
OUT = os.path.join(ROOT, 'src', 'lib', 'stonePhoto.data.ts')

S = json.load(open(SRC, encoding='utf-8'))['stones']
lines = [
    '// 자동 생성 — scripts/stones/export.py가 design/stone-photo/stones.json에서 만든다. 손으로 고치지 않는다.',
    '// 차분한의 사진 돌 다섯(2026-10-01, 디자이너가 격자로 고른 판 — 빙하 바위 넷 CC0 · 아폴로 17 Tracy\'s Rock 공공).',
    '// pts = 윤곽 점(돌 상자 안의 비율, 밑 = 1), aspect = 가로 ÷ 세로.',
    '',
    'export interface StoneShape { id: string; aspect: number; pts: readonly (readonly [number, number])[] }',
    '',
    'export const STONE_PHOTOS: readonly StoneShape[] = [',
]
for s in S:
    # 윤곽 점의 바깥끝(화소 끝이라 0.998쯤)을 상자에 꼭 맞춘다 — 밑면이 정확히 y = 1에 선다
    P = s['points']; x0, x1 = min(p[0] for p in P), max(p[0] for p in P); y0, y1 = min(p[1] for p in P), max(p[1] for p in P)
    pts = ', '.join(f'[{round((x - x0) / (x1 - x0), 4):g}, {round((y - y0) / (y1 - y0), 4):g}]' for x, y in P)
    lines.append(f"  {{ id: '{s['name']}', aspect: {s['aspect']}, pts: [{pts}] }},")
lines.append('];')
open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
print(OUT, len(S))
