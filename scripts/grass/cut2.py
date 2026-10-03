# 민들레 · 토끼풀 — 사진마다 머리(타원) · 줄기(꺾은선)를 찍어 주고 GrabCut. 머리 안쪽 · 줄기 선은 '확실한 대상', 바깥은 '아마 배경'
import cv2, numpy as np, sys, json
S = sys.argv[1]
H_ = {  # 머리 [x0,y0,x1,y1] · 줄기 점들 (모두 사진 폭 · 높이의 비율)
  'd030': ([0.05, 0.25, 1.0, 0.66], [(0.50, 0.63), (0.47, 0.75), (0.42, 0.88), (0.37, 1.0)]),
  'd035': ([0.145, 0.475, 0.255, 0.585], [(0.200, 0.58), (0.198, 0.75), (0.195, 0.95)]),
  'd070': ([0.17, 0.08, 0.63, 0.62], [(0.385, 0.62), (0.38, 0.80), (0.375, 1.0)]),
  'd076': ([0.34, 0.22, 0.68, 0.62], [(0.545, 0.62), (0.56, 0.80), (0.58, 1.0)]),
  'd082': ([0.47, 0.08, 1.0, 0.78], [(0.68, 0.77), (0.64, 0.88), (0.60, 1.0)]),
  'c015': ([0.25, 0.22, 0.80, 0.55], [(0.55, 0.52), (0.56, 0.75), (0.57, 1.0)]),
  'c054': ([0.35, 0.22, 0.73, 0.57], [(0.50, 0.55), (0.48, 0.75), (0.45, 0.97)]),
  'c073': ([0.15, 0.18, 0.73, 0.72], [(0.42, 0.70), (0.42, 0.85), (0.42, 1.0)]),
  'c074': ([0.20, 0.13, 0.78, 0.62], [(0.45, 0.60), (0.41, 0.80), (0.36, 1.0)]),
  'c090': ([0.18, 0.05, 0.65, 0.45], [(0.45, 0.40), (0.445, 0.70), (0.44, 0.95)]),
}
info = {}
for k, (hd, stem) in H_.items():
    im = cv2.imread(f'{S}/mask/{k}-work.jpg'); H, W = im.shape[:2]
    P = lambda p: (int(p[0] * W), int(p[1] * H))
    x0, y0, x1, y1 = hd[0] * W, hd[1] * H, hd[2] * W, hd[3] * H
    cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
    mask = np.full((H, W), cv2.GC_BGD, np.uint8)
    roi = np.zeros((H, W), np.uint8)
    cv2.ellipse(roi, (int(cx), int(cy)), (int(rx * 1.25), int(ry * 1.25)), 0, 0, 360, 1, -1)
    cv2.polylines(roi, [np.array([P(p) for p in stem])], False, 1, max(6, int(W * 0.06)))
    mask[roi > 0] = cv2.GC_PR_BGD
    cv2.ellipse(mask, (int(cx), int(cy)), (int(rx), int(ry)), 0, 0, 360, cv2.GC_PR_FGD, -1)
    cv2.polylines(mask, [np.array([P(p) for p in stem])], False, cv2.GC_PR_FGD, max(3, int(W * 0.02)))
    cv2.ellipse(mask, (int(cx), int(cy)), (int(rx * 0.55), int(ry * 0.55)), 0, 0, 360, cv2.GC_FGD, -1)
    cv2.polylines(mask, [np.array([P(p) for p in stem])], False, cv2.GC_FGD, max(2, int(W * 0.006)))
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(im, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    fg = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8)
    seed = lab[int(cy), int(cx)]
    fg = (lab == seed) if seed else fg.astype(bool)
    cv2.imwrite(f'{S}/mask/{k}.png', (fg * 255).astype(np.uint8)); info[k] = round(float(fg.mean()), 3)
# 민들레 d044 — 밝은 판에서 머리 + 줄기 덩이 하나만
for k, (px, py) in {'d044': (0.35, 0.47)}.items():
    m = cv2.imread(f'{S}/mask/{k}.png', 0) > 0; n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    H, W = m.shape; fg = lab == lab[int(py * H), int(px * W)]; cv2.imwrite(f'{S}/mask/{k}.png', (fg * 255).astype(np.uint8)); info[k] = round(float(fg.mean()), 3)
# 민들레 d069 — 노을 앞 검은 실루엣: 어두운 곳, 위 절반(아래는 숲과 붙는다), 머리에 이어진 덩이
im = cv2.imread(f'{S}/mask/d069-work.jpg'); H, W = im.shape[:2]
L = cv2.cvtColor(im, cv2.COLOR_BGR2LAB)[..., 0]
fg = (L < 70).astype(np.uint8); fg[int(H * 0.5):] = 0
n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8); fg = lab == lab[int(0.15 * H), int(0.30 * W)]
cv2.imwrite(f'{S}/mask/d069.png', (fg * 255).astype(np.uint8)); info['d069'] = round(float(fg.mean()), 3)
print(info)
