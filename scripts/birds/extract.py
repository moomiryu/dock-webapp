# 새를 떼어 낸다 — 상자(비율) 안에서 GrabCut. 까마귀는 어두운 곳을 '아마 새'로 먼저 찍는다.
# 결과: cut/<id>.png(흑백 판, 긴 쪽 1000) · 대조표(사진 | 한 톤 실루엣).
import json, os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding="utf-8")
from paths import ROOT, WORK as OUT, photo, mask
FONT = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 24)

# (x0, y0, x1, y1) — 사진 폭 · 높이의 비율
BOX = {
    "c470": (0.01, 0.25, 0.93, 0.84), "c396": (0.12, 0.25, 0.93, 0.88), "c494": (0.0, 0.08, 0.92, 1.0),
    "c511": (0.07, 0.06, 0.94, 0.78), "c716": (0.18, 0.18, 0.84, 0.80), "c868": (0.18, 0.16, 0.86, 0.82),
    "c537": (0.10, 0.06, 0.90, 0.90), "c639": (0.06, 0.06, 0.75, 0.87), "c671": (0.10, 0.26, 0.92, 0.82),
    "c504": (0.23, 0.15, 0.92, 0.84), "c488": (0.23, 0.08, 0.64, 0.93), "c590": (0.18, 0.18, 0.94, 0.87),
    "c513": (0.26, 0.18, 0.92, 0.96), "c656": (0.06, 0.10, 0.89, 0.92), "c866": (0.26, 0.10, 0.82, 0.84),
    "c825": (0.10, 0.08, 0.92, 0.94), "c385": (0.10, 0.33, 0.65, 0.80), "c867": (0.18, 0.10, 0.87, 0.87),
    "r012": (0.07, 0.10, 0.78, 0.82), "r037": (0.25, 0.20, 0.64, 0.55), "r1029": (0.03, 0.06, 0.90, 0.90),
    "r561": (0.05, 0.06, 0.72, 0.95), "r255": (0.28, 0.16, 0.80, 0.99), "r256": (0.08, 0.21, 0.50, 0.74),
    "r573": (0.33, 0.26, 0.70, 0.90), "r1102": (0.18, 0.08, 0.82, 0.89), "r1062": (0.18, 0.28, 0.49, 0.95),
    "r870": (0.23, 0.18, 0.84, 0.70), "r1148": (0.21, 0.23, 0.57, 0.77), "r1127": (0.23, 0.23, 0.64, 0.64),
    "r1234": (0.46, 0.04, 0.80, 0.72), "r254": (0.34, 0.26, 0.57, 0.95), "r1546": (0.06, 0.26, 0.84, 0.85),
    "r302": (0.28, 0.16, 0.77, 0.80), "r764": (0.06, 0.16, 0.84, 0.87), "r1467": (0.26, 0.10, 0.98, 0.87),
}
L = 1000

# 손 표시 — fe: 확실한 새(타원 cx, cy, rx, ry) · fl: 확실한 새(선 x0, y0, x1, y1, 굵기) · bl: 확실한 배경(선)
# below: 이 높이 아래는 버림(발 밑 받침) · open: 가는 것(가지 · 다리) 걷기, 몸 크기의 비율
HINT = {
    "r1062": {"fe": [(0.34, 0.52, 0.06, 0.11)], "bl": [(0.0, 0.30, 0.25, 0.53, 0.02), (0.395, 0.69, 0.57, 0.98, 0.03), (0.44, 0.74, 0.49, 0.95, 0.07)], "open": 0.03},
    "r561": {"fe": [(0.52, 0.45, 0.11, 0.14)], "bl": [(0.60, 0.71, 1.0, 0.46, 0.035), (0.16, 0.99, 0.37, 0.88, 0.035)], "open": 0.015},
    "r012": {"fe": [(0.45, 0.50, 0.14, 0.12), (0.66, 0.25, 0.05, 0.05)], "bl": [(0.0, 0.93, 0.8, 0.93, 0.05)]},
    "r1148": {"fe": [(0.40, 0.48, 0.06, 0.10)], "below": 0.71},
    "r254": {"fe": [(0.46, 0.44, 0.06, 0.10)], "fl": [(0.40, 0.66, 0.33, 0.90, 0.012)],
             "bl": [(0.0, 0.66, 0.38, 0.62, 0.02), (0.56, 0.60, 0.86, 0.53, 0.02)], "open": 0.012},
    "r573": {"fe": [(0.50, 0.40, 0.08, 0.11)], "fl": [(0.60, 0.70, 0.63, 0.82, 0.015)],
             "bl": [(0.18, 0.70, 0.43, 0.70, 0.03), (0.66, 0.70, 1.0, 0.67, 0.03)], "open": 0.012},
    "r256": {"fe": [(0.38, 0.41, 0.08, 0.11)], "bl": [(0.08, 0.0, 0.235, 0.39, 0.035), (0.355, 0.645, 0.64, 0.85, 0.04)], "open": 0.03, "below": 0.645},
    "r764": {"fe": [(0.62, 0.55, 0.13, 0.11), (0.78, 0.30, 0.05, 0.06)], "fl": [(0.45, 0.66, 0.12, 0.78, 0.012)], "bl": [(0.10, 0.62, 0.48, 0.45, 0.03), (0.25, 0.30, 0.62, 0.30, 0.03), (0.0, 0.5, 0.2, 0.5, 0.03)], "below": 0.84},
    "r1234": {"fe": [(0.63, 0.40, 0.07, 0.14)], "below": 0.73},
    "c671": {"fl": [(0.74, 0.34, 0.90, 0.35, 0.012)]},
    "c537": {"fl": [(0.12, 0.17, 0.21, 0.19, 0.012)]},
    "c590": {"fl": [(0.22, 0.35, 0.31, 0.34, 0.01)]},
    "c488": {"bl": [(0.53, 0.60, 0.92, 0.57, 0.03), (0.47, 0.71, 0.92, 0.85, 0.03)]},
}

