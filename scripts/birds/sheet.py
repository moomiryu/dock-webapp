# 받은 목록의 작은 사진을 내려받고, 배경이 단순한 순으로 번호표를 붙인 대조표를 만든다.
import json, os, sys, time, urllib.request, concurrent.futures as cf
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

from paths import ROOT, WORK as OUT, photo, mask
UA = {"User-Agent": "megafont-photo-silhouette/0.1 (moomiryu@gmail.com)"}
found = json.load(open(os.path.join(OUT, "found.json"), encoding="utf-8"))
FONT = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 22)

def get(item, d):
    fn = os.path.join(d, item["id"] + ".jpg")
    if os.path.exists(fn): return fn
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(item["thumb"], headers=UA), timeout=60) as r:
                open(fn, "wb").write(r.read()); return fn
        except Exception:
            time.sleep(2 + i * 2)
    return None

def plain(fn):
    # 가장자리 띠(8%)의 결이 얼마나 고른가 — 작을수록 하늘 · 흐린 배경
    im = cv2.imread(fn)
    if im is None: return 1e9
    im = cv2.GaussianBlur(cv2.resize(im, (240, int(240 * im.shape[0] / im.shape[1]))), (5, 5), 0)
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    h, w = lab.shape[:2]; b = max(4, int(0.08 * min(h, w)))
    edge = np.concatenate([lab[:b].reshape(-1, 3), lab[-b:].reshape(-1, 3), lab[:, :b].reshape(-1, 3), lab[:, -b:].reshape(-1, 3)])
    gx = cv2.Sobel(lab[..., 0], cv2.CV_32F, 1, 0); gy = cv2.Sobel(lab[..., 0], cv2.CV_32F, 0, 1)
    g = np.hypot(gx, gy)
    ge = np.concatenate([g[:b].ravel(), g[-b:].ravel(), g[:, :b].ravel(), g[:, -b:].ravel()])
    return float(edge.std(0).mean() + 0.5 * ge.mean())

def sheet(items, fn, cols=10, cell=240):
    rows = (len(items) + cols - 1) // cols
    W, H = cols * cell, rows * (cell + 30)
    canvas = Image.new("RGB", (W, H), (255, 255, 255)); d = ImageDraw.Draw(canvas)
    for i, it in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * (cell + 30)
        im = Image.open(it["file"]).convert("RGB"); im.thumbnail((cell - 8, cell - 8))
        canvas.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
        d.rectangle([x, y + cell, x + cell - 1, y + cell + 29], fill=(20, 20, 20))
        d.text((x + 8, y + cell + 2), f'{it["id"]}  {it["species"].split()[1][:10]}', fill=(255, 255, 255), font=FONT)
    canvas.save(fn, quality=88)

if __name__ == "__main__":
    group = sys.argv[1]; top = int(sys.argv[2]) if len(sys.argv) > 2 else 120
    d = os.path.join(OUT, "thumbs", group); os.makedirs(d, exist_ok=True)
    items = found[group]
    for i, it in enumerate(items): it["id"] = f"{'r' if group == 'round' else 'c'}{i:03d}"
    with cf.ThreadPoolExecutor(4) as ex:
        files = list(ex.map(lambda it: get(it, d), items))
    for it, f in zip(items, files): it["file"] = f
    items = [it for it in items if it["file"]]
    for it in items: it["plain"] = plain(it["file"])
    items.sort(key=lambda it: it["plain"])
    json.dump(items, open(os.path.join(OUT, f"{group}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    per = 60
    for k in range(0, min(top, len(items)), per):
        sheet(items[k:k + per], os.path.join(OUT, f"sheet-{group}-{k // per + 1}.jpg"))
    print(group, len(items), "sheets", (min(top, len(items)) + per - 1) // per)
