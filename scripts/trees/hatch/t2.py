# 나무 결 격자 2 — 빗금이 직선으로 끊기는 마감(디자이너 — "'직선형'으로 마감되는 부분이 너무 거슬린다"). 직선은 세 곳에서 난다:
#   ① 그늘 띠의 양 끝 — 나무 재료(scripts/trees/shape.py rim)가 세로줄마다 칠해, 띠가 시작 · 끝나는 열에서 세로로 끊긴다
#   ② 그늘 띠의 윗변 — 수관 밑선을 키의 7%만큼 그대로 올린 선이라, 밑이 평평한 수관에서는 가로 직선
#   ③ 글 둘레 — 앱(TreeArt)이 글 줄 네모를 둥근 네모로 넓혀 그 안의 빗금을 걷어, 빗금 위가 가로로 끊긴다
# 앱의 재료(src/assets/trees/<id>.png의 빨강 = 그늘) 위에서 고친다 — 앱도 같은 셈을 나무를 그릴 때 하면 된다(재료를 다시 짓지 않고).
# 칸 = 가 지금 · 나 물결(띠 두께가 낮은 결로 오르내리고 끝은 밑선 따라 얇아짐, 글 둘레는 잎 결처럼 들쭉날쭉) · 다 둥글게(띠 윗변이 둥근 봉우리를
# 잇고 끝은 둥글게, 글 둘레는 글자마다 둥근 물결). 글은 앱처럼 그늘 띠 위에 걸친다. 벽 실제 화소(키 560px), 빗금은 손맛 미세. 결과는 임시 폴더
import cv2, numpy as np, os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'stones', 'hatch'))
import grid1 as G, grid6 as G6

SS, P = G.SS, G.P
REPO = G.REPO
OUT = os.environ.get('HATCH_OUT') or os.path.join(__import__('tempfile').gettempdir(), 'megafont-tree-hatch')
os.makedirs(OUT, exist_ok=True)
H = 560
EM = 30                    # 벽의 나무 글자(px) — 한 칸 u
LIFT = 0.42 * EM           # 글 둘레를 넓히는 폭(PERSONAS.ttoryeot.tree.lift)
TREES = [('pine-071', '#59A173', '오늘 하루도 버텼다'), ('pine-223', '#DC7671', '같이 밥 먹을 사람'), ('willow-017', '#F6E67B', '시험 망했지만 괜찮아')]
FONT = 'C:/Windows/Fonts/NotoSansKR-VF.ttf'


def load(tid):
    im = np.array(Image.open(f'{REPO}/src/assets/trees/{tid}.png').convert('RGB'))
    W = round(H * im.shape[1] / im.shape[0])
    im = cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    g, r = im[..., 1], im[..., 0]
    # 그늘은 칠에 대한 몫으로 — 줄이면 가는 가닥은 칠 · 그늘이 같이 옅어져 0.5 아래로 빠졌다(가닥이 빗금 없이 남았다)
    return (g > 0.5).astype(np.uint8), ((r > 0.5 * g) & (g > 0.2)).astype(np.uint8)


def runs_h(on):
    """행마다 켜진 칸에서 가장 가까운 꺼진 칸까지의 가로 거리"""
    Hh, W = on.shape; a = np.zeros((Hh, W), np.float32); b = np.zeros((Hh, W), np.float32); c = np.zeros(Hh, np.float32)
    for x in range(W): c = (c + 1) * on[:, x]; a[:, x] = c
    c[:] = 0
    for x in range(W - 1, -1, -1): c = (c + 1) * on[:, x]; b[:, x] = c
    return np.minimum(a, b)


def runs_v(on):
    """열마다 — 아래 끝(그늘 아래 경계)까지의 거리 · 그 세로 토막의 길이"""
    Hh, W = on.shape; below = np.zeros((Hh, W), np.float32); above = np.zeros((Hh, W), np.float32); c = np.zeros(W, np.float32)
    for y in range(Hh - 1, -1, -1): c = (c + 1) * on[y]; below[y] = c
    c[:] = 0
    for y in range(Hh): c = (c + 1) * on[y]; above[y] = c
    return below, above + below - 1


