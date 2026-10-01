# 사진 → 돌 실루엣(design/stone-photo) — 2026-10-01 차분한의 돌을 실사 윤곽으로. 결과는 임시 폴더에(STONE_OUT 또는 OS 임시 폴더의 megafont-stones)
#   python scripts/stones/shape.py [이름 …]
# 고른 원본은 design/stone-photo/mask · shape의 PNG와 stones.json이다. 이 길로 다시 떼면 GrabCut 난수와 원본 크기(고를 때는 긴 쪽 3840에서
# 1600으로 줄였다 — 저장소의 src는 1600으로 줄여 저장)에 따라 몇 칸 달라질 수 있다.
# 순서:
#   떼기    GrabCut(상자 밖 = 배경, 상자 = 아마 돌, 가운데 = 확실한 돌, 사진마다 배경 · 돌 칸을 더 찍는다) → 가장 큰 덩이 · 구멍 메우기
#   밑면    가운데 60% 열들의 '가장 낮은 돌 칸'의 중앙값 = 땅선. 아래는 자르고, 돌 아래쪽 절반까지 내려온 열은 윗선부터 땅선까지 채운다
#           — 그늘 · 풀 · 명암 때문에 밑에 생긴 홈과 양옆 아래의 들린 곳이 바닥에 붙는다(디자이너 — "12번처럼 바닥에 딱 붙게, 빈틈이 없는 게 더 돌 같다")
#   윗선    번잡한 돌만(stone-c): 좁은 홈을 양옆을 잇는 곧은 면으로 메우고 · 좁은 혹을 깎고 · 살짝 뭉갠다(격자 A~D 중 C)
#   결      뭉개기 0.2% → 점 줄이기 0.6%(돌 긴 쪽 기준) — 곧은 면 · 잘게(격자 A~D 중 C, 꼭짓점 20개 남짓). 크게(1.5%)는 기하 돌처럼 보였다
import cv2, numpy as np, json, os, sys, tempfile
from scipy.ndimage import maximum_filter1d as mx, minimum_filter1d as mn, gaussian_filter1d as gs

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'design', 'stone-photo')
OUT = os.environ.get('STONE_OUT') or os.path.join(tempfile.gettempdir(), 'megafont-stones')
LONG = 1600
EDGE = (0.002, 0.006)  # 결: 뭉개기 σ · 점 줄이기 ε(돌 긴 쪽 기준)
# 비율 좌표. box: 상자 x0, y0, x1, y1 · bg / fg: 확실한 배경 / 돌로 찍을 칸 · bg_poly: 배경 다각형 · top: 윗선 걷기(메우기 · 깎기 · 뭉개기, 돌 폭 기준)
CFG = {
    'stone-a': dict(box=(0.04, 0.15, 0.98, 0.90)),
    # 오른쪽 옆 배경이 다시 뗄 때 돌로 붙은 적이 있다(원본 크기 차이) — 오른쪽 아래 옆을 배경으로
    'stone-b': dict(box=(0.05, 0.13, 0.99, 0.92), bg_poly=[[(0.92, 0.55), (1.0, 0.55), (1.0, 1.0), (0.975, 1.0), (0.975, 0.85)]]),
    # 뒤의 산이 돌과 같은 빛이라 왼쪽 산 · 하늘 · 오른쪽 초록 산을 배경으로 찍는다. 하늘 띠를 0.27까지 내렸다가 왼쪽 봉우리가 잘렸다
    'stone-c': dict(box=(0.04, 0.18, 0.97, 0.82),
                    bg=[(0.0, 0.0, 0.09, 0.56), (0.0, 0.0, 1.0, 0.20), (0.93, 0.0, 1.0, 0.53), (0.97, 0.0, 1.0, 1.0)],
                    fg=[(0.15, 0.45, 0.85, 0.78)],
                    bg_poly=[[(0.57, 0.0), (1.0, 0.0), (1.0, 0.58), (0.95, 0.58), (0.92, 0.455), (0.86, 0.455), (0.83, 0.435), (0.80, 0.43),
                              (0.77, 0.40), (0.68, 0.385), (0.65, 0.31), (0.62, 0.29), (0.59, 0.30), (0.57, 0.30)]],
                    top=(0.14, 0.03, 0.004)),  # 디자이너 — 윗선이 번잡하다(돌 위 풀숲 홈 · 계단)
    'stone-d': dict(box=(0.15, 0.13, 0.86, 0.86)),
    # 달(아폴로 17, Tracy's Rock) — 그늘진 오른쪽 면과 땅에 드리운 그림자가 같은 검정이라 바위 오른쪽 끝(0.665) 너머는 배경으로 찍는다.
    # 그 아래 오른쪽 면은 사진에 안 보여 땅선까지 곧게 내렸다(깨진 면). 왼쪽의 우주인도 배경. 작은 삼각형은 두 덩이 사이로 비친 뒤 땅
    'stone-moon': dict(box=(0.15, 0.38, 0.68, 0.86),
                       bg=[(0.665, 0.62, 1.0, 1.0), (0.12, 0.62, 0.162, 0.82), (0.0, 0.0, 1.0, 0.39)],
                       fg=[(0.25, 0.62, 0.40, 0.78), (0.45, 0.48, 0.60, 0.62), (0.36, 0.50, 0.48, 0.70)],
                       bg_poly=[[(0.3072, 0.5487), (0.3072, 0.5153), (0.3236, 0.5153)]]),
}


