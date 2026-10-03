# 땅 위 풀밭 짓기(2026-10-04 3단계) — 격자마다 한 축만 바꾼다. 부르기: python scripts/grass/meadow.py <벽 캡처 · text-rects.json 폴더> <축>
# 고른 값: density 1.6 · scale 강아지풀 0.7 · 민들레 0.49 · 강아지풀 줄기 ×2.2 · mix 2 : 1 : 0.5 · 글 둘레 1.
# 땅(3% · 굴곡 + 잔결) 위에 사진 풀 21장을 무리지어 흩뿌리고, 글 둘레는 걷는다.
import json, math, random, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]; GR = f'{S}/../grass'
tok = open('src/styles/tokens.css', encoding='utf-8').read()
hexv = lambda n: re.search(r'--%s:\s*(#[0-9a-fA-F]{6})' % n, tok).group(1)
G800 = tuple(int(hexv('grey-800')[i:i + 2], 16) for i in (1, 3, 5)); LABEL, LINE = hexv('grey-300'), hexv('grey-700')
# 토끼풀 c054 · c073 · c074는 디자이너가 뺐다(10-04 — 벽 크기에서 성벽 같은 컵 모양)
SP = {'fox': 'f020 f036 f037 f038 f039 f044 f045 f057 f059'.split(), 'dan': 'd030 d035 d044 d069 d070 d076 d082'.split(), 'clo': 'c015 c090'.split()}
import os
# 실루엣 — 스크래치패드의 작업 판(.npy)이 있으면 그것, 없으면 저장소의 design/grass-photo/sil(.png)
SIL = {k: (Image.fromarray((np.load(f'{GR}/sil/{k}.npy') * 255).astype(np.uint8)) if os.path.exists(f'{GR}/sil/{k}.npy')
           else Image.open(f'design/grass-photo/sil/{k}.png').convert('L')) for v in SP.values() for k in v}
src = Image.open(f'{S}/wall-wide-t.png').convert('RGB'); W, H = src.size
g = round(H * 0.03); y0 = H - g
rects = [(a - 0, b - g, c, d - g) for a, b, c, d, _ in json.load(open(f'{S}/text-rects.json'))]
_SL = {}
def slender(k, f):
    """줄기 늘리기 — 밑에서 올라가며 가는 줄기만 있는 띠(이삭 · 잎이 시작되기 전)를 세로로 늘려 키를 f배로. 같은 키로 다시 줄이면
    이삭이 작고 가늘어진다(사진이 이삭을 가까이 찍어 이삭이 키의 절반을 차지했다)"""
    if (k, f) in _SL: return _SL[(k, f)]
    a = np.array(SIL[k]) > 127; Hs, Ws = a.shape
    widths = []
    for y in range(Hs - 1, int(Hs * 0.9), -1):
        xs = np.nonzero(a[y])[0]
        if len(xs):
            runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1); widths += [len(r) for r in runs]
    thr = max(3, 3 * float(np.median(widths))) if widths else 4
    yb = Hs - 1
    for y in range(Hs - 1, -1, -1):
        xs = np.nonzero(a[y])[0]
        if len(xs) and max(len(r) for r in np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)) > thr: yb = y; break
    zone = Hs - yb; z = min(8.0, 1 + (f - 1) * Hs / max(zone, 1))
    top = SIL[k].crop((0, 0, Ws, yb)); bot = SIL[k].crop((0, yb, Ws, Hs)).resize((Ws, max(1, round(zone * z))), Image.BILINEAR)
    out = Image.new('L', (Ws, top.height + bot.height), 0); out.paste(top, (0, 0)); out.paste(bot, (0, top.height))
    _SL[(k, f)] = out; return out
def wave(x):
    v = 0.5 * math.sin(x / 900 * 2 * math.pi + 0.7) + 0.3 * math.sin(x / 520 * 2 * math.pi + 2.1) + 0.2 * math.sin(x / 330 * 2 * math.pi + 4.0)
    return (v + 1) / 2