def finish(sh, mode, seed=3):
    """그늘 띠를 고친다 — 띠 밑에서 위로 잰 높이가 (토막 길이 × 끝 마감 × 윗변 결)보다 크면 뺀다"""
    if mode == 'now': return sh
    dd = 0.07 * H
    dx = runs_h(sh); hb, T = runs_v(sh)
    x = np.arange(sh.shape[1], dtype=np.float32)[None, :]
    if mode == 'wave':
        end = np.clip(dx / (1.6 * dd), 0, 1)                                     # 끝 — 밑선 따라 곧게 얇아진다
        rng = np.random.default_rng(seed); n = rng.standard_normal(sh.shape[1]).astype(np.float32)
        n = cv2.GaussianBlur(n[None, :], (0, 0), sigmaX=0.9 * dd)[0]; n /= n.std() + 1e-6
        top = np.clip(0.8 + 0.35 * n, 0.35, 1.25)[None, :]                       # 윗변 — 낮은 결로 오르내린다
    else:
        end = np.sqrt(np.clip(1 - (1 - np.clip(dx / dd, 0, 1)) ** 2, 0, 1))      # 끝 — 반원
        period = 1.3 * dd; ph = (x / period) % 1.0
        top = 0.55 + 0.45 * np.sqrt(np.clip(1 - (2 * ph - 1) ** 2, 0, 1))      # 윗변 — 둥근 봉우리를 잇는다
    keep = hb <= T * end * top + 0.5
    return (sh & keep).astype(np.uint8)


def fill_below(m, sh):
    """빗금이 시작한 선 아래는 끝까지 — 그늘에서 아래로 칠이 끊기지 않고 이어진 곳은 모두 그늘(디자이너 — 마지막에 남는 빈틈이 애매하다).
    열마다 맨 위에서 아래를 다 칠했더니 위쪽 작은 그늘에서 쭉 내려와 세로 직선이 새로 났다 — 틈은 건너뛰지 않는다.
    땅에 닿는 열(줄기)은 그대로"""
    Hh, W = m.shape; out = sh.copy(); carry = np.zeros(W, bool)
    for y in range(Hh):                                       # 그늘에서 아래로 칠이 끊기지 않고 이어지는 데까지(틈을 건너뛰지 않는다)
        carry = (sh[y] > 0) | (carry & (m[y] > 0))
        out[y] |= (carry & (m[y] > 0)).astype(np.uint8)
    ground = m[Hh - 3:].any(0); out[:, ground] = sh[:, ground]
    return out


def extend(m, sh, seed_top=None):
    """띠를 덩이 밑자락 따라 실루엣 끝까지 — 디자이너: "그 위에서 시작했으면 그 밑에는 모두 빗금". 밑자락 = 칠(작은 틈은 메운 판)의
    세로 토막에서 아래 끝까지 깊이(키의 7% × 둥근 봉우리) 안. 지금의 띠에서 출발해 밑자락을 따라 이어진 곳을 모두 그늘로 — 띠가 덩이
    중간에서 끝나지 않는다. 땅에 닿는 열(줄기)은 그대로"""
    Hh, W = m.shape; dd = 0.07 * Hh
    closed = ((cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.012 * Hh) > 0.5) | (m > 0)).astype(np.uint8)
    below, _ = runs_v(closed)
    x = np.arange(W, dtype=np.float32); ph = (x / (1.3 * dd)) % 1.0
    top = 0.55 + 0.45 * np.sqrt(np.clip(1 - (2 * ph - 1) ** 2, 0, 1))
    ground = m[Hh - 3:].any(0)
    Z = ((m > 0) & (below <= dd * top[None, :]) & ~ground[None, :]).astype(np.uint8)
    # 큰 띠에서만 잇는다 — 수관 위쪽의 작은 그늘 조각(가지 갈래 밑)에서 이으니 위쪽 가지 밑까지 번졌다. 작은 조각은 그대로 둔다
    k, sl, st, _ = cv2.connectedComponentsWithStats(sh, connectivity=8)
    big = np.zeros(k, bool); big[1:] = st[1:, 4] >= 0.01 * m.sum()
    # 띠마다 제 윗선(가장 높은 칸)보다 위로는 잇지 않는다 — 수관 옆구리의 밑자락을 타고 위쪽 가지 밑까지 올라갔다
    yy = np.arange(Hh)[:, None]; rb = yy + below - 1           # 칸이 든 세로 토막의 아래 끝 줄
    # (윗선에서 가로로 자르면 그 자리에 다시 가로 직선이 났다)
    out = ((sh > 0) & ~big[sl]).astype(np.uint8)
    for c in np.nonzero(big)[0]:
        cm = sl == c; top = np.nonzero(cm.any(1))[0].min()
        allow = ((Z > 0) | cm) & (rb >= top)                 # 밑자락이 이 띠의 윗선보다 아래에서 끝나는 토막만(위 가지 밑은 통째로 뺀다)
        n, lb = cv2.connectedComponents(allow.astype(np.uint8), connectivity=4)
        hit = np.unique(lb[cm & (lb > 0)])
        out |= (np.isin(lb, hit) & (lb > 0)).astype(np.uint8)
    # 띠 위에서 아래로 이어진 칠(잎 끝 · 가닥)도
    out = fill_below(m, out)
    out[:, ground] = sh[:, ground]
    # 칠 안에서 끝나는 곳(줄기와 만나는 자리)만 둥글게 — 실루엣 바깥 끝은 끝까지 칠한다(빈틈을 남기지 않는다)
    dx = runs_h(((out > 0) | (m == 0)).astype(np.uint8)); hb, T = runs_v(out)
    end = np.sqrt(np.clip(1 - (1 - np.clip(dx / dd, 0, 1)) ** 2, 0, 1))
    return (out & (hb <= T * end + 0.5)).astype(np.uint8)


