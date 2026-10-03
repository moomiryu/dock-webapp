# 풀 사진에서 대상 떼기 — 배경 종류마다 다른 길(하늘 · 밝은 대상 · 초점)
import cv2, numpy as np, os, sys, json
S = sys.argv[1]; os.makedirs(f'{S}/mask', exist_ok=True)
METHOD = {}
for k in 'f020 f021 f022 f023 f036 f037 f038 f039 f043 f044 f045 d060 d062 d076 d069 c052 c053 c054 c058 c073 c074 c077'.split(): METHOD[k] = 'sky'
for k in 'f059 f061 d044 d037 d068'.split(): METHOD[k] = 'bright'
for k in 'f057 f058 d030 d035 d070 d082 c015 c088 c089 c090'.split(): METHOD[k] = 'focus'
only = sys.argv[2:] or list(METHOD)
def work(k):
    im = cv2.imread(f'{S}/src/{k}.jpg'); h, w = im.shape[:2]; f = 1000 / max(h, w)
    return cv2.resize(im, (round(w * f), round(h * f)), interpolation=cv2.INTER_AREA)
def keep_big(m, min_frac=0.0015, touch_bottom=False):
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    out = np.zeros_like(m, bool); H, W = m.shape
    for i in range(1, n):
        x, y, ww, hh, a = st[i]
        if a < min_frac * H * W: continue
        if touch_bottom and y + hh < H * 0.97: continue
        out |= lab == i
    return out
def sky_cut(im):
    H, W = im.shape[:2]
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    # 하늘 후보: 밝고(구름 · 흐린 하늘) 또는 푸른(b가 낮다) — 위 70%에서만 모델을 맞춘다
    cand = ((L > 150) & (np.abs(A - 128) < 12)) | ((B < 122) & (L > 90))
    cand[int(H * 0.7):] = False
    yy, xx = np.mgrid[0:H, 0:W]; ys = yy[cand] / H; xs_ = xx[cand] / W
    X = np.stack([np.ones_like(ys), xs_, ys, xs_ * ys, xs_ ** 2, ys ** 2], 1)
    Xa = np.stack([np.ones(H * W), (xx / W).ravel(), (yy / H).ravel(), (xx / W * yy / H).ravel(), (xx / W).ravel() ** 2, (yy / H).ravel() ** 2], 1)
    fit = np.zeros_like(lab)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(X, lab[..., c][cand], rcond=None)
        fit[..., c] = (Xa @ coef).reshape(H, W)
    d = np.sqrt(((lab - fit) ** 2).sum(-1))
    fg = d > 22
    fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)).astype(bool)
    # 땅선 — 위에서 내려오며 대상이 줄의 55%를 넘는 첫 줄(들판 · 나무 줄). 그 아래는 버리고 위만 쓴다
    cov = fg.mean(1); hz = H
    for y in range(int(H * 0.15), H):
        if cov[y:y + 6].mean() > 0.55: hz = y; break
    fg[max(0, hz - 2):] = False
    return keep_big(fg, 0.0008), hz
def bright_cut(im):
    L = cv2.cvtColor(im, cv2.COLOR_BGR2LAB)[..., 0]
    t, _ = cv2.threshold(cv2.GaussianBlur(L, (3, 3), 0), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    fg = L > max(t, 70)
    fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)).astype(bool)
    return keep_big(fg, 0.002), im.shape[0]
def focus_cut(im):
    H, W = im.shape[:2]
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    lap = np.abs(cv2.Laplacian(g, cv2.CV_32F, ksize=3))
    sharp = cv2.GaussianBlur(lap, (0, 0), 6)
    t = np.percentile(sharp, 80)
    mask = np.full((H, W), cv2.GC_PR_BGD, np.uint8)
    mask[sharp > t] = cv2.GC_PR_FGD
    mask[sharp > np.percentile(sharp, 95)] = cv2.GC_FGD
    border = 6
    lowb = sharp < np.percentile(sharp, 40)
    mask[lowb] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(im, mask, None, bgd, fgd, 4, cv2.GC_INIT_WITH_MASK)
    fg = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)
    fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    return keep_big(fg, 0.004), H
info = {}
for k in only:
    im = work(k)
    fg, hz = {'sky': sky_cut, 'bright': bright_cut, 'focus': focus_cut}[METHOD[k]](im)
    cv2.imwrite(f'{S}/mask/{k}.png', (fg * 255).astype(np.uint8)); cv2.imwrite(f'{S}/mask/{k}-work.jpg', im)
    info[k] = {'method': METHOD[k], 'hz': int(hz), 'fg': round(float(fg.mean()), 3)}
    print(k, info[k])
json.dump(info, open(f'{S}/mask/info.json', 'w'), indent=1)
