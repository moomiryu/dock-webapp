# 머이브리지(1887) 말을 떼어 낸다 — 단색 벽 앞이라 밝기로 먼저 가르고(어두운 말 · 밝은 벽, 또는 그 반대) GrabCut으로 다듬는다.
# HINT 좌표는 긴 쪽 1600px 판 기준. box 밖은 배경(바닥 띠는 box 밑변으로 자른다), bg = 말이 아닌 물건(양동이 · 통),
# line = 밝기로는 안 잡히는 말(그늘진 먼 쪽 다리).
# 결과는 extract.py와 같은 자리: 작업 폴더 cut/<id>.png · check/<id>.jpg
import os, sys, numpy as np, cv2
from paths import WORK

HINT = {
    # 노새 루스 — 뒷발로 걷어찬다(높이 찬 순간)
    "m167": {"box": (190, 180, 1460, 1046), "dark": True},
    # 노새 루스 — 뒷발을 내리는 순간
    "m168": {"box": (180, 200, 1260, 1046), "dark": True},
    # 흰 말 이글 — 양동이를 물고 걷는다(양동이는 뺀다)
    "m057": {"box": (40, 20, 1600, 1075), "dark": False, "bg": [(1390, 400, 1600, 620)],
             "line": [[(488, 617), (602, 877), (700, 1070)], [(263, 840), (240, 1000), (230, 1070)]]},
    # 흰 말 이글 — 앞발로 통을 굴린다(통은 뺀다)
    "m055": {"box": (200, 10, 1520, 1112), "dark": False, "bg": [(1170, 960, 1470, 1200)]},
}

def cut(id_):
    im = cv2.imread(os.path.join(WORK, "big", id_ + ".jpg"))
    H = HINT[id_]; h, w = im.shape[:2]; k = w / 1600
    x0, y0, x1, y1 = [int(v * k) for v in H["box"]]
    g = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    inner = g[y0:y1, x0:x1]
    t, _ = cv2.threshold(inner, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    thr = np.zeros((h, w), np.uint8)
    thr[y0:y1, x0:x1] = ((inner < t) if H["dark"] else (inner > t)).astype(np.uint8) * 255
    for L in H.get("line", []):
        cv2.polylines(thr, [np.array([(int(x * k), int(y * k)) for x, y in L], np.int32)], False, 255, max(6, int(22 * k)))
    for bx in H.get("bg", []):
        a0, b0, a1, b1 = [int(v * k) for v in bx]; thr[b0:b1, a0:a1] = 0
    # 밝기로 가른 판 → GrabCut 출발점: 깊이 안쪽은 확실한 말, 가장자리는 아마
    m = np.full((h, w), cv2.GC_BGD, np.uint8)
    m[y0:y1, x0:x1] = cv2.GC_PR_BGD
    m[thr > 0] = cv2.GC_PR_FGD
    core = cv2.erode(thr, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(9 * k) | 1, int(9 * k) | 1)))
    m[core > 0] = cv2.GC_FGD
    for bx in H.get("bg", []):
        a0, b0, a1, b1 = [int(v * k) for v in bx]; m[b0:b1, a0:a1] = cv2.GC_BGD
    bgm, fgm = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(im, m, None, bgm, fgm, 6, cv2.GC_INIT_WITH_MASK)
    a = np.where((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    a = cv2.morphologyEx(a, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(a)
    if n > 1: a = np.where(lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])), 255, 0).astype(np.uint8)
    ff = a.copy(); cv2.floodFill(ff, None, (0, 0), 255); a = a | cv2.bitwise_not(ff)
    for d in ("cut", "check"): os.makedirs(os.path.join(WORK, d), exist_ok=True)
    cv2.imwrite(os.path.join(WORK, "cut", id_ + ".png"), a)
    ov = im.copy(); cs, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(ov, cs, -1, (255, 0, 255), 2)
    cv2.imwrite(os.path.join(WORK, "check", id_ + ".jpg"), ov, [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(id_, "말 넓이", round(float((a > 0).mean()), 3), "문턱", int(t))

for id_ in (sys.argv[1:] or HINT):
    cut(id_)
