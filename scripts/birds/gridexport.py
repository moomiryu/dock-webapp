# 격자용 — 새 · 글 · 재는 법(그대로 = 새 전체가 칸, 몸통 = 몸통이 칸)마다 앱의 사진 형상과 같은 꼴(u)로 내보낸다.
# 칸 격자로 자리를 찾고, 실제 윤곽으로 글 + 여백 네모의 둘레를 확인해 걸리면 한 칸씩 줄여 다시(앱의 photoFor와 같은 길).
import json, os, sys
import numpy as np, cv2
from fit import grid, fit, OUT, G, ROOT, mask
sys.stdout.reconfigure(encoding="utf-8")
PAD = 0.7
_pr = os.path.join(OUT, "poly-round.json")
POLY = ({**json.load(open(_pr)), **json.load(open(os.path.join(OUT, "poly-crow.json")))} if os.path.exists(_pr) else
        json.load(open(os.path.join(ROOT, "birds.json"), encoding="utf-8"))["outline"])

def place(id_, tb, mode):
    a = cv2.imread(mask("cut2", id_), 0) > 127
    ys, xs = np.nonzero(a); xm, ym, wc, hc = xs.min(), ys.min(), np.ptp(xs) + 1, np.ptp(ys) + 1
    g, sat, cen = grid(id_)
    Hg, Wg = g.shape
    P = np.array(POLY[id_], np.float64)
    P = np.stack([(P[:, 0] - xm) * Wg / wc, (P[:, 1] - ym) * Hg / hc], 1)          # 칸 좌표
    TW, TH = tb; RW, RH = TW + 2 * PAD, TH + 2 * PAD
    cont = P.astype(np.float32).reshape(-1, 1, 2)
    for shrink in range(0, 12):
        f = fit(g, sat, cen, RW / RH, shrink)
        if not f: return None
        x, y, w, h = f; upp = RH / h
        cx, cy = (x + w / 2), (y + h / 2)
        X0, Y0, X1, Y1 = cx - RW / 2 / upp, cy - RH / 2 / upp, cx + RW / 2 / upp, cy + RH / 2 / upp
        ring = [(X0 + (X1 - X0) * t, Y0) for t in np.linspace(0, 1, 21)] + [(X1, Y0 + (Y1 - Y0) * t) for t in np.linspace(0, 1, 21)] + \
               [(X0 + (X1 - X0) * t, Y1) for t in np.linspace(0, 1, 21)] + [(X0, Y0 + (Y1 - Y0) * t) for t in np.linspace(0, 1, 21)]
        miss = sum(cv2.pointPolygonTest(cont, (float(px), float(py)), False) < 0 for px, py in ring)
        if miss == 0: break
    # 상자 — 그대로: 새 전체, 몸통: 몸통 덩이(굵게 연 것) ∪ 글 + 여백
    if mode == "full":
        b0, b1 = P.min(0), P.max(0)
    else:
        L = max(g.shape); r = max(2, round(0.10 * L))
        C = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
        n, lb, st, _ = cv2.connectedComponentsWithStats(C); k = 1 + np.argmax(st[1:, 4]); bx, by, bw, bh = st[k, :4]
        b0 = np.array([min(bx, X0), min(by, Y0)]); b1 = np.array([max(bx + bw, X1), max(by + bh, Y1)])
    pts = ((P - b0) * upp).tolist()
    W, H = (b1 - b0) * upp
    allx = [p[0] for p in pts]
    return {"id": id_, "pts": pts, "w": float(W), "h": float(H), "x0": float(min(allx)), "x1": float(max(allx)),
            "text": {"x": float((X0 - b0[0]) * upp + PAD), "y": float((Y0 - b0[1]) * upp + PAD), "w": TW, "h": TH},
            "miss": int(miss), "whole": [float(v) for v in ((P.max(0) - P.min(0)) * upp)]}

if __name__ == "__main__":
    T = json.load(open(os.path.join(OUT, "textboxes.json"), encoding="utf-8"))
    ROWS = [(1, "r1546", "c470"), (3, "r1127", "c513"), (6, "r561", "c825")]
    cells = []
    for ti, rid, cid in ROWS:
        t = T[ti]
        for kind, id_, ref in (("round", rid, "bird"), ("crow", cid, "bat")):
            for mode in ("full", "body"):
                d = place(id_, (t[ref]["tw"], t[ref]["th"]), mode)
                d.update({"kind": kind, "mode": mode, "lines": t["lines"], "manner": 0 if kind == "round" else 1})
                cells.append(d)
                print(ti, id_, mode, "밖", d["miss"], "상자", round(d["w"], 1), round(d["h"], 1), "새 전체", [round(v, 1) for v in d["whole"]])
    json.dump(cells, open(os.path.join(OUT, "grid-cells.json"), "w", encoding="utf-8"), ensure_ascii=False)