def text_layer(shp, sh, text):
    """글 — 가장 큰 그늘 띠의 가운데 위, 줄 밑이 띠 윗선에서 0.35em 아래(앱처럼 글 둘레가 띠 위를 자른다)"""
    n, lb, st, _ = cv2.connectedComponentsWithStats(sh, 8)
    k = 1 + int(np.argmax(st[1:, 4])) if n > 1 else 0
    ys, xs = np.nonzero(lb == k) if k else (np.array([shp[0] * 0.5]), np.array([shp[1] * 0.5]))
    f = ImageFont.truetype(FONT, EM); f.set_variation_by_axes([700])
    tw = f.getlength(text); cx = float(np.clip(xs.mean(), tw / 2 + 4, shp[1] - tw / 2 - 4))
    y1 = ys.min() + 0.35 * EM; y0 = y1 - 1.1 * EM; x0 = cx - tw / 2
    img = Image.new('L', (shp[1], shp[0]), 0); ImageDraw.Draw(img).text((x0, (y0 + y1) / 2), text, font=f, fill=255, anchor='lm')
    chars, x = [], x0
    for ch in text:
        w = f.getlength(ch)
        if ch.strip(): chars.append((x + w / 2, (y0 + y1) / 2))
        x += w
    return np.array(img), (x0, y0, x0 + tw, y1), chars


def clearance(shp, rect, chars, mode, s, seed=5):
    """빗금을 걷는 곳 — 지금: 둥근 네모(앱) · 물결: 둥근 네모 가장자리에 잎 결 잡음 · 둥글게: 글자마다 원을 이은 물결 (s배 판)"""
    Hh, W = shp; lr = LIFT * s
    z = np.zeros((Hh, W), np.uint8)
    if mode == 'round':
        for cx, cy in chars: cv2.circle(z, (int(cx * s), int(cy * s)), int((0.62 * EM + LIFT) * s), 1, -1)
    else:
        x0, y0, x1, y1 = [v * s for v in rect]
        cv2.rectangle(z, (int(x0), int(y0 - lr)), (int(x1), int(y1 + lr)), 1, -1)
        cv2.rectangle(z, (int(x0 - lr), int(y0)), (int(x1 + lr), int(y1)), 1, -1)
        for px, py in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)): cv2.circle(z, (int(px), int(py)), int(lr), 1, -1)
    f = cv2.GaussianBlur(z.astype(np.float32), (0, 0), 0.6 * lr)
    if mode == 'wave':
        near = cv2.GaussianBlur(z.astype(np.float32), (0, 0), 1.5 * lr) > 0.02
        f = f + near * (0.25 * G6.noise((Hh, W), 0.9 * LIFT, seed) + 0.1 * G6.noise((Hh, W), 0.3 * LIFT, seed + 1))
    return f >= 0.3


