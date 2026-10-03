# 땅의 풀 — 고른 실루엣(design/grass-photo/sil)을 앱 자료(src/lib/grassPhoto.data.ts)로 내보낸다. 프로젝트 루트에서 부른다.
# 강아지풀은 줄기를 늘린 판(×2.2 — meadow.py의 slender, 디자이너 10-04)을 미리 지어 싣는다. 민들레는 sil에 이미 늘린 줄기가 들어 있다.
# 그림은 키 112px 한 색 알파(벽 1080에서 가장 큰 풀이 53px — 화면 배율 2까지 또렷하게)
import base64, io, json
import numpy as np
from PIL import Image

H_OUT = 112
SP = {'fox': 'f020 f036 f037 f038 f039 f044 f045 f057 f059'.split(),
      'dan': 'd030 d035 d044 d069 d070 d076 d082'.split(),
      'clo': 'c015 c090'.split()}   # 토끼풀 c054 · c073 · c074는 디자이너가 뺐다(10-04)
FOX_STRETCH = 2.2

def slender(im, f):
    """밑에서 올라가며 가는 줄기만 있는 띠를 세로로 늘려 키를 f배로(meadow.py와 같은 식)"""
    a = np.array(im) > 127; Hs, Ws = a.shape
    def runs(y):
        xs = np.nonzero(a[y])[0]
        return np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1) if len(xs) else []
    widths = [len(r) for y in range(Hs - 1, int(Hs * 0.9), -1) for r in runs(y)]
    thr = max(3, 3 * float(np.median(widths))) if widths else 4
    yb = Hs - 1
    for y in range(Hs - 1, -1, -1):
        rs = runs(y)
        if rs and max(len(r) for r in rs) > thr: yb = y; break
    zone = Hs - yb; z = min(8.0, 1 + (f - 1) * Hs / max(zone, 1))
    top = im.crop((0, 0, Ws, yb)); bot = im.crop((0, yb, Ws, Hs)).resize((Ws, max(1, round(zone * z))), Image.BILINEAR)
    out = Image.new('L', (Ws, top.height + bot.height), 0); out.paste(top, (0, 0)); out.paste(bot, (0, top.height))
    return out

rows = []
for sp, ids in SP.items():
    for k in ids:
        im = Image.open(f'design/grass-photo/sil/{k}.png').convert('L')
        if sp == 'fox': im = slender(im, FOX_STRETCH)
        w = max(1, round(im.width * H_OUT / im.height))
        im = im.resize((w, H_OUT), Image.LANCZOS)
        rgba = Image.new('LA', im.size, 255); rgba.putalpha(im)
        b = io.BytesIO(); rgba.save(b, 'PNG', optimize=True)
        rows.append({'id': k, 'species': sp, 'aspect': round(w / H_OUT, 4), 'png': 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()})

lines = ['// 자동 생성 — scripts/grass/export.py가 design/grass-photo/sil에서 만든다. 손으로 고치지 않는다.',
         '// 벽의 땅 위 사진 풀(2026-10-04, 디자이너가 격자로 고름 — 강아지풀 9 · 민들레 7 · 토끼풀 2). 위키미디어 CC0 · 공공(design/grass-photo/sources.json).',
         '// png = 키 112px 한 색 알파(칠은 화면이 --grey-800으로 입힌다), aspect = 가로 ÷ 세로. 강아지풀은 줄기를 늘린 판(×2.2).',
         '',
         "export type GrassSpecies = 'fox' | 'dan' | 'clo';",
         'export interface GrassShape { id: string; species: GrassSpecies; aspect: number; png: string }',
         '',
         'export const GRASS_PHOTOS: readonly GrassShape[] = [']
for r in rows:
    lines.append(f"  {{ id: '{r['id']}', species: '{r['species']}', aspect: {r['aspect']}, png: '{r['png']}' }},")
lines.append('];')
open('src/lib/grassPhoto.data.ts', 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
print(len(rows), 'plants', round(sum(len(r['png']) for r in rows) / 1024), 'KB')
