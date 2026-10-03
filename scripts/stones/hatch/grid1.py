# 돌 결 격자 1 — 무늬 여섯(지금 · 그늘 띠 · 사진 그늘 면 · 굵기 · 끊김 · 점) × 돌 둘(2번 돌빛 · 5번 진홍). 벽 실제 화소(1920×1080).
# 결의 기준은 나무 빗금: ／ 방향, (x + y) 5px마다 칠 줄 1.7px — 가장 어두운 자리 = 나무 그늘과 같은 밀도
import cv2, numpy as np, json, os
from PIL import Image, ImageDraw, ImageFont

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
# 결과(격자 그림 · 움직이는 견본)는 임시 폴더에 — 고른 판은 design/landscape-stone-tex-*.png로 옮겨 둔다
OUT = os.environ.get('HATCH_OUT') or os.path.join(__import__('tempfile').gettempdir(), 'megafont-stone-hatch')
os.makedirs(OUT, exist_ok=True)
SS = 4                       # 4배로 그려 줄여 가장자리를 곱게
P, WP = 5.0, 1.7             # 나무 빗금: 주기 · 칠 줄 굵기(x + y 단위)
GAP = P - WP                 # 가장 어두운 자리의 검은 틈
BG = (0, 0, 0)
FONT_SERIF = 'C:/Windows/Fonts/NotoSerifKR-VF.ttf'
FONT_SANS = 'C:/Windows/Fonts/NotoSansKR-VF.ttf'
S = {s['name']: s for s in json.load(open(f'{REPO}/design/stone-photo/stones.json', encoding='utf-8'))['stones']}


def hexrgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def stone_fields(name, W):
    """돌 하나를 벽 폭 W px로: 칠 마스크(SS배) · 어두움 d(0~1, SS배) · 윤곽 점(SS배)"""
    s = S[name]; H = round(W * s['h'] / s['w'])
    im = cv2.imread(f'{REPO}/design/stone-photo/src/{name}.jpg'); sh = cv2.imread(f'{REPO}/design/stone-photo/shape/{name}.png', 0)
    ys, xs = np.nonzero(sh > 127); x0, y0 = xs.min(), ys.min()
    crop = im[y0:y0 + s['h'], x0:x0 + s['w']]
    Ws, Hs = W * SS, H * SS
    pts = np.array([[x * Ws, y * Hs] for x, y in s['points']], np.float32)
    pts[:, 0] = (pts[:, 0] - pts[:, 0].min()) / (pts[:, 0].max() - pts[:, 0].min()) * (Ws - 1)
    pts[:, 1] = (pts[:, 1] - pts[:, 1].min()) / (pts[:, 1].max() - pts[:, 1].min()) * (Hs - 1)
    m = np.zeros((Hs, Ws), np.uint8); cv2.fillPoly(m, [pts.astype(np.int32)], 1)
    L = cv2.cvtColor(cv2.resize(crop, (Ws, Hs), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2LAB)[:, :, 0].astype(np.float32)
    L = cv2.GaussianBlur(L, (0, 0), 1.2 * SS)           # 벽 1.2px — 잔 얼룩은 걷고 면 · 결은 남긴다
    inside = L[m > 0]; lo, hi = np.percentile(inside, 5), np.percentile(inside, 55)   # 밝은 절반은 맨 칠
    d = np.clip((hi - L) / (hi - lo), 0, 1) ** 1.2
    return m, d, pts, W, H


def text_mask(m, lines, size):
    """글 자리 — 칠 안에서 글 + 여백이 가장 넉넉한 곳, 무게중심 가까이. 글 판(SS배)과 걷는 판을 돌려준다"""
    Hs, Ws = m.shape; f = ImageFont.truetype(FONT_SERIF, size * SS); f.set_variation_by_axes([400])
    lh = size * 1.55 * SS; tw = max(f.getlength(t) for t in lines); th = lh * len(lines)
    pad = int(0.7 * size * SS)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (int(tw + 2 * pad) | 1, int(th + 2 * pad) | 1))
    ok = cv2.erode(m, k)
    ys, xs = np.nonzero(ok); my, mx = np.nonzero(m); cy, cx = my.mean() + 0.08 * Hs, mx.mean()
    i = np.argmin((xs - cx) ** 2 + ((ys - cy) * 1.2) ** 2); X, Y = xs[i] - tw / 2, ys[i] - th / 2
    img = Image.new('L', (Ws, Hs), 0); dr = ImageDraw.Draw(img)
    for j, t in enumerate(lines): dr.text((X, Y + j * lh + (lh - size * SS) / 2), t, font=f, fill=255)
    g = np.array(img)
    dist = cv2.distanceTransform((g <= 40).astype(np.uint8), cv2.DIST_L2, 5)
    fade = np.clip((dist - 0.5 * size * SS) / (1.3 * size * SS), 0, 1); fade = fade * fade * (3 - 2 * fade)
    return g, fade


