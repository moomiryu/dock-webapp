# 받은 목록의 작은 사진을 내려받고, 배경이 단순한 순으로 번호표를 붙인 대조표를 만든다(새 때의 sheet.py를 말에 맞게).
# 옆모습은 가로로 길다 — 가로가 세로의 1.1배 넘는 것만, 누끼 질을 위해 긴 쪽 1200px 넘는 것만(머이브리지는 둘 다 안 거른다).
import json, os, sys, time, urllib.request, concurrent.futures as cf
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from paths import WORK as OUT

UA = {"User-Agent": "megafont-photo-silhouette/0.1 (design study)"}
found = json.load(open(os.path.join(OUT, "found.json"), encoding="utf-8"))
FONT = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 20)
PREFIX = {"stand": "s", "pony": "p", "muybridge": "m", "move": "v", "cute": "k"}

def get(item, d):
    fn = os.path.join(d, item["id"] + ".jpg")
    if os.path.exists(fn): return fn
    for i in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(item["thumb"], headers=UA), timeout=60) as r:
                open(fn, "wb").write(r.read()); time.sleep(0.3); return fn
        except Exception as e:
            time.sleep(15 if "429" in str(e) else 2 + i * 2)
    return None

def plain(fn):
    # 가장자리 띠(8%)의 결이 얼마나 고른가 — 작을수록 단순한 배경
    im = cv2.imread(fn)
    if im is None: return 1e9
    im = cv2.GaussianBlur(cv2.resize(im, (240, int(240 * im.shape[0] / im.shape[1]))), (5, 5), 0)
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    h, w = lab.shape[:2]; b = max(4, int(0.08 * min(h, w)))
    edge = np.concatenate([lab[:b].reshape(-1, 3), lab[-b:].reshape(-1, 3), lab[:, :b].reshape(-1, 3), lab[:, -b:].reshape(-1, 3)])
    g = np.hypot(cv2.Sobel(lab[..., 0], cv2.CV_32F, 1, 0), cv2.Sobel(lab[..., 0], cv2.CV_32F, 0, 1))
    ge = np.concatenate([g[:b].ravel(), g[-b:].ravel(), g[:, :b].ravel(), g[:, -b:].ravel()])
    return float(edge.std(0).mean() + 0.5 * ge.mean())

def sheet(items, fn, cols=10, cell=220):
    rows = (len(items) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * cell, rows * (cell + 28)), (255, 255, 255)); d = ImageDraw.Draw(canvas)
    for i, it in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * (cell + 28)
        im = Image.open(it["file"]).convert("RGB"); im.thumbnail((cell - 8, cell - 8))
        canvas.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
        d.rectangle([x, y + cell, x + cell - 1, y + cell + 27], fill=(20, 20, 20))
        d.text((x + 8, y + cell + 2), f'{it["id"]}  {it["category"].split()[-1][:12]}', fill=(255, 255, 255), font=FONT)
    canvas.save(fn, quality=88)

if __name__ == "__main__":
    group = sys.argv[1]; top = int(sys.argv[2]) if len(sys.argv) > 2 else 120
    d = os.path.join(OUT, "thumbs", group); os.makedirs(d, exist_ok=True)
    items = found[group]
    for i, it in enumerate(items): it["id"] = f"{PREFIX[group]}{i:03d}"
    if group != "muybridge":
        items = [it for it in items if it["size"][0] and it["size"][0] > 1.1 * it["size"][1] and max(it["size"]) >= 1200]
    with cf.ThreadPoolExecutor(3) as ex:
        files = list(ex.map(lambda it: get(it, d), items))
    for it, f in zip(items, files): it["file"] = f
    items = [it for it in items if it["file"]]
    for it in items: it["plain"] = plain(it["file"])
    items.sort(key=lambda it: it["plain"])
    json.dump(items, open(os.path.join(OUT, f"{group}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    per = 60
    for k in range(0, min(top, len(items)), per):
        out = os.path.join(OUT, f"sheet-{group}-{k // per}.jpg")
        sheet(items[k:k + per], out)
        print(out)
    print(group, len(items), "장")
