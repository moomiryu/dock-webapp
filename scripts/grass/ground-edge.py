# 땅 윗선 격자 — 두께 3%(32px, 디자이너 10-04) 위에서 윗선 모양 넷. 굴곡은 위로만 솟는다(돌 · 나무 밑동 앞을 조금 덮는다 —
# 풀이 앞이라는 결정과 같은 결). 돌 · 나무가 서는 바닥(물리)은 곧은 그대로라 아래로 파이면 생기는 밑 빈틈이 없다.
import re, sys, math, random
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]
tok = open('src/styles/tokens.css', encoding='utf-8').read()
hexv = lambda n: re.search(r'--%s:\s*(#[0-9a-fA-F]{6})' % n, tok).group(1)
GROUND, LABEL, LINE = hexv('grey-800'), hexv('grey-300'), hexv('grey-700')
src = Image.open(f'{S}/wall-wide-0.png').convert('RGB')
W, H = src.size
g = round(H * 0.03)
base = Image.new('RGB', (W, H), (0, 0, 0)); base.paste(src.crop((0, g, W, H)), (0, 0))
y0 = H - g
def wave(x):   # 길게 오르내리는 굴곡 0~1 — 파장 900 · 520 · 330px를 섞는다
    v = 0.5 * math.sin(x / 900 * 2 * math.pi + 0.7) + 0.3 * math.sin(x / 520 * 2 * math.pi + 2.1) + 0.2 * math.sin(x / 330 * 2 * math.pi + 4.0)
    return (v + 1) / 2
random.seed(4)
knots = [random.uniform(-1, 1) for _ in range(W // 10 + 3)]
def grain(x):  # 잔결 — 10px마다 무작위, 사이를 부드럽게
    i, f = int(x // 10), (x % 10) / 10; f = f * f * (3 - 2 * f)
    return knots[i] * (1 - f) + knots[i + 1] * f
cells = [('① 곧게', lambda x: 0), ('② 아주 완만한 굴곡 — 0~4px', lambda x: 4 * wave(x)),
         ('③ 완만한 굴곡 — 0~10px', lambda x: 10 * wave(x)), ('④ 완만한 굴곡 + 잔결 — 0~10px · 결 ±1.5px', lambda x: 10 * wave(x) + 1.5 * (grain(x) + 1))]
CROP_H, CW = 260, 1100          # 벽 아래 260px, 왼쪽 1100px — 실제 픽셀 크기 그대로
font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 22)
lab, gap = 40, 18
out = Image.new('RGB', (CW, (CROP_H + lab + gap) * len(cells)), (0, 0, 0))
d = ImageDraw.Draw(out)
for i, (name, bump) in enumerate(cells):
    im = base.copy()
    pts = [(x, y0 - bump(x)) for x in range(0, W + 1, 2)] + [(W, H), (0, H)]
    ImageDraw.Draw(im).polygon(pts, fill=GROUND)
    y = i * (CROP_H + lab + gap)
    d.text((4, y + 6), name, font=font, fill=LABEL)
    out.paste(im.crop((0, H - CROP_H, CW, H)), (0, y + lab))
    d.rectangle([0, y + lab, CW - 1, y + lab + CROP_H - 1], outline=LINE)
out.save(f'{S}/ground-grid2.png'); print(out.size)
