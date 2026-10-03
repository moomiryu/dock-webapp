# 이미 지은 실루엣(sil/*.npy)으로 판 — 사진 · 실루엣(크게) · 벽 크기(땅 32px 위 키 60px · 90px)
import numpy as np, sys, re
from PIL import Image, ImageDraw, ImageFont
S, out = sys.argv[1], sys.argv[2]; items = [a.split('=') for a in sys.argv[3:]]
tok = open('src/styles/tokens.css', encoding='utf-8').read()
hexv = lambda n: re.search(r'--%s:\s*(#[0-9a-fA-F]{6})' % n, tok).group(1)
G800 = tuple(int(hexv('grey-800')[i:i + 2], 16) for i in (1, 3, 5)); LABEL = hexv('grey-300')
font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 17); small = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 14)
CW, PH, SH, WH = 200, 130, 340, 150
sheet = Image.new('RGB', (len(items) * (CW + 10) + 10, 30 + PH + SH + WH + 60), (0, 0, 0)); d = ImageDraw.Draw(sheet)
for i, (k, name) in enumerate(items):
    x = 10 + i * (CW + 10); sil = np.load(f'{S}/sil/{k}.npy')
    ph = Image.open(f'{S}/mask/{k}-work.jpg').convert('RGB'); ph.thumbnail((CW, PH)); sheet.paste(ph, (x + (CW - ph.width) // 2, 30))
    a = Image.fromarray((sil * 255).astype(np.uint8)); f = min(CW / a.width, SH / a.height)
    a = a.resize((max(1, int(a.width * f)), max(1, int(a.height * f))), Image.LANCZOS)
    sheet.paste(Image.new('RGB', a.size, G800), (x + (CW - a.width) // 2, 30 + PH + 8 + SH - a.height), a)
    y0 = 30 + PH + SH + 20; gy = y0 + WH - 32
    d.rectangle([x, gy, x + CW - 1, y0 + WH - 1], fill=G800)
    for hh, off in ((60, -45), (90, 45)):
        b = Image.fromarray((sil * 255).astype(np.uint8)); f2 = hh / b.height
        b = b.resize((max(1, int(b.width * f2)), hh), Image.LANCZOS)
        sheet.paste(Image.new('RGB', b.size, G800), (x + CW // 2 + off - b.width // 2, gy - hh + 6), b)
    d.text((x, 4), f'{k}  {name}', font=font, fill=LABEL)
d.text((10, 30 + PH + SH + WH + 28), '위: 사진 · 가운데: 한 색 실루엣 · 아래: 벽 실제 크기 — 땅 32px 위에 키 60px(왼) · 90px(오른)', font=small, fill=LABEL)
sheet.save(out); print(sheet.size)