def render(tid, color, text, mode, seed=11):
    m, sh0 = load(tid)
    W = m.shape[1]
    g, rect, chars = text_layer(m.shape, sh0, text)
    sh = extend(m, finish(sh0, 'round')) if mode == 'extend' else finish(sh0, mode)
    up = lambda a: cv2.resize(a.astype(np.float32), (W * SS, H * SS), interpolation=cv2.INTER_LINEAR)
    mS, shS = up(m), up(sh)
    rg = (cv2.GaussianBlur(shS, (0, 0), 0.6 * SS) > 0.5) & ~clearance((H * SS, W * SS), rect, chars, 'round' if mode == 'extend' else mode, SS)
    cut = G6.hatch(rg, G6.WOB['미세'], seed).astype(np.float32)
    a = np.clip(mS, 0, 1) * (1 - cut)
    out = np.array(G.hexrgb(color), np.float32)[None, None] * a[..., None]
    img = cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA) * (1 - (g / 255.0)[..., None])   # 글 — 검정
    return np.clip(img, 0, 255).astype(np.uint8), rect


def font(size, wght):
    f = ImageFont.truetype(G.FONT_SANS, size); f.set_variation_by_axes([wght]); return f


if __name__ == '__main__':
    import sys as _s
    COLS = ([('다', '둥글게', 'round', '고르신 것 — 띠 윗변 둥근 봉우리 · 끝 둥글게 · 글 둘레 둥근 물결'),
             ('다+', '둥글게 + 그 밑은 모두', 'extend', '띠가 덩이 밑자락을 따라 실루엣 끝까지 — 중간에 끝나지 않는다(줄기는 그대로)')]
            if '--fill' in _s.argv else
            [('가', '지금', 'now', '띠 끝이 세로로 · 띠 윗변과 글 둘레가 가로로 끊긴다'),
             ('나', '물결', 'wave', '띠 두께가 낮은 결로 오르내리고 끝은 얇아지며 사라짐 · 글 둘레는 잎 결처럼'),
             ('다', '둥글게', 'round', '띠 윗변이 둥근 봉우리를 잇고 끝은 둥글게 · 글 둘레는 글자마다 둥근 물결')])
    cells = [[render(t, c, s, m) for _, _, m, _ in COLS] for t, c, s in TREES]
    cw = max(im.shape[1] for row in cells for im, _ in row) + 30
    LW, TOP = 30, 190
    # 줄마다 글 · 띠 둘레만(글 줄 위 1.2em ~ 아래 6em)
    spans = [(max(0, int(row[0][1][1] - 1.2 * EM)), min(H, int(row[0][1][3] + 6 * EM))) for row in cells]
    rh = [b - a + 24 for a, b in spans]
    Wt, Ht = LW + len(COLS) * cw, TOP + sum(rh) + 30
    sheet = Image.new('RGB', (Wt, Ht), (24, 24, 24)); dr = ImageDraw.Draw(sheet)
    dr.text((30, 24), '확인 — 다(둥글게)에 "그 밑은 모두 빗금"을 더하면' if '--fill' in _s.argv else '물음 — 나무 빗금이 끝나는 자리를 어떻게 마감할까요?', font=font(32, 800), fill=(255, 255, 255))
    dr.text((30, 72), '직선이 나는 곳 셋: 그늘 띠의 양 끝(세로) · 띠 윗변(가로) · 글 둘레에서 빗금을 걷는 자리(가로). 벽 실제 크기, 빗금은 손맛 미세.',
            font=font(16, 400), fill=(200, 200, 200))
    for j, (k, name, _, sub) in enumerate(COLS):
        dr.text((LW + j * cw, 118), f'{k}  {name}', font=font(24, 700), fill=(255, 255, 255))
        dr.text((LW + j * cw, 152), sub, font=font(13, 400), fill=(170, 170, 170))
    y = TOP
    for i, (a, b) in enumerate(spans):
        for j, (im, _) in enumerate(cells[i]):
            sheet.paste(Image.fromarray(im[a:b]), (LW + j * cw, y))
        y += rh[i]
    p = os.path.join(OUT, 't3-fill.png' if '--fill' in _s.argv else 't2-ends.png'); sheet.save(p); print(p, sheet.size)
