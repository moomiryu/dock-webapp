# 사진 → 나무 알파(design/tree-photo/alpha) — 다시 떼는 길. 결과는 임시 폴더에(TREE_OUT 또는 OS 임시 폴더의 megafont-trees/alpha)
#   python scripts/trees/alpha.py [사진 폴더] [이름 …]
# 사진 폴더에 <이름>.jpg(위키미디어에서 받은 원본)가 없으면 sources.json의 제목으로 공용에서 긴 쪽 2400을 받는다.
# 순서(2026-09-30 나무 — scripts/trees/shape.py 머리말):
#   하늘   위 · 옆 가장자리에서 이어진 밝은(또는 푸른) 곳. 사진마다 하늘 밝기가 달라 위 띠의 밝기로 문턱을 잡는다
#   알파   그 자리의 색이 하늘색과 나무색 사이 어디쯤인가(0~1) — 가지 · 틈이 한 톨 단위로 남는다(가까운 결)
#   지평선 h 위는 알파, 아래는 줄기만(GrabCut으로 줄기 띠에서), 땅선 g에서 자른다 — 땅 가까이는 강 건너 숲 · 덤불과 붙어 있어서
#   자른 자리 가로(지평선) · 세로(옆 나무) 칼자국은 그 나무의 결로 들쭉날쭉하게, 줄기는 칼자국 위로 벌어지며 수관에 잇는다
#            (764 · 656은 첫 판 cut='v1' — 줄기 띠만 비키고 가로 칼자국만 결로)
# GrabCut은 OpenCV 난수를 쓴다 — 한 번에 여러 그루를 떼면 순서에 따라 수백 칸(0.1% 아래) 달라질 수 있다. 고른 원본은 alpha/의 PNG다
import cv2, numpy as np, json, os, sys, tempfile, urllib.request, urllib.parse

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'design', 'tree-photo')
# 비율 좌표: h 지평선 · g 땅선 · t 줄기 중심선(위 x, 아래 x) · tw 줄기 띠 반폭 · side 남길 가로 범위 · erase 지울 칸(y0, y1, x0, x1)
CFG = {
    'pine-764':   dict(h=0.66, g=0.85, t=(0.475, 0.47), tw=0.035, cut='v1'),
    'pine-071':   dict(h=0.56, g=0.76, t=(0.52, 0.52), tw=0.05),
    'pine-223':   dict(h=0.70, g=0.745, t=(0.30, 0.30), tw=0.03),
    'pine-656':   dict(h=0.58, g=0.78, t=(0.60, 0.60), tw=0.04, cut='v1'),
    'pine-055':   dict(h=0.585, g=0.64, t=(0.55, 0.545), tw=0.05, side=(0.0, 0.78), erase=[(0.45, 1.0, 0.735, 1.0)]),
    'willow-155': dict(h=0.72, g=0.97, t=(0.505, 0.50), tw=0.05),
    # 버드나무 17은 첫 판(지평선 없이 사진 전체를 하늘 · 나무로)에서 뗐다 — 이 길로 다시 떼면 조금 다를 수 있다
    'willow-017': dict(plain=True, long=2400),
    # 참나무 3(2026-10-04) — 당당한 '무겁게'의 나무. 왼쪽 사람 · 오른쪽 덤불과 지평선 나무는 side로 비킨다
    'oak-3':      dict(h=0.80, g=0.955, t=(0.455, 0.45), tw=0.045, side=(0.08, 0.84)),
}
UA = {'User-Agent': 'megafont-trees/0.1'}


def load(fn, long=2000):
    im = cv2.imread(fn); h, w = im.shape[:2]; s = long / max(h, w)
    return cv2.resize(im, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)


def fetch(title, fn):
    q = urllib.parse.urlencode({'action': 'query', 'titles': title, 'prop': 'imageinfo', 'iiprop': 'url', 'iiurlwidth': '2400', 'format': 'json'})
    j = json.load(urllib.request.urlopen(urllib.request.Request('https://commons.wikimedia.org/w/api.php?' + q, headers=UA), timeout=60))
    ii = next(iter(j['query']['pages'].values()))['imageinfo'][0]
    open(fn, 'wb').write(urllib.request.urlopen(urllib.request.Request(ii.get('thumburl') or ii['url'], headers=UA), timeout=120).read())


