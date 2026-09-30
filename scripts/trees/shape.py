# 나무 한 그루 = 사진에서 뗀 알파(design/tree-photo/alpha) → 벽 크기의 실루엣 + 덩이 밑 그늘(빗금 자리)
# 2026-09-30 디자이너가 격자로 고른 규칙(design/landscape-tree-photo-*.png · design/tree-photo/trees.json):
#   가까운 결  알파를 벽 크기로 줄여 σ 0.9px로 뭉갠 뒤 0.5에서 자른다(가지 · 틈이 그대로 무늬)
#   속 메우기  윤곽 안에 갇힌 빈 곳을 '중간 틈까지'(넓이 0.4% 아래 + 1px 닫기) — 소나무 656만 '큰 틈까지'(3% · 2px)
#   버드나무  잎 성긴 사진의 수관을 가닥(벽 1~2px) 단위로 키의 22%까지 늘어뜨린다. 줄기 가까이는 짧게(커튼이 열려 기둥이 보인다)
#   그늘      덩이 밑선을 따라 키의 7% — 세로로 두꺼운 덩이에만(땅까지 이어진 줄기엔 안 건다), 그 아래 이어진 가닥 · 잎 끝까지
# 결과는 임시 폴더에(TREE_OUT 또는 OS 임시 폴더의 megafont-trees) — 고른 격자를 덮어쓰지 않게
import cv2, numpy as np, json, os, sys, tempfile

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'design', 'tree-photo')
S = 3   # 버드나무는 벽 크기의 3배에서 늘어뜨리고 줄인다(1px 가닥이 뭉개지지 않게)


def load_alpha(tid):
    return cv2.imread(os.path.join(ROOT, 'alpha', f'{tid}.png'), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255


def at(a, Hd, sig=0.9):
    """가까운 결 — 알파를 키 Hd로 줄여 뭉개고 0.5에서 자른다. 떨어진 부스러기(큰 덩이의 1% 아래)는 버린다"""
    s = Hd / a.shape[0]
    a = cv2.resize(a, (max(1, round(a.shape[1] * s)), Hd), interpolation=cv2.INTER_AREA)
    if sig > 0: a = cv2.GaussianBlur(a, (0, 0), sig)
    m = (a > 0.5).astype(np.uint8)
    n, lb, st, _ = cv2.connectedComponentsWithStats(m, 8)
    big = st[1:, 4].max(); keep = [k for k in range(1, n) if st[k, 4] >= 0.01 * big]
    return np.isin(lb, keep).astype(np.uint8)


def fill_holes(m, frac, r=0):
    """속 메우기 — r px 닫은 뒤, 가장자리에 안 닿은 빈 곳 중 넓이가 frac × 칠 넓이 아래인 것을 메운다"""
    mm = m.copy()
    if r: mm = cv2.morphologyEx(mm, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2))
    n, lab, st, _ = cv2.connectedComponentsWithStats((1 - mm).astype(np.uint8), 4)
    small = np.zeros(n, bool); small[1:] = st[1:, 4] < frac * m.sum()
    small[np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])] = False
    return (mm | small[lab]).astype(np.uint8)


def drape(m, seed, s, Lmax=0.22, near=0.22, w=(1, 2), jitter=(0.35, 1.0), clump=5):
    """버드나무 — 수관을 가닥 단위로 아래로 끌어내린다. 땅에 닿는 열(줄기)은 그대로, 줄기 가까이는 짧게"""
    H, W = m.shape; rng = np.random.default_rng(seed)
    ground = m[H - 3:].any(0)
    cols = np.nonzero(ground)[0]; xt = cols.mean() if len(cols) else W / 2
    top = np.nonzero(m.any(1))[0].min(); Ht = H - top
    env = cv2.GaussianBlur(rng.random((1, W)).astype(np.float32), (0, 0), sigmaX=clump * s, sigmaY=0.01)[0]
    env = (env - env.min()) / max(1e-6, env.max() - env.min())
    L = np.zeros(W, np.float32); x = 0
    while x < W:
        ww = int(rng.integers(w[0] * s, w[1] * s + 1))
        near_f = np.clip(abs(x - xt) / W / near, 0, 1) ** 1.5
        L[x:x + ww] = Lmax * Ht * near_f * rng.uniform(*jitter) * (0.5 + 0.5 * env[x])
        x += ww + int(rng.integers(0, s + 1))
    L[ground] = 0
    run = np.full(W, 1e9, np.float32); out = m.copy()
    for y in range(H):
        run = np.where(m[y] > 0, 0, run + 1)
        out[y] |= ((run <= L) & (run > 0) & (run < 1e8)).astype(np.uint8) & (y > top)
    return out


