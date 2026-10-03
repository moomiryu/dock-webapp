# 움직이는 견본 — 돌이 기대고 구를 때 결을 어떻게 둘까. 셋을 나란히:
#   가  함께 돈다          — 그늘 덩이도 빗금 줄도 돌에 그려진 것처럼 같이 돈다(줄이 기운다)
#   나  줄은 ／ 그대로     — 그늘 덩이는 돌과 함께 돌고, 빗금 줄의 방향만 늘 ／(나무와 같은 방향)
#   다  빛 쪽에 남는다     — 잔 결(면 · 금)은 돌과 함께 돌고, 빛은 늘 오른쪽 위 — 돌이 돌면 그늘이 다른 면으로 옮겨 간다. 줄은 ／
# 배(땅에 묻혀 있다가 기울면 드러나는 아랫부분, 윗선을 밑변에 비춰 0.35배)는 셋 다 그늘(아래를 보는 면)
# 움직임은 물리가 아니라 정해 둔 길: 쉼 → 오른쪽으로 25° 기댐(밑 오른쪽 모서리를 축으로) → 돌아옴 → 왼쪽 25° → 돌아옴 → 들려서 한 바퀴
import cv2, numpy as np, os, io, base64
from PIL import Image, ImageDraw, ImageFont
import grid1 as G, grid3 as G3, grid4 as G4, grid6 as G6, grid6c as G6c, grid8 as G8

S4, S2 = G.SS, 2                     # 결을 지은 배율(4) · 움직임을 그리는 배율(2)
FPS, DUR = 25, 6.6
PW, PH, GROUND = 470, 450, 420       # 칸(벽 px) · 땅선
Q, LEVEL, WOB, OWOB = 35, (3.75, 0.0225), G6.WOB['미세'], 0.8
BELLY = 0.35
LIGHT_DIR = (0.6, -0.8)   # 빛이 오는 쪽(화면, 아래가 +) — 오른쪽 위
KB = 0.9                  # f가 빛을 정면으로 보다가 등지면 밝기가 (밝은 끝 − 어두운 끝)의 2 × 0.9배 바뀐다
PAINT, INK = np.array(G.hexrgb('#CCC1BA'), np.float32), np.array(G.hexrgb('#2B2B2B'), np.float32)