def sky_of(bgr, ground=None):
    rgb = bgr[:, :, ::-1].astype(np.float32) / 255; v = rgb.max(-1); mn = rgb.min(-1); s = (v - mn) / np.maximum(v, 1e-3)
    blue = (rgb[..., 2] - rgb[..., 0]) / np.maximum(rgb[..., 2], 1e-3)
    top = v[: max(6, v.shape[0] // 15)]
    bright = max(0.45, float(np.percentile(top, 30)) * 0.8)
    skyish = (((v > bright) & (s < 0.3)) | ((blue > 0.15) & (v > 0.3))).astype(np.uint8)
    if ground is not None: skyish[int(ground * skyish.shape[0]):] = 0
    n, lab = cv2.connectedComponents(skyish, 8)
    edge = set(np.unique(np.r_[lab[0], lab[:, 0], lab[:, -1]]).tolist()) - {0}
    return np.isin(lab, list(edge))


def norm_blur(x, w, s):
    if x.ndim == 3:
        return cv2.GaussianBlur(x * w[..., None], (0, 0), s) / np.maximum(cv2.GaussianBlur(w, (0, 0), s), 1e-4)[..., None]
    return cv2.GaussianBlur(x * w, (0, 0), s) / np.maximum(cv2.GaussianBlur(w, (0, 0), s), 1e-4)


def alpha_of(bgr, ground=0.97, keep=None):
    H, W = bgr.shape[:2]; L = max(H, W)
    sky = sky_of(bgr, ground)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    sky_def = cv2.erode(sky.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    S = norm_blur(lab, sky_def, 0.03 * L)
    d = np.sqrt(((lab - S) ** 2).sum(-1))
    region = (~sky).astype(np.uint8); region[int(ground * H):] = 0
    if keep: region[:, :int(keep[0] * W)] = 0; region[:, int(keep[1] * W):] = 0
    n, lb, st, _ = cv2.connectedComponentsWithStats(region, 8)
    region = (lb == 1 + int(np.argmax(st[1:, 4]))).astype(np.uint8)
    tree_def = ((d > np.percentile(d[region > 0], 60)) & (region > 0)).astype(np.float32)
    T = norm_blur(lab, tree_def, 0.02 * L)
    ST = T - S
    a = np.clip(((lab - S) * ST).sum(-1) / np.maximum((ST ** 2).sum(-1), 1), 0, 1)
    a *= cv2.dilate(region, np.ones((7, 7), np.uint8))
    return a.astype(np.float32)


def grabcut(bgr, mask, it=5):
    bg = np.zeros((1, 65), np.float64); fg = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, None, bg, fg, it, cv2.GC_INIT_WITH_MASK)
    return np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)


def with_trunk(bgr, c):
    """지평선 위는 알파, 아래는 줄기 띠 안에서 GrabCut으로 가른 줄기만"""
    H, W = bgr.shape[:2]; Y = lambda f: int(f * H); X = lambda f: int(f * W)
    a = alpha_of(bgr, ground=c['h'], keep=c.get('side'))
    yh, yg = Y(c['h']), Y(c['g']); xt, xb = c['t']; tw = X(c['tw'])
    cx = lambda y: X(xt + (xb - xt) * (y - yh) / max(1, yg - yh))
    mask = np.full((H, W), cv2.GC_BGD, np.uint8)
    for y in range(yh, yg):
        x = cx(y); sl = mask[y, max(0, x - tw):x + tw]; sl[sl == cv2.GC_BGD] = cv2.GC_PR_BGD
        mask[y, max(0, x - 2):x + 3] = cv2.GC_FGD
    y0 = max(0, yh - Y(0.04))
    sub = grabcut(bgr[y0:yg].copy(), mask[y0:yg].copy())
    low = np.zeros((H, W), np.float32); low[yh:yg] = sub[yh - y0:]
    n, lb, st, _ = cv2.connectedComponentsWithStats((low > 0).astype(np.uint8), 8)
    keepc = np.unique(np.r_[lb[yh, :], lb[yh:yg, :][np.arange(yg - yh), [min(W - 1, cx(y)) for y in range(yh, yg)]]]); keepc = keepc[keepc > 0]
    low = cv2.GaussianBlur(np.isin(lb, keepc).astype(np.float32), (0, 0), 1.0)
    A = a.copy(); A[yh:] = low[yh:]; A[yg:] = 0
    for (e0, e1, f0, f1) in c.get('erase', []): A[Y(e0):Y(e1), X(f0):X(f1)] = 0   # 옆 나무와 가지 사이에 갇힌 흐린 하늘
    return A


def noise1(n, scales, rng, p):
    out = np.zeros(n, np.float32)
    for sig, w in scales:
        z = cv2.GaussianBlur(rng.standard_normal((1, n)).astype(np.float32), (0, 0), sigmaX=max(0.5, sig * n), sigmaY=0.01)[0]
        z = (z - z.min()) / max(1e-6, z.max() - z.min()); out += w * z
    return (out / sum(w for _, w in scales)) ** p


def ragged(A, c, sp, seed):
    """칼자국을 그 나무의 결로 — 소나무는 둥근 덩이 끝, 버드나무는 가는 가닥 끝. 줄기는 칼자국 위로 벌어지며 수관에 잇는다"""
    H, W = A.shape; rng = np.random.default_rng(seed); orig = A.copy()
    sc = [(0.004, 0.35), (0.012, 0.4), (0.03, 0.25)] if sp == 'pine' else [(0.0015, 0.5), (0.006, 0.3), (0.02, 0.2)]
    dep = (0.05 if sp == 'pine' else 0.08) * H
    yh = int(c['h'] * H)
    e = dep * noise1(W, sc, rng, 1.5)
    for x in np.nonzero(orig[yh - 2] > 0.5)[0]: A[int(yh - e[x]):yh, x] = 0
    row = orig[min(H - 1, yh + 3)] > 0.5; x0 = int(c['t'][0] * W); xs = np.nonzero(row)[0]
    if len(xs):
        near = xs[np.argmin(np.abs(xs - x0))]; xl = xr = near
        while xl - 1 >= 0 and row[xl - 1]: xl -= 1
        while xr + 1 < W and row[xr + 1]: xr += 1
        tw = xr - xl + 1; D = int(dep * 1.2)
        for y in range(yh - D, yh):
            f = (yh - y) / D; l = int(xl - f * 0.9 * tw); r = int(xr + f * 0.9 * tw) + 1
            seg = orig[y, max(0, l):r]; A[y, max(0, l):r] = np.maximum(A[y, max(0, l):r], seg)
    for (e0, e1, f0, f1) in c.get('erase', []):
        xc = int(f0 * W) - 1; e3 = dep * noise1(H, sc, rng, 1.5)
        for y in range(int(e0 * H), int(e1 * H)):
            if orig[y, xc] > 0.5: A[y, xc - int(e3[y]):xc + 1] = 0
    if c.get('side'):
        x1 = int(c['side'][1] * W) - 1; x0s = int(c['side'][0] * W); e2 = dep * noise1(H, sc, rng, 1.5)
        for xc, sgn in ((x1, -1), (x0s, 1)):
            if xc <= 0 or xc >= W - 1: continue
            for y in np.nonzero(orig[:, xc] > 0.5)[0]:
                d = int(e2[y])
                if sgn < 0: A[y, xc - d:xc + 1] = 0
                else: A[y, xc:xc + d] = 0
    return A


def ragged_v1(A, c, sp, seed):
    """첫 판 — 가로 칼자국만 결로(줄기 띠 둘레는 비킨다), 칼자국 둘레를 세로로 살짝 뭉갠다"""
    H, W = A.shape; yh = int(c['h'] * H); rng = np.random.default_rng(seed)
    def noise(sig):
        n = cv2.GaussianBlur(rng.standard_normal((1, W)).astype(np.float32), (0, 0), sigmaX=max(0.5, sig * W), sigmaY=0.01)[0]
        n -= n.min(); return n / max(1e-6, n.max())
    e = 0.05 * H * noise(0.010) ** 1.3 if sp == 'pine' else 0.08 * H * (0.55 * noise(0.0025) + 0.45 * noise(0.012)) ** 1.2
    tw = int(c['tw'] * W * 1.3); x0 = int(c['t'][0] * W)
    for x in np.nonzero(A[yh - 2] > 0.5)[0]:
        if abs(x - x0) < tw: continue
        A[int(yh - e[x]):yh, x] = 0
    k = (3, 7) if sp == 'pine' else (1, 3); y0 = max(0, yh - int(0.1 * H))
    A[y0:yh] = cv2.GaussianBlur(A[y0:yh], (k[0] | 1, k[1] | 1), 0)
    return A


def one(tid, photos):
    c = CFG[tid]; fn = os.path.join(photos, f'{tid}.jpg')
    if not os.path.exists(fn):
        src = {s['file']: s for s in json.load(open(os.path.join(ROOT, 'src', 'sources.json'), encoding='utf-8'))['sources']}
        fetch(src[f'{tid}.jpg']['title'], fn)
    bgr = load(fn, c.get('long', 2000))
    if c.get('plain'):
        A = alpha_of(bgr)
    else:
        sp, i = tid.split('-'); A = (ragged_v1 if c.get('cut') == 'v1' else ragged)(with_trunk(bgr, c), c, sp, int(i))
    ys, xs = np.nonzero(A > 0.5); p = 4
    crop = [max(0, int(ys.min()) - p), int(ys.max()) + 1 + p, max(0, int(xs.min()) - p), int(xs.max()) + 1 + p]
    return (np.clip(A, 0, 1) * 255).astype(np.uint8)[crop[0]:crop[1], crop[2]:crop[3]], crop


if __name__ == '__main__':
    out = os.path.join(os.environ.get('TREE_OUT') or os.path.join(tempfile.gettempdir(), 'megafont-trees'), 'alpha'); os.makedirs(out, exist_ok=True)
    photos = sys.argv[1] if len(sys.argv) > 1 else out
    for tid in (sys.argv[2:] or list(CFG)):
        a, crop = one(tid, photos); cv2.imwrite(os.path.join(out, f'{tid}.png'), a); print(tid, crop)