rnd = random.Random(4); knots = [rnd.uniform(-1, 1) for _ in range(W // 10 + 3)]
def grain(x):
    i, f = int(x // 10), (x % 10) / 10; f = f * f * (3 - 2 * f); return knots[i] * (1 - f) + knots[i + 1] * f
def bump(x): return 10 * wave(x) + 1.5 * (grain(x) + 1)
def base():
    im = Image.new('RGB', (W, H), (0, 0, 0)); im.paste(src.crop((0, g, W, H)), (0, 0))
    ImageDraw.Draw(im).polygon([(x, y0 - bump(x)) for x in range(0, W + 1, 2)] + [(W, H), (0, H)], fill=G800)
    return im
def meadow(density=1.6, hmax=75, mix=(1, 1, 1), seed=7, clear=1.0, scale=None, fox=None):
    """density = 100px마다 포기 수 · hmax = 가장 큰 풀의 키(px) · mix = 강아지풀 : 민들레 : 토끼풀 · clear = 글 둘레 여백(글 높이 배)"""
    r = random.Random(seed); im = base(); layer = Image.new('L', (W, H), 0)
    HR = {'fox': (0.65, 1.0), 'dan': (0.7, 1.05), 'clo': (0.35, 0.6)}   # 종마다 키의 범위(가장 큰 풀 대비) — 토끼풀은 낮다
    n = round(density * W / 100); placed = 0; tries = 0
    keys = list(SP); wts = list(mix)
    while placed < n and tries < n * 6:
        tries += 1
        cx = r.uniform(0, W); k_cluster = r.choice([1, 2, 3, 3, 4, 5])
        for _ in range(k_cluster):
            if placed >= n: break
            x = cx + r.gauss(0, 30)
            sp = r.choices(keys, wts)[0]; k = r.choice(SP[sp])
            h = hmax * r.uniform(*HR[sp]) * (scale or {}).get(sp, 1.0); s = SIL[k]; squeeze = 1.0
            if sp == 'fox' and fox:   # 강아지풀 날씬하게 — ('stretch', 키 배수) 또는 ('squeeze', 폭 배수)
                if fox[0] == 'stretch': s = slender(k, fox[1])
                else: squeeze = fox[1]
            w = max(1, round(s.width * h / s.height * squeeze)); hh = max(1, round(h))
            if w > W * 0.25: continue
            box = (x - w / 2, y0 + 4 - hh, x + w / 2, y0 + 4)
            hit = False
            for a, b, c, d in rects:   # 글 둘레(글 높이 × clear)에 걸리면 이 포기는 안 세운다
                m = (d - b) * clear
                if box[0] < c + m and box[2] > a - m and box[1] < d + m and box[3] > b - m: hit = True; break
            if hit: continue
            p = s.resize((w, hh), Image.LANCZOS)
            if r.random() < 0.5: p = p.transpose(Image.FLIP_LEFT_RIGHT)
            layer.paste(255, (round(box[0]), round(box[1])), p)   # 덮어 칠한다(한 색이라 겹쳐도 같다)
            placed += 1
    im.paste(Image.new('RGB', (W, H), G800), (0, 0), layer)
    return im, placed
def strip_sheet(cells, out, strip=330):
    font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 24)
    lab, gap = 44, 14
    sheet = Image.new('RGB', (W, (strip + lab + gap) * len(cells)), (0, 0, 0)); d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(cells):
        y = i * (strip + lab + gap); d.text((6, y + 8), name, font=font, fill=LABEL)
        sheet.paste(im.crop((0, H - strip, W, H)), (0, y + lab)); d.rectangle([0, y + lab, W - 1, y + lab + strip - 1], outline=LINE)
    sheet.save(out); print(out, sheet.size)
if __name__ == '__main__':
    axis = sys.argv[2]
    if axis == 'density':
        cells = []
        for i, dn in enumerate([0.8, 1.6, 3.2, 6.4]):
            im, n = meadow(density=dn)
            cells.append((f'{"①②③④"[i]} 100px마다 {dn}포기 — 벽 전체 {n}포기 (가장 큰 풀 75px · 셋을 같은 비율로)', im))
        strip_sheet(cells, f'{S}/../meadow-density.png')
    if axis == 'clo':   # 디자이너 10-04 "토끼풀 너무 많아" — 토끼풀 몫만 줄인다(민들레 49%)
        kw = dict(density=1.6, fox=('stretch', 2.2), scale={'fox': 0.7, 'dan': 0.49})
        cells = []
        for i, (name, mx) in enumerate([('지금 2 : 1 : 2', (2, 1, 2)), ('2 : 1 : 1 — 토끼풀 절반', (2, 1, 1)),
                                         ('2 : 1 : 0.5 — 토끼풀 4분의 1', (2, 1, 0.5)), ('2 : 1 : 0.25 — 토끼풀 8분의 1(가끔 하나)', (2, 1, 0.25))]):
            im, n = meadow(mix=mx, **kw); cells.append((f'{"①②③④"[i]} 강아지풀 : 민들레 : 토끼풀 = {name}', im))
        strip_sheet(cells, f'{S}/../meadow-clo.png')
    if axis == 'dan':   # 디자이너 10-04: 비율 2:1:2로, 민들레만 지금의 70%(37~55 → 26~39px)
        kw = dict(density=1.6, fox=('stretch', 2.2), mix=(2, 1, 2))
        a, na = meadow(scale={'fox': 0.7, 'dan': 0.7}, **kw)
        b, nb = meadow(scale={'fox': 0.7, 'dan': 0.49}, **kw)
        strip_sheet([(f'지금 — 강아지풀 34~53px · 민들레 37~55px · 토끼풀 26~45px · 2:1:2', a),
                     (f'고친 — 민들레만 70%: 26~39px (강아지풀 · 토끼풀 그대로)', b)], f'{S}/../meadow-dan.png')
    if axis == 'mix':   # 디자이너 10-04: 밀도 1.6 · 강아지풀 · 민들레 70% · 강아지풀 줄기 ×2.2 — 섞는 비율 넷
        kw = dict(density=1.6, scale={'fox': 0.7, 'dan': 0.7}, fox=('stretch', 2.2))
        cells = []
        for i, (name, mx) in enumerate([('1 : 1 : 1 — 고르게', (1, 1, 1)), ('3 : 1 : 1 — 강아지풀 바탕에 민들레 · 토끼풀이 점점이', (3, 1, 1)),
                                         ('2 : 1 : 2 — 강아지풀 · 토끼풀 바탕에 민들레 드문드문', (2, 1, 2)), ('1 : 3 : 1 — 민들레 들판', (1, 3, 1))]):
            im, n = meadow(mix=mx, **kw); cells.append((f'{"①②③④"[i]} 강아지풀 : 민들레 : 토끼풀 = {name}', im))
        strip_sheet(cells, f'{S}/../meadow-mix-b.png')
    if axis == 'fox':   # 디자이너 10-04 "강아지풀이 저 굵기인 게 말이 안 된다" — 키는 그대로(34~53px), 날씬하게 하는 법 넷
        sc = {'fox': 0.7, 'dan': 0.7}
        cells = []
        for i, (name, fx) in enumerate([('지금(70%)', None), ('줄기 늘리기 ×1.6 — 같은 키에서 이삭이 작고 가늘어짐', ('stretch', 1.6)),
                                         ('줄기 늘리기 ×2.2', ('stretch', 2.2)), ('폭만 60% — 이삭 · 줄기가 가늘어지고 길이는 그대로', ('squeeze', 0.6))]):
            im, n = meadow(density=1.6, scale=sc, fox=fx); cells.append((f'{"①②③④"[i]} {name}', im))
        strip_sheet(cells, f'{S}/../meadow-fox.png')
    if axis == 'size1':   # 디자이너 10-04: 밀도 ② · 강아지풀 · 민들레만 지금의 70%
        a, na = meadow(density=1.6)
        b, nb = meadow(density=1.6, scale={'fox': 0.7, 'dan': 0.7})
        strip_sheet([(f'지금 ② — 강아지풀 49~75px · 민들레 53~79px · 토끼풀 26~45px ({na}포기)', a),
                     (f'고친 ② — 강아지풀 · 민들레만 70%: 강아지풀 34~53px · 민들레 37~55px · 토끼풀 그대로 26~45px ({nb}포기)', b)], f'{S}/../meadow-size1.png')