def load(name):
    im = cv2.imread(os.path.join(ROOT, 'src', name + '.jpg')); h, w = im.shape[:2]; s = LONG / max(h, w)
    return cv2.resize(im, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)


def cut(im, cfg):
    H, W = im.shape[:2]; m = np.zeros((H, W), np.uint8)
    x0, y0, x1, y1 = cfg['box']; X0, Y0, X1, Y1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
    m[Y0:Y1, X0:X1] = cv2.GC_PR_FGD
    cx, cy, hw, hh = (X0 + X1) // 2, (Y0 + Y1) // 2, (X1 - X0) // 5, (Y1 - Y0) // 5
    m[cy - hh:cy + hh, cx - hw:cx + hw] = cv2.GC_FGD
    for (a, b, c, d) in cfg.get('bg', []): m[int(b * H):int(d * H), int(a * W):int(c * W)] = cv2.GC_BGD
    for (a, b, c, d) in cfg.get('fg', []): m[int(b * H):int(d * H), int(a * W):int(c * W)] = cv2.GC_FGD
    for poly in cfg.get('bg_poly', []): cv2.fillPoly(m, [np.array([(int(x * W), int(y * H)) for x, y in poly], np.int32)], cv2.GC_BGD)
    bg = np.zeros((1, 65)); fg = np.zeros((1, 65)); cv2.setRNGSeed(1)
    cv2.grabCut(im, m, None, bg, fg, 8, cv2.GC_INIT_WITH_MASK)
    a = np.isin(m, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)
    k = max(3, int(0.004 * max(H, W)) | 1)
    a = cv2.morphologyEx(a, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
    n, lb, st, _ = cv2.connectedComponentsWithStats(a, 8); a = (lb == 1 + int(np.argmax(st[1:, 4]))).astype(np.uint8)
    ff = np.pad(a, 1).copy(); cv2.floodFill(ff, None, (0, 0), 1)
    return a | (1 - ff[1:-1, 1:-1])


def flat_base(a):
    ys, xs = np.nonzero(a); xl, xr = xs.min(), xs.max(); w = xr - xl
    low = [np.nonzero(a[:, x])[0].max() for x in range(xl + int(0.2 * w), xr - int(0.2 * w)) if a[:, x].any()]
    yb = int(np.median(low)); top = ys.min(); H = yb - top
    b = a.copy(); b[yb + 1:] = 0
    for x in range(xl, xr + 1):
        col = np.nonzero(b[:, x])[0]
        if len(col) and col.max() >= top + 0.5 * H: b[col.min():yb + 1, x] = 1
    return b


def smooth_top(b, w1, w2, s):
    # 윗선을 높이 h(x)로 보고 — 메우기: 양쪽 같은 거리(최대 w1/2)의 두 점을 잇는 곧은 줄 중 가장 높은 것까지 올린다(좁은 홈만 곧은 면으로,
    # 볼록한 등은 그대로. 수평으로 메우면 윗면이 탁자처럼 평평해지고 양 끝이 벽처럼 솟았다) · 깎기: 폭 w2보다 좁은 혹 · 뭉개기: σ
    ys, xs = np.nonzero(b); yb = ys.max(); xl, xr = xs.min(), xs.max()
    h = np.array([yb - np.nonzero(b[:, x])[0].min() + 1 if b[:, x].any() else 0 for x in range(xl, xr + 1)], float); L = len(h)
    if w1:
        D = max(1, int(w1 * L / 2)); p = np.pad(h, D); best = h.copy()
        for d in range(1, D + 1): best = np.maximum(best, (p[D - d:D - d + L] + p[D + d:D + d + L]) / 2)
        h = best
    if w2: k = max(1, int(w2 * L)); h = mx(mn(h, k, mode='nearest'), k, mode='nearest')
    if s: h = gs(h, s * L, mode='nearest')
    out = np.zeros_like(b)
    for i, v in enumerate(h): out[yb - int(round(v)) + 1:yb + 1, xl + i] = 1
    return out


def edge(b, sigma, eps):
    ys, xs = np.nonzero(b); yb = ys.max(); L = max(xs.max() - xs.min(), yb - ys.min())
    a = cv2.GaussianBlur((b > 0).astype(np.float32), (0, 0), sigma * L) if sigma else (b > 0).astype(np.float32)
    a = (a > 0.5).astype(np.uint8); a[yb + 1:] = 0
    for x in np.nonzero(a.any(0))[0]:
        col = np.nonzero(a[:, x])[0]; a[col.min():yb + 1, x] = 1
    cs, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); c = max(cs, key=cv2.contourArea)
    c = cv2.approxPolyDP(c, eps * L, True).reshape(-1, 2)
    out = np.zeros_like(a); cv2.fillPoly(out, [c.reshape(-1, 1, 2)], 1)
    return out, c


