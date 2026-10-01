# 떼어 낸 판 → 윤곽(살짝 뭉개기 · 가장 큰 덩이 · 점 줄이기) → 한 톤 실루엣. 사진과 나란히 대조표.
import json, os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding="utf-8")
from paths import ROOT, WORK as OUT, photo, mask
F = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 22)
KO = {"Passer montanus": "참새", "Aegithalos caudatus": "오목눈이", "Parus major": "박새", "Cyanistes caeruleus": "푸른박새",
      "Erithacus rubecula": "유럽울새", "Pyrrhula pyrrhula": "멋쟁이새", "Corvus corone": "송장까마귀",
      "Corvus frugilegus": "떼까마귀", "Corvus brachyrhynchos": "아메리카까마귀", "Corvus macrorhynchos": "큰부리까마귀"}
SETS = {
    "round": "r1546 r1127 r870 r1062 r561 r012 r1148 r254 r764",
    "crow": "c470 c396 c511 c639 c671 c504 c513 c656 c825 c385 c590 c868",
}

def outline(a, sig=0.004):
    ys, xs = np.nonzero(a); Lb = max(np.ptp(xs), np.ptp(ys))
    s = max(0.8, sig * Lb)
    b = cv2.GaussianBlur(a.astype(np.float32) / 255, (0, 0), s) > 0.5
    cs, _ = cv2.findContours(b.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    return cv2.approxPolyDP(c, 0.0015 * Lb, True)[:, 0, :]

def draw(poly, size, ink=(0, 0, 0), bg=(255, 255, 255), pad=0.06):
    x0, y0 = poly.min(0); x1, y1 = poly.max(0); w, h = x1 - x0, y1 - y0
    k = size * (1 - 2 * pad) / max(w, h)
    im = Image.new("RGB", (size, size), bg); d = ImageDraw.Draw(im)
    ox, oy = (size - w * k) / 2 - x0 * k, (size - h * k) / 2 - y0 * k
    d.polygon([(float(x * k + ox), float(y * k + oy)) for x, y in poly], fill=ink)
    return im

if __name__ == "__main__":
    group = sys.argv[1]; tag = sys.argv[2] if len(sys.argv) > 2 else "v1"
    SRC = sys.argv[3] if len(sys.argv) > 3 else "cut"
    mp = os.path.join(OUT, group + ".json")
    meta = ({it["id"]: it for it in json.load(open(mp, encoding="utf-8"))} if os.path.exists(mp) else
            {s["file"][:-4]: s for s in json.load(open(os.path.join(ROOT, "src", "sources.json"), encoding="utf-8"))["sources"]})
    ids = SETS[group].split(); cols, P, S = 4, 200, 380
    W = cols * (P + S); H = 3 * (S + 36)
    sheet = Image.new("RGB", (W, H), (255, 255, 255)); d = ImageDraw.Draw(sheet)
    polys = {}
    for i, id_ in enumerate(ids):
        a = cv2.imread(mask(SRC, id_), 0)
        poly = outline(a); polys[id_] = poly.tolist()
        x, y = (i % cols) * (P + S), (i // cols) * (S + 36)
        ph = Image.open(photo(group, id_)).convert("RGB"); ph.thumbnail((P - 10, S - 10))
        sheet.paste(ph, (x + 5, y + (S - ph.height) // 2))
        sheet.paste(draw(poly, S), (x + P, y))
        d.rectangle([x, y + S, x + P + S - 1, y + S + 35], fill=(20, 20, 20))
        d.text((x + 8, y + S + 3), f"{i + 1:02d}  {id_}  {KO.get(meta[id_]['species'], '')}", fill=(255, 255, 255), font=F)
    for k in range(1, cols):
        d.line([k * (P + S), 0, k * (P + S), H], fill=(200, 200, 200), width=2)
    fn = os.path.join(OUT, f"silhouette-{group}-{tag}.png"); sheet.save(fn)
    json.dump(polys, open(os.path.join(OUT, f"poly-{group}.json"), "w"))
    print(fn)
