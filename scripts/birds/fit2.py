# 견주기 — 그대로 · 몸통으로 재기(꼬리 · 머리 · 부리를 크기에서 뺀다) · 늘이기(가로 0.8~1.25배 중 가장 짧은 것) · 둘 다
import json, sys, numpy as np, cv2
from fit import *
def core_box(id_, sx, upp_g):
    g, sat, cen = grid(id_, sx)
    L = max(g.shape); r = max(2, round(0.10 * L))
    C = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*r+1, 2*r+1)))
    n, lb, st, _ = cv2.connectedComponentsWithStats(C)
    k = 1 + np.argmax(st[1:, 4]); x, y, w, h = st[k, :4]
    return x, y, w, h
def body_long(id_, tb, sx=1.0):
    m = measure(id_, tb, sx)
    if not m: return None, None
    cx, cy, cw, ch = core_box(id_, sx, m["upp"])
    x, y, w, h = m["box"]
    x0, y0, x1, y1 = min(cx, x), min(cy, y), max(cx + cw, x + w), max(cy + ch, y + h)
    return m["long"], max(x1 - x0, y1 - y0) * m["upp"]
T = json.load(open("textboxes.json", encoding="utf-8"))
SX = [0.8, 0.9, 1.0, 1.1, 1.25]
for kind, ids, ref in (("둥근 새", ROUND, "bird"), ("까마귀", CROW, "bat")):
    res = {k: [] for k in ("그대로", "몸통", "늘이기", "둘 다")}
    for id_ in ids:
        for t in T:
            tb = (t[ref]["tw"], t[ref]["th"])
            full, body = body_long(id_, tb)
            st = [body_long(id_, tb, s) for s in SX]
            res["그대로"].append(min(1, CAP / full)); res["몸통"].append(min(1, CAP / body))
            res["늘이기"].append(min(1, CAP / min(a for a, b in st))); res["둘 다"].append(min(1, CAP / min(b for a, b in st)))
    print(f"\n== {kind} — 벽 글자(상한 대비 %), 글 일곱 개 × {len(ids)}장")
    n = len(T)
    for k, v in res.items():
        v = np.array(v).reshape(len(ids), n) * 100
        print(f"  {k:4s} 줄 수별 가운데 " + " ".join(f"{np.median(v[:, j]):4.0f}" for j in range(n)) + f"   | 가장 작을 때 {v.min():3.0f}")