def build(name):
    cfg = CFG[name]; im = load(name)
    b = flat_base(cut(im, cfg))
    if 'top' in cfg: b = smooth_top(b, *cfg['top'])
    shape, poly = edge(b, *EDGE)
    return im, b, shape, poly


def record(name, shape, poly):
    ys, xs = np.nonzero(shape); x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    w, h = x1 - x0, y1 - y0
    # 윤곽 점은 돌 상자 안의 비율(0~1, 밑 = 1). 밑면은 y = 1인 곧은 변 하나다
    pts = [[round((x - x0) / w, 4), round((y - y0) / h, 4)] for x, y in poly]
    return dict(name=name, w=w, h=h, aspect=round(w / h, 3), points=pts)


if __name__ == '__main__':
    names = sys.argv[1:] or list(CFG)
    for d in ('mask', 'shape'): os.makedirs(os.path.join(OUT, d), exist_ok=True)
    rec = []
    for n in names:
        im, b, shape, poly = build(n)
        cv2.imwrite(os.path.join(OUT, 'mask', n + '.png'), b * 255); cv2.imwrite(os.path.join(OUT, 'shape', n + '.png'), shape * 255)
        rec.append(record(n, shape, poly)); print(n, '점', len(poly), '가로 ÷ 세로', rec[-1]['aspect'])
    json.dump(dict(note='돌 윤곽(비율, 밑 = 1) — scripts/stones/shape.py', stones=rec), open(os.path.join(OUT, 'stones.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('→', OUT)