def hatch_region(region):
    """나무 그대로 — region 안은 검정, ／ 칠 줄만 남는다"""
    Hs, Ws = region.shape; yy, xx = np.mgrid[0:Hs, 0:Ws]
    ph = ((xx + yy) / SS) % P
    return region & (ph >= WP)


def v_band(m, d, pts, H):
    # 오른쪽 아래 안쪽 띠(옛 기하 돌 규칙의 방향 — 바깥 법선 −35°~125°), 깊이 = 돌 키의 12%
    dep = 0.12 * H * SS; keep = np.ones_like(m)
    for th in np.radians(np.arange(-35, 126, 8)):
        dx, dy = dep * np.cos(th), dep * np.sin(th)
        M = np.float32([[1, 0, -dx], [0, 1, -dy]])
        keep &= cv2.warpAffine(m, M, (m.shape[1], m.shape[0]), flags=cv2.INTER_NEAREST, borderValue=0)
    return hatch_region((m & (1 - keep)).astype(bool))


def v_face(m, d, pts, H):
    r = (cv2.GaussianBlur(d, (0, 0), 1.5 * SS) > 0.5).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * SS + 1,) * 2)
    r = cv2.morphologyEx(cv2.morphologyEx(r, cv2.MORPH_OPEN, k), cv2.MORPH_CLOSE, k)
    return hatch_region((m & r).astype(bool))


def v_weight(m, d, pts, H):
    Hs, Ws = m.shape; yy, xx = np.mgrid[0:Hs, 0:Ws]
    ph = ((xx + yy) / SS) % P
    return (m > 0) & (ph < d * GAP)


def v_dash(m, d, pts, H):
    Hs, Ws = m.shape; yy, xx = np.mgrid[0:Hs, 0:Ws]
    u = (xx + yy) / SS; k = np.floor(u / P); ph = u % P
    t = (xx - yy) / SS; Q = 9.0
    off = (np.sin(k * 12.9898) * 43758.5453) % 1 * Q
    return (m > 0) & (ph < GAP * 0.8) & (((t + off) % Q) < d * Q)


def v_dot(m, d, pts, H):
    Hs, Ws = m.shape; yy, xx = np.mgrid[0:Hs, 0:Ws]
    u, v = (xx + yy) / SS, (xx - yy) / SS; sp = 7.0          # 줄 위의 점 — 나무 줄 사이의 1.4배 간격
    cu, cv = (np.round(u / sp) * sp), (np.round(v / sp) * sp)
    du, dv = (u - cu) / np.sqrt(2), (v - cv) / np.sqrt(2)
    rmax = np.sqrt(0.66 * (sp / np.sqrt(2)) ** 2 / np.pi)
    r = np.sqrt(d) * rmax
    return (m > 0) & (r >= 0.45) & (np.hypot(du, dv) < r)


def v_plain(m, d, pts, H): return np.zeros(m.shape, bool)


VARIANTS = [('지금 — 한 색', v_plain), ('그늘 띠 — 오른쪽 아래 안쪽', v_band), ('사진 그늘 면 — 나무 빗금', v_face),
            ('굵기 — 어두울수록 틈이 굵게', v_weight), ('끊김 — 어두울수록 길게', v_dash), ('점 — 어두울수록 크게', v_dot)]
