# 고른 후보를 긴 쪽 1600px로 받고, 10% 눈금을 얹은 대조표를 만든다(떼어 낼 상자를 읽으려고).
import json, os, sys, time, urllib.request
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding="utf-8")
from paths import ROOT, WORK as OUT, photo, mask
UA = {"User-Agent": "megafont-photo-silhouette/0.1 (moomiryu@gmail.com)"}
FONT = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 26)
PICK = {
    "crow": "c470 c396 c494 c511 c716 c868 c537 c639 c671 c504 c488 c590 c513 c656 c866 c825 c385 c867",
    "round": "r012 r037 r1029 r561 r883 r255 r256 r573 r1102 r1411 r1062 r870 r1148 r1127 r1234 r254 r1546 r302 r057 r815 r1467 r764",
}

def url1600(it):
    w, h = it["size"]; L = max(w, h)
    if L <= 1600: return it["url"]
    tw = round(1600 * w / L)
    return it["thumb"].replace("/480px-", f"/{tw}px-")

def get(it, d):
    fn = os.path.join(d, it["id"] + ".jpg")
    if os.path.exists(fn): return fn
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url1600(it), headers=UA), timeout=90) as r:
                data = r.read()
            im = Image.open(__import__("io").BytesIO(data)).convert("RGB")
            im.thumbnail((1600, 1600)); im.save(fn, quality=94); return fn
        except Exception as e:
            print("retry", it["id"], e); time.sleep(3 + 3 * i)

def grid_sheet(files, fn, cols=5, cell=480):
    rows = (len(files) + cols - 1) // cols
    c = Image.new("RGB", (cols * cell, rows * (cell + 34)), (255, 255, 255)); d = ImageDraw.Draw(c)
    for i, (id_, f) in enumerate(files):
        im = Image.open(f); im.thumbnail((cell, cell))
        x, y = (i % cols) * cell, (i // cols) * (cell + 34)
        c.paste(im, (x, y)); g = ImageDraw.Draw(c)
        for k in range(1, 10):
            col = (255, 0, 0) if k == 5 else (255, 255, 0)
            g.line([x + im.width * k / 10, y, x + im.width * k / 10, y + im.height], fill=col, width=1)
            g.line([x, y + im.height * k / 10, x + im.width, y + im.height * k / 10], fill=col, width=1)
        d.rectangle([x, y + cell, x + cell - 1, y + cell + 33], fill=(20, 20, 20))
        d.text((x + 8, y + cell + 2), id_, fill=(255, 255, 255), font=FONT)
    c.save(fn, quality=88)

if __name__ == "__main__":
    for g, ids in PICK.items():
        items = {it["id"]: it for it in json.load(open(os.path.join(OUT, g + ".json"), encoding="utf-8"))}
        d = os.path.join(OUT, "big", g); os.makedirs(d, exist_ok=True)
        files = []
        for id_ in ids.split():
            f = get(items[id_], d)
            if f: files.append((id_, f))
            time.sleep(0.3)
        for k in range(0, len(files), 10):
            grid_sheet(files[k:k + 10], os.path.join(OUT, f"grid-{g}-{k // 10 + 1}.jpg"))
        print(g, len(files))
