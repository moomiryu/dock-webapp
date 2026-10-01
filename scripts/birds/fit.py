# 새 실루엣에 글 + 여백 네모가 드는 가장 큰 자리(앱의 photoFit와 같은 길 — 긴 쪽 256칸, 한 칸 깎은 안) →
# 새 전체의 긴 쪽(u) · 벽 글자(상한 18.5u 대비) · 넓이 배수. 기하 새 · 박쥐와 같은 글로 견준다.
import json, os, sys
import numpy as np, cv2
sys.stdout.reconfigure(encoding="utf-8")
from paths import ROOT, WORK as OUT, photo, mask
ROUND = "r1546 r1127 r870 r1062 r561 r012 r1148 r254 r764".split()
CROW = "c470 c396 c511 c639 c671 c504 c513 c656 c825 c385 c590 c868".split()
CAP = 18.5; G = 256

def grid(id_, sx=1.0):
    a = cv2.imread(mask("cut2", id_), 0) > 127
    ys, xs = np.nonzero(a); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.uint8)
    h, w = a.shape; w2 = w * sx; s = G / max(w2, h)
    g = cv2.resize(a * 255, (max(1, round(w2 * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA) > 127
    safe = cv2.erode(g.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    out = (~safe).astype(np.int32)
    sat = np.zeros((out.shape[0] + 1, out.shape[1] + 1), np.int64); sat[1:, 1:] = out.cumsum(0).cumsum(1)
    yy, xx = np.nonzero(g)
    return g, sat, (xx.mean(), yy.mean())

def fit(g, sat, cen, asp, shrink=0):
    H, W = g.shape
    def spots(h):
        w = max(1, round(h * asp))
        if w > W or h > H: return None
        tot = sat[h:, w:] - sat[:-h, w:] - sat[h:, :-w] + sat[:-h, :-w]
        return np.argwhere(tot == 0), w
    lo, hi = 0, H + 1
    while hi - lo > 1:
        m = (lo + hi) // 2; r = spots(m)
        if r is not None and len(r[0]): lo = m
        else: hi = m
    if lo < 2: return None
    h = max(2, int(lo * 0.97) - shrink); r = spots(h)
    pts, w = r
    d = (pts[:, 1] + w / 2 - cen[0]) ** 2 + (pts[:, 0] + h / 2 - cen[1]) ** 2
    y, x = pts[np.argmin(d)]
    return x, y, w, h

def measure(id_, tb, sx=1.0, pad=0.7):
    g, sat, cen = grid(id_, sx)
    RW, RH = tb[0] + 2 * pad, tb[1] + 2 * pad
    f = fit(g, sat, cen, RW / RH)
    if not f: return None
    x, y, w, h = f; upp = RH / h
    H, W = g.shape
    long = max(W, H) * upp
    return {"long": long, "wall": min(1, CAP / long), "area": g.sum() * upp * upp / (RW * RH), "box": (x, y, w, h), "upp": upp, "W": W, "H": H}

if __name__ == "__main__":
    T = json.load(open(os.path.join(OUT, "textboxes.json"), encoding="utf-8"))
    rows = []
    for kind, ids, ref in (("둥근 새", ROUND, "bird"), ("까마귀", CROW, "bat")):
        print(f"\n== {kind} — 새 전체 긴 쪽(u) / 벽 글자(18.5u 상한 대비 %) — 글 일곱 개")
        print("      " + "  ".join(f"{len(t['text']):>3}자" for t in T))
        geo = [max(t[ref]["w"], t[ref]["h"]) for t in T]
        print("기하  " + "  ".join(f"{v:5.1f}" for v in geo))
        for id_ in ids:
            m = [measure(id_, (t[ref]["tw"], t[ref]["th"])) for t in T]
            print(f"{id_:5s} " + "  ".join(f"{x['long']:5.1f}" for x in m) + "   | 벽 " + " ".join(f"{100 * x['wall']:3.0f}" for x in m))
