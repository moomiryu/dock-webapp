# 글자 비율 격자 — 새는 지금(글 + 여백을 다 품고 새 전체가 한 칸) 그대로, 글만 제 가운데를 축으로 s배. 넘친 글은 벽 위로.
import json, os, sys
from gridexport2 import place, OUT
sys.stdout.reconfigure(encoding="utf-8")
T = json.load(open(os.path.join(OUT, "textboxes.json"), encoding="utf-8"))
SS = [float(v) for v in sys.argv[1].split(',')] if len(sys.argv) > 1 else [1, 1.3, 1.6, 2]
TAG = sys.argv[2] if len(sys.argv) > 2 else 'ratio'
CLIP = len(sys.argv) > 3
for kind, ids, ref in (("round", ["r1546", "r1127", "r561"], "bird"), ("crow", ["c470", "c513", "c825"], "bat")):
    cells = []
    for ti, id_ in zip([1, 3, 6], ids):
        t = T[ti]; base = place(id_, (t[ref]["tw"], t[ref]["th"]), 1)
        for s in SS:
            d = dict(base); tx = base["text"]; cx, cy = tx["x"] + tx["w"] / 2, tx["y"] + tx["h"] / 2
            d["text"] = {"x": cx - tx["w"] * s / 2, "y": cy - tx["h"] * s / 2, "w": tx["w"] * s, "h": tx["h"] * s}
            d.update({"kind": kind, "tscale": s, "lines": t["lines"], "manner": 0 if kind == "round" else 1})
            cells.append(d)
    heads = [("글 1배 — 지금(새가 다 품음)" if v == 1 else f"글 {v:g}배") + (" · 새 밖은 잘림" if CLIP else "") for v in SS]
    json.dump({"heads": heads, "cells": cells, "pal": {"round": "lime", "crow": "magenta"}, "clip": CLIP}, open(os.path.join(OUT, f"grid-{TAG}-{kind}.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("ok")