ROWS = [('stone-b', 300, '#CCC1BA', '#2B2B2B', '2번 · 돌빛', ['여기서 크게 말해본 적', '없다']),
        ('stone-c', 330, '#801420', '#FFFFFF', '5번 · 진홍', ['오늘은 아무 말도', '하고 싶지 않았다'])]


def render(name, W, paint, ink, lines, fn):
    m, d, pts, W, H = stone_fields(name, W)
    g, fade = text_mask(m, lines, 16)
    cut = fn(m, d * fade, pts, H) & (fade > 0.35)
    Hs, Ws = m.shape
    out = np.zeros((Hs, Ws, 3), np.float32); out[:] = BG
    paintm = (m > 0) & ~cut
    out[paintm] = hexrgb(paint)
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(hexrgb(ink), np.float32) * a
    small = cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA)
    return np.clip(small, 0, 255).astype(np.uint8)


def tree_ref(Hpx, paint):
    im = cv2.imread(f'{REPO}/src/assets/trees/pine-764.png', cv2.IMREAD_UNCHANGED)
    h, w = im.shape[:2]; Wt = round(w * Hpx / h)
    big = cv2.resize(im, (Wt * SS, Hpx * SS), interpolation=cv2.INTER_AREA).astype(np.float32)
    G, R = big[:, :, 1] / 255, big[:, :, 2] / 255  # BGR(A): 초록 = 칠, 빨강 = 그늘
    yy, xx = np.mgrid[0:Hpx * SS, 0:Wt * SS]
    cut = (R > 0.5) & ((((xx + yy) / SS) % P) >= WP)
    a = G * ~cut
    out = a[..., None] * np.array(hexrgb(paint), np.float32)
    return np.clip(cv2.resize(out, (Wt, Hpx), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


if __name__ == '__main__':
    CW, CH, LAB = 360, 210, 40
    ref_w = 230; TOP = 74
    Wimg = 20 + ref_w + 20 + CW * len(VARIANTS) + 20; Himg = TOP + (CH + LAB) * len(ROWS) + 10
    canvas = Image.new('RGB', (Wimg, Himg), BG); dr = ImageDraw.Draw(canvas)
    fb = ImageFont.truetype(FONT_SANS, 22); fb.set_variation_by_axes([700])
    fs = ImageFont.truetype(FONT_SANS, 14); fs.set_variation_by_axes([400])
    dr.text((20, 14), '돌 결 1b — 무늬 여섯 × 돌 둘 (벽 실제 화소)', font=fb, fill=(255, 255, 255))
    dr.text((20, 46), '물음: 왼쪽 나무 옆에 섰을 때, 어느 칸이 가장 \'돌의 재질\'로 읽히나 — 글이 먼저 읽히는 칸 가운데서', font=fs, fill=(190, 190, 190))
    # 기준 나무
    t = tree_ref(260, '#CCC1BA'); canvas.paste(Image.fromarray(t),(20 + (ref_w - t.shape[1]) // 2, TOP + 40))
    dr.text((20, TOP + 40 + 268), '기준: 나무 빗금(소나무 764)', font=fs, fill=(190, 190, 190))
    x0 = 20 + ref_w + 20
    dr.line([(x0 - 10, TOP), (x0 - 10, Himg - 10)], fill=(60, 60, 60))
    for r, (name, W, paint, ink, lab, lines) in enumerate(ROWS):
        y = TOP + r * (CH + LAB)
        for c, (vl, fn) in enumerate(VARIANTS):
            img = render(name, W, paint, ink, lines, fn)
            h, w = img.shape[:2]
            canvas.paste(Image.fromarray(img), (x0 + c * CW + (CW - w) // 2, y + CH - h - 6))
            dr.text((x0 + c * CW + 8, y + CH + 2), f'{chr(65 + c)}{r + 1} · {vl}', font=fs, fill=(225, 225, 225))
            dr.text((x0 + c * CW + 8, y + CH + 20), f'{lab} · 돌 {w}×{h}px', font=fs, fill=(140, 140, 140))
        if r: dr.line([(x0, y - 4), (Wimg - 20, y - 4)], fill=(60, 60, 60))
    canvas.save(os.path.join(OUT, 'stone-tex-1b.png'))
    print('저장', os.path.join(OUT, 'stone-tex-1b.png'), canvas.size)
