import cv2, numpy as np, sys
S = sys.argv[1]
# d069 — 위 절반의 어두운 덩이 중 가장 큰 것(머리 + 줄기 윗부분)
im = cv2.imread(f'{S}/mask/d069-work.jpg'); H, W = im.shape[:2]
L = cv2.cvtColor(im, cv2.COLOR_BGR2LAB)[..., 0]
fg = (L < 70).astype(np.uint8); fg[int(H * 0.5):] = 0
n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8)
best = max(range(1, n), key=lambda i: st[i][4]); cv2.imwrite(f'{S}/mask/d069.png', ((lab == best) * 255).astype(np.uint8))
# 강아지풀 f059 · f061 — 가장 큰 덩이만(배경 잔가지 · 얼룩 걷기)
for k in ['f059', 'f061', 'f057']:
    m = (cv2.imread(f'{S}/mask/{k}.png', 0) > 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    best = max(range(1, n), key=lambda i: st[i][4]); cv2.imwrite(f'{S}/mask/{k}.png', ((lab == best) * 255).astype(np.uint8))
print('ok')
