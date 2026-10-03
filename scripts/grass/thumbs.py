import json, os, sys, time, urllib.request
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]
UA = {'User-Agent': 'megafont-silhouette/0.1 (moomiryu@gmail.com)'}
C = json.load(open(f'{S}/cands.json', encoding='utf-8'))
os.makedirs(f'{S}/th', exist_ok=True)
font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 20)
for sp, rows in C.items():
    for i, r in enumerate(rows):
        r['id'] = f'{sp[0]}{i:03d}'
        p = f'{S}/th/{r["id"]}.jpg'
        if not os.path.exists(p):
            for k in range(3):
                try:
                    data = urllib.request.urlopen(urllib.request.Request(r['thumb'], headers=UA), timeout=60).read(); open(p, 'wb').write(data); break
                except Exception as e: time.sleep(2)
            time.sleep(0.15)
    # 대조표 — 번호는 사진 **안 왼쪽 위**(옆 칸 번호를 잘못 읽지 않게)
    T, cols = 230, 8
    for s in range(0, len(rows), 48):
        part = rows[s:s + 48]
        sheet = Image.new('RGB', (cols * (T + 6), ((len(part) + cols - 1) // cols) * (T + 6)), (40, 40, 40))
        d = ImageDraw.Draw(sheet)
        for j, r in enumerate(part):
            try: im = Image.open(f'{S}/th/{r["id"]}.jpg').convert('RGB')
            except Exception: continue
            im.thumbnail((T, T))
            x, y = (j % cols) * (T + 6), (j // cols) * (T + 6)
            sheet.paste(im, (x + (T - im.width) // 2, y + (T - im.height) // 2))
            d.rectangle([x, y, x + 62, y + 24], fill=(0, 0, 0)); d.text((x + 3, y + 1), r['id'], font=font, fill=(255, 230, 0))
        sheet.save(f'{S}/sheet-{sp}-{s // 48}.jpg', quality=85)
json.dump(C, open(f'{S}/cands.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', {k: len(v) for k, v in C.items()})
