import sys
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]; out = sys.argv[2]; ids = sys.argv[3:]
font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 16); big = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 22)
T = 420; cells = []
for k in ids:
    im = Image.open(f'{S}/mask/{k}-work.jpg').convert('RGB'); im.thumbnail((T, T))
    d = ImageDraw.Draw(im)
    for i in range(1, 10):
        x, y = im.width * i / 10, im.height * i / 10
        d.line([(x, 0), (x, im.height)], fill=(255, 0, 255) if i == 5 else (255, 255, 255), width=1)
        d.line([(0, y), (im.width, y)], fill=(255, 0, 255) if i == 5 else (255, 255, 255), width=1)
        d.text((x + 2, 2), str(i), font=font, fill=(255, 255, 0)); d.text((2, y + 1), str(i), font=font, fill=(0, 255, 255))
    d.rectangle([im.width - 64, im.height - 26, im.width, im.height], fill=(0, 0, 0)); d.text((im.width - 60, im.height - 25), k, font=big, fill=(255, 230, 0))
    cells.append(im)
cols = 4; W = cols * (T + 8); rows = (len(cells) + cols - 1) // cols
sheet = Image.new('RGB', (W, rows * (T + 8)), (30, 30, 30))
for i, c in enumerate(cells): sheet.paste(c, ((i % cols) * (T + 8), (i // cols) * (T + 8)))
sheet.save(out, quality=88); print(sheet.size)
