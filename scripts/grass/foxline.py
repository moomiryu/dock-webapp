import sys, importlib.util
sys.argv = [sys.argv[0], sys.argv[1], 'none']
spec = importlib.util.spec_from_file_location('meadow', sys.argv[0].replace('foxline.py', 'meadow.py')); M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]; Z, HP = 2, 50
font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 24)
opts = [('① 지금', None), ('② 줄기 ×1.6', ('stretch', 1.6)), ('③ 줄기 ×2.2', ('stretch', 2.2)), ('④ 폭 60%', ('squeeze', 0.6))]
rowh = HP * Z + 70; W = 1920
img = Image.new('RGB', (W, 50 + rowh * len(opts)), (0, 0, 0)); d = ImageDraw.Draw(img)
d.text((6, 10), '강아지풀 아홉 포기를 같은 키 50px로 — 2배로 키워 봄 (오른쪽 끝 둘은 비교용 민들레 · 토끼풀, 같은 크기)', font=font, fill=M.LABEL)
for i, (name, fx) in enumerate(opts):
    y = 50 + i * rowh; d.text((6, y + 4), name, font=font, fill=M.LABEL); gy = y + 40 + HP * Z
    d.rectangle([0, gy, W, gy + 18], fill=M.G800); x = 200
    for k in M.SP['fox'] + ['d070', 'c074']:
        s = M.SIL[k]; sq = 1.0
        if k.startswith('f') and fx:
            if fx[0] == 'stretch': s = M.slender(k, fx[1])
            else: sq = fx[1]
        hh = HP if k.startswith('f') else (round(HP * 0.85) if k.startswith('d') else round(HP * 0.7))
        w = max(1, round(s.width * hh / s.height * sq))
        p = s.resize((w, hh), Image.LANCZOS).resize((w * Z, hh * Z), Image.NEAREST)
        img.paste(Image.new('RGB', p.size, M.G800), (x, gy - hh * Z + 4), p); x += w * Z + 30
img.save(f'{S}/../meadow-foxline.png'); print(img.size)
base = Image.open(f'{S}/../meadow-fox.png'); o = Image.new('RGB', (W, base.height + img.height + 20), (0, 0, 0)); o.paste(base, (0, 0)); o.paste(img, (0, base.height + 20)); o.save(f'{S}/../meadow-fox-all.png'); print(o.size)
