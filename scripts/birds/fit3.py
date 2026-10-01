# 넘치기 — 줄 끝(좌우)이 윤곽을 N칸 넘고, 위아래 둘레 여백은 0.2칸(나무와 같다). 새 전체가 한 칸(그대로)일 때 벽 글자.
import json, numpy as np
from fit import *
def meas(id_, tb, N, gap):
    TW, TH = tb
    iw, ih = max(0.6, TW - 2 * N), TH + 2 * gap
    g, sat, cen = grid(id_)
    f = fit(g, sat, cen, iw / ih)
    x, y, w, h = f; upp = ih / h
    return max(g.shape) * upp
T = json.load(open("textboxes.json", encoding="utf-8"))
for kind, ids, ref in (("둥근 새", ROUND, "bird"), ("까마귀", CROW, "bat")):
    print(f"\n== {kind} — 벽 글자(줄지 않은 크기 대비 %) 줄 수별 가운데 · 글 일곱 개")
    print("              " + " ".join(f"{len(t['text']):>4}자" for t in T))
    for lab, N, gap in (("지금(여백 0.7)", None, 0.7), ("넘침 0", 0, 0.2), ("넘침 0.3칸", 0.3, 0.2), ("넘침 0.6칸", 0.6, 0.2), ("넘침 1칸", 1.0, 0.2), ("넘침 1.5칸", 1.5, 0.2)):
        v = []
        for id_ in ids:
            row = []
            for t in T:
                tb = (t[ref]["tw"], t[ref]["th"])
                L = meas(id_, tb, -0.7 if N is None else N, gap)
                row.append(min(1, CAP / L) * 100)
            v.append(row)
        v = np.array(v)
        print(f"  {lab:12s}" + " ".join(f"{np.median(v[:, j]):5.0f}" for j in range(len(T))) + f"  | 가장 작을 때 {v.min():3.0f}")
