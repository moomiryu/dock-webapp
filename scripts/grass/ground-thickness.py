# 땅 띠 두께 격자 — 지금 벽(넓은 장면) 한 장을 땅 두께만큼 위로 올리고, 밑을 --grey-800 한 면으로 채운다.
# 바닥선이 올라가면 바닥에 선 것(돌 · 나무)이 모두 같이 올라간다 — 그것을 그대로 흉내 낸다.
import re, sys
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]
tok = open('src/styles/tokens.css', encoding='utf-8').read()
hexv = lambda n: re.search(r'--%s:\s*(#[0-9a-fA-F]{6})' % n, tok).group(1)
GROUND = hexv('grey-800'); LABEL = hexv('grey-300'); LINE = hexv('grey-700')
src = Image.open(f'{S}/wall-wide-0.png').convert('RGB')
W, H = src.size
font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 22)
small = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 18)
cells = [(0, '지금 — 땅 없음'), (3, '3% · 32px · 실제 4cm'), (5, '5% · 54px · 실제 7cm'),
         (7, '7% · 76px · 실제 10cm'), (9, '9% · 97px · 실제 13cm — 돌 키쯤'), (12, '12% · 130px · 실제 17cm — 돌보다 두껍게')]
cw, ch, lab, gap = W // 2, H // 2, 44, 16
out = Image.new('RGB', (cw * 2 + gap, (ch + lab) * 3 + gap * 2), (0, 0, 0))
d = ImageDraw.Draw(out)
for i, (pct, name) in enumerate(cells):
    g = round(H * pct / 100)
    im = Image.new('RGB', (W, H), (0, 0, 0))
    im.paste(src.crop((0, g, W, H)), (0, 0))          # 위 g만큼 잘라 내고 올린다
    if g: ImageDraw.Draw(im).rectangle([0, H - g, W, H], fill=GROUND)
    x, y = (i % 2) * (cw + gap), (i // 2) * (ch + lab + gap)
    d.text((x + 4, y + 8), f'{"①②③④⑤⑥"[i]} {name}', font=font, fill=LABEL)
    out.paste(im.resize((cw, ch), Image.LANCZOS), (x, y + lab))
    d.rectangle([x, y + lab, x + cw - 1, y + lab + ch - 1], outline=LINE)
out.save(f'{S}/ground-grid1.png')
print(out.size, GROUND)
