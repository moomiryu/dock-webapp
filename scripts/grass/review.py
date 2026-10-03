import cv2, numpy as np, json, sys
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]; ids = sys.argv[3:]; out = sys.argv[2]
info = json.load(open(f'{S}/mask/info.json'))
font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 18)
Hh, cols = 230, 4
cells = []
for k in ids:
    im = Image.open(f'{S}/mask/{k}-work.jpg').convert('RGB'); m = Image.open(f'{S}/mask/{k}.png').convert('L')
    f = Hh / im.height; im = im.resize((round(im.width * f), Hh)); m = m.resize(im.size)
    pair = Image.new('RGB', (im.width * 2 + 4, Hh), (60, 60, 60)); pair.paste(im, (0, 0)); pair.paste(Image.merge('RGB', [m, m, m]), (im.width + 4, 0))
    d = ImageDraw.Draw(pair); d.rectangle([0, 0, 120, 22], fill=(0, 0, 0)); d.text((3, 1), f"{k} {info.get(k, {}).get('method', '')}", font=font, fill=(255, 230, 0))
    cells.append(pair)
rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
W = max(sum(c.width + 10 for c in r) for r in rows)
sheet = Image.new('RGB', (W, len(rows) * (Hh + 10)), (30, 30, 30))
for j, r in enumerate(rows):
    x = 0
    for c in r: sheet.paste(c, (x, j * (Hh + 10))); x += c.width + 10
sheet.save(out, quality=85); print(sheet.size)
