# 다리 걷기 — 가는 것(열기로 사라지는 것) 가운데 몸 아래쪽에 세로로 붙은 덩이만 지운다. 꼬리 · 부리는 남긴다.
# 확인판: 회색 = 남은 몸, 빨강 = 지운 것. 결과 판은 cut2/<id>.png.
import os, sys, json
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding="utf-8")
from paths import ROOT, WORK as OUT, photo, mask
F = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 22)
ROUND = "r1546 r1127 r870 r1062 r561 r012 r1148 r254 r764".split()
CROW = "c470 c396 c511 c639 c671 c504 c513 c656 c825 c385 c590 c868".split()
# 덩이마다 따로 정할 것: keep — 남길 덩이의 대략 자리(판 비율 x, y), drop — 지울 덩이 자리
EXC = {"r1062": {"keep": [(0.25, 0.85)]}}

def disk(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))

def legless(id_, rf=0.045, rc=0.10):
    a = cv2.imread(mask("cut", id_), 0) > 127
    ys, xs = np.nonzero(a); Lb = max(np.ptp(xs), np.ptp(ys))
    b = (cv2.GaussianBlur(a.astype(np.float32), (0, 0), max(0.8, 0.004 * Lb)) > 0.5).astype(np.uint8)
    r = max(2, round(rf * Lb))
    O = cv2.morphologyEx(b, cv2.MORPH_OPEN, disk(r))
    n, lb, st, _ = cv2.connectedComponentsWithStats(O)
    if n > 1: O = (lb == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    C = cv2.morphologyEx(b, cv2.MORPH_OPEN, disk(max(3, round(rc * Lb))))   # 몸통 덩이
    n2, lb2, st2, _ = cv2.connectedComponentsWithStats(C)
    if n2 > 1: C = (lb2 == 1 + np.argmax(st2[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    cyx = np.nonzero(C); cy = cyx[0].mean(); cx0, cx1 = cyx[1].min(), cyx[1].max()
    thin = (b & (1 - O)).astype(np.uint8)
    n, lb, st, cen = cv2.connectedComponentsWithStats(thin)
    keep = O.copy(); gone = np.zeros_like(O)
    h_, w_ = a.shape; ex = EXC.get(id_, {})
    for k in range(1, n):
        x, y, w, h, area = st[k]
        if area < 4: continue
        comp = (lb == k).astype(np.uint8)
        cx, cyk = cen[k]
        leg = cx0 <= cx <= cx1 and cyk > cy and h < 0.3 * Lb
        for px, py in ex.get("keep", []):
            if abs(cx / w_ - px) < 0.05 and abs(cyk / h_ - py) < 0.05: leg = False
        for px, py in ex.get("drop", []):
            if abs(cx / w_ - px) < 0.05 and abs(cyk / h_ - py) < 0.05: leg = True
        (gone if leg else keep)[comp > 0] = 1
    # 그루터기 — 한 번 더 굵게 열어, 몸통 밑에 남은 짧은 덩이를 지운다
    O2 = cv2.morphologyEx(keep, cv2.MORPH_OPEN, disk(max(3, round(0.07 * Lb))))
    stub = (keep & (1 - O2)).astype(np.uint8)
    n, lb, st, cen = cv2.connectedComponentsWithStats(stub)
    for k in range(1, n):
        x, y, w, h, area = st[k]; cx, cyk = cen[k]
        if area < 4: continue
        if any(abs(cx / w_ - px) < 0.05 and abs(cyk / h_ - py) < 0.05 for px, py in ex.get("keep", [])): continue
        if cx0 <= cx <= cx1 and cyk > cy and h < 0.15 * Lb and w < 0.15 * Lb and y + h >= np.nonzero(C)[0].max() - 0.02 * Lb:
            keep[lb == k] = 0; gone[lb == k] = 1
    # 다리 뿌리의 작은 혹을 둥글린다
    keep = (cv2.GaussianBlur(keep.astype(np.float32), (0, 0), max(1.0, 0.006 * Lb)) > 0.5).astype(np.uint8)
    n, lb, st, _ = cv2.connectedComponentsWithStats(keep)
    if n > 1: keep = (lb == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    return b, keep, gone

def tile(b, keep, gone, S=300):
    ys, xs = np.nonzero(b); p = 10
    sl = (slice(max(0, ys.min() - p), ys.max() + p), slice(max(0, xs.min() - p), xs.max() + p))
    img = np.full(b[sl].shape + (3,), 255, np.uint8)
    img[gone[sl] > 0] = (230, 40, 40); img[keep[sl] > 0] = (0, 0, 0)
    t = Image.fromarray(img); t.thumbnail((S, S)); c = Image.new("RGB", (S, S), "white")
    c.paste(t, ((S - t.width) // 2, (S - t.height) // 2)); return c

if __name__ == "__main__":
    tag = sys.argv[1]
    os.makedirs(os.path.join(OUT, "cut2"), exist_ok=True)
    ids = ROUND + CROW; cols, S = 7, 300
    sheet = Image.new("RGB", (cols * S, ((len(ids) + cols - 1) // cols) * (S + 30)), "white"); d = ImageDraw.Draw(sheet)
    for i, id_ in enumerate(ids):
        b, keep, gone = legless(id_)
        cv2.imwrite(os.path.join(OUT, "cut2", id_ + ".png"), keep * 255)
        x, y = (i % cols) * S, (i // cols) * (S + 30)
        sheet.paste(tile(b, keep, gone), (x, y))
        d.rectangle([x, y + S, x + S - 1, y + S + 29], fill=(20, 20, 20)); d.text((x + 6, y + S + 2), id_, fill="white", font=F)
    sheet.save(os.path.join(OUT, f"legs-{tag}.png")); print("ok")
