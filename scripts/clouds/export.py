# 고른 띠 구름 12장 → 앱이 읽는 자료(src/lib/cloudPhoto.data.ts).
#
#   python scripts/clouds/export.py
#
# 2026-10-01부터 꼬리를 '혹의 사슬'로 다시 지은 판(design/cloud-photo/band-chain, scripts/clouds/tail.py)을 읽는다.
# 그 전 판(design/cloud-photo/band)은 몸통의 재료로 남아 있다.
# 칸 격자(폭 256)로 윤곽 안팎을 담고(글 자리를 찾을 때), 윤곽 점은 그 격자 좌표로 담는다(그릴 때).
# 격자는 윤곽 점으로 다시 칠해서 만든다 — 그리는 윤곽과 재는 윤곽이 같아야 글이 밖으로 안 나간다.
# 꼬리 끝 너머 떨어진 조각은 extra(윤곽 여럿)로 — 격자에도 칠한다.
import base64, json, os
import cv2, numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BAND = os.path.join(ROOT, 'design', 'cloud-photo', 'band-chain')
OUT = os.path.join(ROOT, 'src', 'lib', 'cloudPhoto.data.ts')
GW = 256

V = json.load(open(os.path.join(BAND, 'band.json'), encoding='utf-8'))['variants']
rows = []
for v in V:
    s = GW / v['w']
    gh = max(1, round(v['h'] * s))
    rings = [np.array(r, np.float64) * s for r in [v['outline'], *v.get('extra', [])]]
    # 칸의 가운데가 윤곽 안인 칸만 '안' — 걸친 칸은 밖으로 친다(앱이 한 칸 더 깎아 여유를 둔다)
    hi = 8
    m = np.zeros((gh * hi, GW * hi), np.uint8)
    for r in rings: cv2.fillPoly(m, [np.round(r * hi).astype(np.int32)], 1)
    cell = m[hi // 2::hi, hi // 2::hi][:gh, :GW]
    bits = np.packbits(cell.astype(np.uint8), axis=None, bitorder='big')
    rnd = lambda r: [[round(float(x), 2), round(float(y), 2)] for x, y in r]
    rows.append({'id': v['id'], 'w': GW, 'h': gh, 'bits': base64.b64encode(bits.tobytes()).decode('ascii'),
                 'pts': rnd(rings[0]), 'extra': [rnd(r) for r in rings[1:]]})

lines = [
    '// 자동 생성 — scripts/clouds/export.py가 design/cloud-photo/band-chain에서 만든다. 손으로 고치지 않는다.',
    '// 다정한의 띠 구름 12장(2026-09-30 디자이너가 격자로 고른 판, 2026-10-01 꼬리를 혹의 사슬로). 좌표는 칸 격자(폭 256) 기준.',
    '// bits = 칸마다 윤곽 안(1) · 밖(0), 줄 차례 · 큰 비트 먼저, base64. pts = 윤곽 점(칸 단위, 소수). extra = 꼬리 끝 너머 떨어진 조각.',
    '',
    'export interface PhotoShape { id: string; w: number; h: number; bits: string; pts: readonly (readonly [number, number])[]; extra?: readonly (readonly (readonly [number, number])[])[] }',
    '',
    'export const CLOUD_PHOTOS: readonly PhotoShape[] = [',
]
pt = lambda r: '[' + ','.join(f'[{x},{y}]' for x, y in r) + ']'
for r in rows:
    extra = f", extra: [{','.join(pt(e) for e in r['extra'])}]" if r['extra'] else ''
    lines.append(f"  {{ id: '{r['id']}', w: {r['w']}, h: {r['h']}, bits: '{r['bits']}', pts: {pt(r['pts'])}{extra} }},")
lines.append('];')
open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
print('내보냄', len(rows), '장 →', os.path.relpath(OUT, ROOT), f'{os.path.getsize(OUT) / 1024:.0f}KB',
      '칸 높이', [r['h'] for r in rows], '점 수', [len(r['pts']) for r in rows], '떨어진 조각', [len(r['extra']) for r in rows])