def load(id_):
    g = "crow" if id_[0] == "c" else "round"
    im = cv2.imread(photo(g, id_))
    s = L / max(im.shape[:2])
    return cv2.resize(im, (round(im.shape[1] * s), round(im.shape[0] * s)), interpolation=cv2.INTER_AREA)

def cut(id_, open_frac=0.0):
    im = load(id_); h, w = im.shape[:2]
    x0, y0, x1, y1 = BOX[id_]; X0, Y0, X1, Y1 = int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)
    m = np.full((h, w), cv2.GC_BGD, np.uint8)
    m[Y0:Y1, X0:X1] = cv2.GC_PR_BGD
    if id_[0] == "c":
        lab = cv2.cvtColor(cv2.GaussianBlur(im, (5, 5), 0), cv2.COLOR_BGR2LAB)
        roi = lab[Y0:Y1, X0:X1, 0]
        t = min(70, np.percentile(roi, 25) + 10)
        dark = np.zeros((h, w), bool); dark[Y0:Y1, X0:X1] = roi < t
        n, lb, st, _ = cv2.connectedComponentsWithStats(dark.astype(np.uint8))
        if n > 1:
            big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); m[lb == big] = cv2.GC_PR_FGD
    else:
        cx, cy, ax, ay = (X0 + X1) // 2, (Y0 + Y1) // 2, int((X1 - X0) * 0.28), int((Y1 - Y0) * 0.28)
        e = np.zeros((h, w), np.uint8); cv2.ellipse(e, (cx, cy), (ax, ay), 0, 0, 360, 1, -1)
        m[e > 0] = cv2.GC_PR_FGD
    hn = HINT.get(id_, {})
    for cx, cy, rx, ry in hn.get("fe", []):
        cv2.ellipse(m, (int(cx * w), int(cy * h)), (int(rx * w), int(ry * h)), 0, 0, 360, cv2.GC_FGD, -1)
    for key, val in (("fl", cv2.GC_FGD), ("bl", cv2.GC_BGD)):
        for a0, b0, a1, b1, t in hn.get(key, []):
            cv2.line(m, (int(a0 * w), int(b0 * h)), (int(a1 * w), int(b1 * h)), val, max(2, int(t * w)))
    if "below" in hn: m[int(hn["below"] * h):] = cv2.GC_BGD
    open_frac = hn.get("open", open_frac)
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(im, m, None, bg, fg, 8, cv2.GC_INIT_WITH_MASK)
    a = np.isin(m, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8) * 255
    a = cv2.threshold(cv2.GaussianBlur(a, (0, 0), 1.2), 127, 255, cv2.THRESH_BINARY)[1]
    size = np.sqrt(max(1, (a > 0).sum()))
    if open_frac > 0:
        r = max(1, int(size * open_frac))
        a = cv2.morphologyEx(a, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
    n, lb, st, _ = cv2.connectedComponentsWithStats(a)
    if n > 1:
        a = np.where(lb == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    ff = a.copy(); cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 255)
    a = a | (255 - ff)                                         # 구멍 메우기
    return im, a, (X0, Y0, X1, Y1)

def sheet(rows, fn, cell=300):
    cols = 4
    W = cols * cell * 2; H = ((len(rows) + cols - 1) // cols) * (cell + 32)
    c = Image.new("RGB", (W, H), (255, 255, 255)); d = ImageDraw.Draw(c)
    for i, (id_, im, a, box) in enumerate(rows):
        x, y = (i % cols) * cell * 2, (i // cols) * (cell + 32)
        p = im.copy(); cv2.rectangle(p, box[:2], box[2:], (0, 0, 255), 3)
        pi = Image.fromarray(cv2.cvtColor(p, cv2.COLOR_BGR2RGB)); pi.thumbnail((cell - 6, cell - 6))
        c.paste(pi, (x + 3, y + 3))
        ys, xs = np.nonzero(a); pad = 12
        crop = a[max(0, ys.min() - pad):ys.max() + pad, max(0, xs.min() - pad):xs.max() + pad]
        si = Image.fromarray(255 - crop).convert("RGB"); si.thumbnail((cell - 6, cell - 6))
        c.paste(si, (x + cell + (cell - si.width) // 2, y + (cell - si.height) // 2))
        d.rectangle([x, y + cell, x + 2 * cell - 1, y + cell + 31], fill=(20, 20, 20))
        d.text((x + 8, y + cell + 2), id_, fill=(255, 255, 255), font=FONT)
    c.save(fn, quality=90)

if __name__ == "__main__":
    tag = sys.argv[1]; ids = sys.argv[2].split(",") if len(sys.argv) > 2 else list(BOX)
    op = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    os.makedirs(os.path.join(OUT, "cut"), exist_ok=True)
    rows = []
    for id_ in ids:
        im, a, box = cut(id_, op)
        cv2.imwrite(os.path.join(OUT, "cut", id_ + ".png"), a)
        rows.append((id_, im, a, box))
    for g in ("c", "r"):
        rr = [r for r in rows if r[0][0] == g]
        if rr: sheet(rr, os.path.join(OUT, f"cut-{tag}-{'crow' if g == 'c' else 'round'}.jpg"))
    print("done", len(rows))