def pads_of(m, pad=0.012, hole=0.07):
    H, W = m.shape
    p = (cv2.GaussianBlur(m.astype(np.float32), (0, 0), pad * H) > 0.5).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats((1 - p).astype(np.uint8), 4)
    small = np.zeros(n, bool); small[1:] = st[1:, 4] < (hole * H) ** 2
    small[np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])] = False
    return (p | small[lab]).astype(np.uint8)


def rim(m, d=0.07, kspan=1.6, sx=0.016, sy=0.006):
    """덩이 밑 그늘 — 뭉갠 덩이 판에서 세로 줄마다 밑선 위 d. 두께가 d의 1.6배 아래인 줄(가지 · 줄기)은 서서히 뺀다. 사진 밑(땅)은 밑선이 아니다"""
    H, W = m.shape; pads = pads_of(m)
    up = np.zeros((H, W), np.float32); dn = np.zeros((H, W), np.float32)
    c = np.zeros(W, np.float32)
    for y in range(H): c = (c + 1) * pads[y]; up[y] = c
    c = np.full(W, 1e4, np.float32)
    for y in range(H - 1, -1, -1): c = (c + 1) * pads[y]; dn[y] = c
    dd = d * H
    gate = np.clip((up + dn - kspan * dd) / (0.6 * dd), 0, 1)
    s = ((pads > 0) & (dn <= dd)).astype(np.float32) * gate
    s = cv2.GaussianBlur(s, (0, 0), sigmaX=sx * H, sigmaY=sy * H) > 0.5
    return (s & (m > 0)).astype(np.uint8)


def to_edge(m, sh, cap=0.3):
    """그늘을 실루엣 끝까지 — 그늘 아래로 끊기지 않고 이어진 칠(가닥 · 잎 끝)도 그늘. 땅에 닿는 열은 그대로"""
    H, W = m.shape; out = sh.copy(); carry = np.zeros(W, np.int32); K = int(cap * H)
    for y in range(H):
        on = sh[y] > 0
        carry = np.where(on, K, np.where(m[y] > 0, carry - 1, 0))
        out[y] |= ((carry > 0) & (m[y] > 0) & ~on).astype(np.uint8)
    ground = m[H - 3:].any(0); out[:, ground] = sh[:, ground]
    return out


def tree(t, Hd=480):
    """trees.json의 한 항목 → (칠, 그늘) 벽 크기 판"""
    a = load_alpha(t['alpha'])
    f = t.get('fill', {'frac': 0.004, 'r': 1})
    if 'drape' in t:
        dp = t['drape']; Hw = Hd * S
        m = fill_holes(at(a, Hw, 0.9 * S), f['frac'], r=f['r'] * S)
        st = dp.get('stretch', 1.0)
        if st != 1.0: m = (cv2.resize(m.astype(np.float32), (int(m.shape[1] * st), Hw), interpolation=cv2.INTER_LINEAR) > 0.5).astype(np.uint8)
        if dp.get('flip'): m = m[:, ::-1].copy()
        out = drape(m, dp['seed'], S, Lmax=dp['L'])
        d = cv2.resize(out.astype(np.float32), (max(1, round(out.shape[1] / S)), Hd), interpolation=cv2.INTER_AREA)
        m = (d > 0.5).astype(np.uint8)
    else:
        r = max(1, round(f['r'] * Hd / 480)) if f['r'] else 0
        m = fill_holes(at(a, Hd), f['frac'], r)
    return m, to_edge(m, rim(m))


def hatch(shape, period=5, width=1.7):
    H, W = shape; yy, xx = np.mgrid[0:H, 0:W]
    return (((xx + yy) % period) < width).astype(np.uint8)


def paint(m, sh=None, col=(0, 255, 255)):
    img = np.zeros(m.shape + (3,), np.uint8); img[m > 0] = col
    if sh is not None: img[(sh > 0) & (hatch(m.shape) == 0)] = 0
    return img


if __name__ == '__main__':
    out = os.environ.get('TREE_OUT') or os.path.join(tempfile.gettempdir(), 'megafont-trees'); os.makedirs(out, exist_ok=True)
    T = json.load(open(os.path.join(ROOT, 'trees.json'), encoding='utf-8'))['trees']
    cells = []
    for t in T:
        m, sh = tree(t); cells.append(np.pad(paint(m, sh), ((10, 10), (0, 30), (0, 0))))
        cv2.imwrite(os.path.join(out, f"{t['id']}.png"), paint(m, sh))
    rows, row, w = [], [], 0
    for c in cells:
        row.append(c); w += c.shape[1]
        if w > 2000: rows.append(np.hstack(row)); row, w = [], 0
    if row: rows.append(np.hstack(row))
    Wm = max(r.shape[1] for r in rows)
    cv2.imwrite(os.path.join(out, 'set.png'), np.vstack([np.pad(r, ((0, 0), (0, Wm - r.shape[1]), (0, 0))) for r in rows]))
    print(out, len(T), '그루')
