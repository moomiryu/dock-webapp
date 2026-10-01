# 넘치기 격자 — 줄 끝(좌우)만 윤곽을 넘는다. 새가 품는 네모 = (줄 길이 ÷ k) × (글 높이 + 위아래 0.2칸). k = 1은 지금(사방 여백 0.7).
# 새 전체가 한 칸(그대로). 글은 품는 네모의 가운데에.
import json, os, sys
import numpy as np, cv2
from fit import grid, fit, OUT, mask
from gridexport import POLY, PAD
sys.stdout.reconfigure(encoding="utf-8")
GAP = 0.2

def place(id_, tb, k):
    a = cv2.imread(mask("cut2", id_), 0) > 127
    ys, xs = np.nonzero(a); xm, ym, wc, hc = xs.min(), ys.min(), np.ptp(xs) + 1, np.ptp(ys) + 1
    g, sat, cen = grid(id_); Hg, Wg = g.shape
    P = np.array(POLY[id_], np.float64); P = np.stack([(P[:, 0] - xm) * Wg / wc, (P[:, 1] - ym) * Hg / hc], 1)
    cont = P.astype(np.float32).reshape(-1, 1, 2)
    TW, TH = tb
    IW, IH = (TW + 2 * PAD, TH + 2 * PAD) if k == 1 else (TW / k, TH + 2 * GAP)
    for shrink in range(12):
        x, y, w, h = fit(g, sat, cen, IW / IH, shrink); upp = IH / h
        cx, cy = x + w / 2, y + h / 2
        X0, Y0, X1, Y1 = cx - IW / 2 / upp, cy - IH / 2 / upp, cx + IW / 2 / upp, cy + IH / 2 / upp
        ring = [(X0 + (X1 - X0) * t, Y0) for t in np.linspace(0, 1, 21)] + [(X1, Y0 + (Y1 - Y0) * t) for t in np.linspace(0, 1, 21)] + \
               [(X0 + (X1 - X0) * t, Y1) for t in np.linspace(0, 1, 21)] + [(X0, Y0 + (Y1 - Y0) * t) for t in np.linspace(0, 1, 21)]
        miss = sum(cv2.pointPolygonTest(cont, (float(px), float(py)), False) < 0 for px, py in ring)
        if miss == 0: break
    b0, b1 = P.min(0), P.max(0)
    pts = ((P - b0) * upp).tolist(); W, H = (b1 - b0) * upp; allx = [p[0] for p in pts]
    tx = (cx - b0[0]) * upp - TW / 2; ty = (cy - b0[1]) * upp - TH / 2
    return {"id": id_, "pts": pts, "w": float(W), "h": float(H), "x0": float(min(allx)), "x1": float(max(allx)),
            "text": {"x": float(tx), "y": float(ty), "w": TW, "h": TH}, "miss": int(miss), "whole": [float(W), float(H)]}

if __name__ == "__main__":
    T = json.load(open(os.path.join(OUT, "textboxes.json"), encoding="utf-8"))
    KS = [1, 1.25, 1.5, 2]
    for kind, ids, ref in (("round", ["r1546", "r1127", "r561"], "bird"), ("crow", ["c470", "c513", "c825"], "bat")):
        cells = []
        for ti, id_ in zip([1, 3, 6], ids):
            t = T[ti]
            for k in KS:
                d = place(id_, (t[ref]["tw"], t[ref]["th"]), k)
                d.update({"kind": kind, "k": k, "lines": t["lines"], "manner": 0 if kind == "round" else 1})
                cells.append(d)
                print(kind, ti, id_, k, "밖", d["miss"], "새", [round(v, 1) for v in d["whole"]])
        heads = ["지금 — 글 + 여백을 다 품음", "넘침 1.25배 — 줄의 80%만 품음", "넘침 1.5배 — 줄의 67%만 품음", "넘침 2배 — 줄의 절반만 품음"]
        json.dump({"heads": heads, "cells": cells}, open(os.path.join(OUT, f"grid-over-{kind}.json"), "w", encoding="utf-8"), ensure_ascii=False)