def fields_L(name, H, flip):
    """grid3.fields와 같은 길(큰 명암 다시 얹기 포함)로 밝기 L을, 윤곽 흔들림 마스크와 함께"""
    s = G.S[name]; W = round(H * s['w'] / s['h'])
    im = cv2.imread(f'{G.REPO}/design/stone-photo/src/{name}.jpg'); sh = cv2.imread(f'{G.REPO}/design/stone-photo/shape/{name}.png', 0)
    ys, xs = np.nonzero(sh > 127); x0, y0 = xs.min(), ys.min()
    crop = im[y0:y0 + s['h'], x0:x0 + s['w']]
    Ws, Hs = W * S4, H * S4
    pts = np.array(s['points'], np.float32)
    pts[:, 0] = (pts[:, 0] - pts[:, 0].min()) / (pts[:, 0].max() - pts[:, 0].min()) * (Ws - 1)
    pts[:, 1] = (pts[:, 1] - pts[:, 1].min()) / (pts[:, 1].max() - pts[:, 1].min()) * (Hs - 1)
    m0 = np.zeros((Hs, Ws), np.uint8); cv2.fillPoly(m0, [pts.astype(np.int32)], 1)
    L = cv2.cvtColor(cv2.resize(crop, (Ws, Hs), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2LAB)[:, :, 0].astype(np.float32)
    L = cv2.GaussianBlur(L, (0, 0), 1.2 * S4)
    low = G3.fill_out(L, m0, 0.15 * Ws); det = L - low
    tgt = low if G3.LIGHT[name] == G3.WALL else low[:, ::-1]
    L = (det[:, ::-1] if flip else det) + tgt
    m = np.zeros((Hs, Ws), np.uint8); cv2.fillPoly(m, [np.round(G8.wobble_poly(pts, OWOB)).astype(np.int32)], 1)
    if flip: m = m[:, ::-1].copy()
    return m, L, W, H


def build(name, flip, H=150):
    m, L, W, H = fields_L(name, H, flip)
    inside = L[m > 0]; lo, hi = np.percentile(inside, 5), np.percentile(inside, 55)
    dmap = lambda X: np.clip((hi - X) / (hi - lo), 0, 1) ** 1.2
    g, fade = G.text_mask(m, ['여기서 크게 말해본 적', '없다'], 16)
    # 배율 4 → 2, 아래로 배 자리를 늘린 판
    h2, w2 = H * S2, W * S2; bh = int(np.ceil(BELLY * h2)) + 2; Hf = h2 + bh
    down = lambda a, interp=cv2.INTER_AREA: cv2.resize(a.astype(np.float32), (w2, h2), interpolation=interp)
    ext = lambda a, v=0: np.vstack([a, np.full((bh, w2), v, a.dtype)])
    up = (down(m) > 0.5).astype(np.uint8)
    yb = h2 - 1
    belly = np.zeros((Hf, w2), np.uint8)
    for x in range(w2):
        col = np.nonzero(up[:, x])[0]
        if len(col) and col.max() >= yb - 1:
            belly[yb:int(round(yb + BELLY * (yb - col.min()))) + 1, x] = 1
    base = np.nonzero(up[yb])[0]
    # 빛은 벽에 하나, 오른쪽 위(LIGHT_DIR). 자리마다 '향하는 쪽' f를 둔다 — 윗부분은 돌 가운데에서 그 자리로 향하는 쪽(가운데는 0,
    # 가장자리로 갈수록 커진다), 배는 밑변에서 비춘 윗자리의 f에서 시작해 깊어질수록 '아래(0, 1)'로 기운다(배는 바닥을 보는 면).
    # 밝기 = 쉬는 밝기 + KB × (지금 f가 빛을 보는 정도 − 쉴 때의 정도). 돌이 돌면 f도 돈다 — 기울어 아래를 보는 배는 어둡고,
    # 뒤집혀 위를 보면 밝다. 밑변에서는 배의 f와 밝기가 윗부분과 같아 직선으로 갈리지 않는다.
    # (사진의 큰 명암 기울기에서 빛을 뽑으면 달처럼 윗부분이 어둡게 찍힌 돌은 배가 거꾸로 밝았다. 자리만 따지면 밑변 가까운 배가 밝았다)
    Lup = down(L); ys, xs = np.nonzero(up); c = (xs.mean(), ys.mean())
    lx, ly = LIGHT_DIR; k = KB * (hi - lo); D = 0.5 * h2
    Y, X = np.mgrid[0:Hf, 0:w2]
    sy = np.where(Y <= yb, Y, yb - (Y - yb) / BELLY).clip(0, h2 - 1).astype(np.float32)
    Lsrc = cv2.remap(Lup.astype(np.float32), X.astype(np.float32), sy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    sx_, sy_ = (X - c[0]) / D, (sy - c[1]) / D                     # 비춘 윗자리의 f(윗부분은 제자리 그대로)
    depth = np.maximum(belly.sum(0).astype(np.float32), 1)[None, :]
    s_ = np.clip((Y - yb) / (0.5 * depth), 0, 1) * (Y > yb)
    fx = (1 - s_) * sx_; fy = (1 - s_) * sy_ + s_ * 1.0
    Lrest = Lsrc + k * ((fx - sx_) * lx + (fy - sy_) * ly)
    full = np.maximum(ext(up), belly)
    F = dict(up=ext(up), belly=belly, full=full, g=ext(down(g)), fade=ext(down(fade), 1.0), L=Lrest, c=c, k=k, fx=fx, fy=fy,
             edge=noise2((Hf, w2), 1.2, 18), W=w2, H=Hf, yb=yb, bx0=base.min(), bx1=base.max(), hi=hi, lo=lo, area=int(up.sum()))
    # 그늘 문턱 — 쉬는 자세의 윗부분에서 어두운 35%(고른 값)
    d2 = np.clip((hi - F['L']) / (hi - lo), 0, 1) ** 1.2
    dd2 = cv2.GaussianBlur(d2, (0, 0), LEVEL[0] * S2) + WOB[3] * F['edge']
    F['thr'] = np.percentile(dd2[F['up'] > 0], 100 - Q)
    # 가의 빗금 — 돌 판 위에서 긋는다
    u = (X + Y) / S2 + WOB[0] * noise2((Hf, w2), 6, 31) + WOB[1] * noise2((Hf, w2), 0.7, 32)
    w = G.WP * (1 + WOB[2] * noise2((Hf, w2), 4, 33))
    F['lines_local'] = (u % G.P) < w
    F['reg'] = c_region(F, F['L'], full, F['fade'], F['edge']).astype(np.uint8)   # 쉬는 자세의 그늘 — 가 · 나는 이것이 돌과 함께 돈다
    return F


_N2 = {}
def noise2(shape, sig, seed):
    k = (shape, sig, seed)
    if k not in _N2:
        r = np.random.default_rng(seed).standard_normal(shape).astype(np.float32)
        n = cv2.GaussianBlur(r, (0, 0), sig * S2); _N2[k] = n / (n.std() + 1e-6)
    return _N2[k]


def c_region(F, Ls, up, fade, edge):
    d = np.clip((F['hi'] - Ls) / (F['hi'] - F['lo']), 0, 1) ** 1.2
    dd = cv2.GaussianBlur(d, (0, 0), LEVEL[0] * S2) + WOB[3] * edge
    rg = (dd > F['thr']) & (up > 0)
    ar = F['area'] * LEVEL[1]
    rg = G4.drop_small(rg, ar); rg = G4.fill_small(rg, up.astype(np.uint8), ar)
    rg &= fade > 0.5
    return G4.drop_small(rg, ar * 0.5)


def ease(t): t = min(max(t, 0), 1); return t * t * (3 - 2 * t)


def pose(F, t):
    """(각도, 돌 판의 축, 화면의 축) — 화면 배율 2"""
    X0 = (PW * S2 - F['W']) / 2; Gy = GROUND * S2
    rest_l = (F['bx0'], F['yb']); rest_r = (F['bx1'], F['yb'])
    scr = lambda p: (X0 + p[0], Gy - (F['yb'] - p[1]))
    ang = np.radians(25)
    if t < 0.6: return 0, rest_l, scr(rest_l)
    if t < 1.4: return ang * ease((t - 0.6) / 0.8), rest_r, scr(rest_r)
    if t < 1.9: return ang, rest_r, scr(rest_r)
    if t < 2.6: return ang * (1 - ease((t - 1.9) / 0.7)), rest_r, scr(rest_r)
    if t < 3.4: return -ang * ease((t - 2.6) / 0.8), rest_l, scr(rest_l)
    if t < 3.9: return -ang, rest_l, scr(rest_l)
    if t < 4.6: return -ang * (1 - ease((t - 3.9) / 0.7)), rest_l, scr(rest_l)
    k = ease((t - 4.6) / 1.8); c = F['c']; cs = scr(c)
    lift = np.sin(np.pi * k) * 110 * S2
    return 2 * np.pi * k, c, (cs[0], cs[1] - lift)


def frame(F, t, mode):
    th, pl, ps = pose(F, t); ct, st = np.cos(th), np.sin(th)
    M = np.float32([[ct, -st, ps[0] - (ct * pl[0] - st * pl[1])], [st, ct, ps[1] - (st * pl[0] + ct * pl[1])]])
    size = (PW * S2, PH * S2)
    wp = lambda a, interp=cv2.INTER_LINEAR, border=cv2.BORDER_CONSTANT: cv2.warpAffine(a.astype(np.float32), M, size, flags=interp, borderMode=border)
    full = wp(F['full']) > 0.5; up = wp(F['up']) > 0.5; belly = wp(F['belly']) > 0.5
    g = wp(F['g']); fade = wp(F['fade'], border=cv2.BORDER_REPLICATE)
    Hs, Ws = size[1], size[0]; Y, X = np.mgrid[0:Hs, 0:Ws]
    lines_scr = None
    if mode != 'A':
        u = (X + Y) / S2 + WOB[0] * noise2((Hs, Ws), 6, 41) + WOB[1] * noise2((Hs, Ws), 0.7, 42)
        w = G.WP * (1 + WOB[2] * noise2((Hs, Ws), 4, 43))
        lines_scr = (u % G.P) < w
    if mode == 'A':
        cut = wp((F['reg'] > 0) & ~F['lines_local'], cv2.INTER_NEAREST) > 0.5
    elif mode == 'B':
        reg = wp(F['reg'] > 0, cv2.INTER_NEAREST) > 0.5
        cut = reg & ~lines_scr
    else:
        lx, ly = LIGHT_DIR
        fx, fy = wp(F['fx'], border=cv2.BORDER_REPLICATE), wp(F['fy'], border=cv2.BORDER_REPLICATE)
        rx, ry = ct * fx - st * fy, st * fx + ct * fy                 # 돌과 함께 돈 f
        Ls = wp(F['L'], border=cv2.BORDER_REPLICATE) + F['k'] * ((rx - fx) * lx + (ry - fy) * ly)
        rg = c_region(F, Ls, full, fade, wp(F['edge'], border=cv2.BORDER_REPLICATE))
        cut = rg & ~lines_scr
    out = np.zeros((Hs, Ws, 3), np.float32)
    show = full & ~cut & (Y < GROUND * S2)
    out[show] = PAINT
    a = np.clip(g / 255.0, 0, 1)[..., None] * (Y < GROUND * S2)[..., None]
    out = out * (1 - a) + INK * a
    out[GROUND * S2:GROUND * S2 + 2] = (70, 70, 70)
    return cv2.resize(out, (PW, PH), interpolation=cv2.INTER_AREA)


if __name__ == '__main__':
    stones = [('stone-b', True, '2번'), ('stone-moon', True, '달')]
    Fs = [build(n, fl) for n, fl, _ in stones]
    modes = ['A', 'B', 'C']
    n = int(FPS * DUR); frames = []
    for i in range(n):
        t = i / FPS
        rows = [np.hstack([frame(F, t, md) for md in modes]) for F in Fs]
        img = np.clip(np.vstack(rows), 0, 255).astype(np.uint8)
        frames.append(Image.fromarray(img))
        if i % 25 == 0: print('장면', i, '/', n, flush=True)
    buf = io.BytesIO()
    frames[0].save(buf, 'WEBP', save_all=True, append_images=frames[1:], duration=int(1000 / FPS), loop=0, quality=92, method=4)
    open(os.path.join(G.OUT, 'motion.webp'), 'wb').write(buf.getvalue())
    print('webp', len(buf.getvalue()) // 1024, 'KB')
