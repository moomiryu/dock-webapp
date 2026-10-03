# 결 격자 8 — 1번 장: 그늘 양 나(30%)와 다(40%) 사이 · 2번 장: 돌 윤곽의 미세한 구불구불(밑변은 곧게)
import cv2, numpy as np, os
from PIL import Image, ImageDraw, ImageFont
import grid1 as G, grid3 as G3, grid6 as G6, grid6c as G6c

SS, BG, S = G.SS, G.BG, G.S
OWOB = {'없음': 0.0, '아주 미세': 0.4, '미세': 0.8, '조금': 1.3}   # 윤곽을 바깥 · 안으로 미는 폭(벽 px)


def wobble_poly(pts, amp, seed=5):
    """윤곽 점을 벽 2px마다 촘촘히 하고, 변의 법선 쪽으로 낮은 결(σ 4px) + 잔 결(σ 1px, 0.35배) 잡음으로 민다. 밑변(y = 바닥)은 곧게"""
    if not amp: return pts
    ybot = pts[:, 1].max(); step = 2 * SS
    out = []
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        L = np.hypot(*(b - a)); n = max(1, int(L / step))
        bottom = abs(a[1] - ybot) < SS and abs(b[1] - ybot) < SS
        for k in range(n):
            out.append((a + (b - a) * k / n, bottom))
    P = np.array([p for p, _ in out], np.float32); flat = np.array([f for _, f in out])
    N = len(P); rng = np.random.default_rng(seed)
    def n1(sig_px):
        r = rng.standard_normal(N * 3).astype(np.float32)
        k = int(4 * sig_px / 2) * 2 + 1; g = np.exp(-0.5 * ((np.arange(k) - k // 2) / (sig_px / 2)) ** 2); g /= g.sum()
        v = np.convolve(r, g, 'same')[N:2 * N]; return v / (v.std() + 1e-6)
    off = (n1(4) + 0.35 * n1(1)) * amp * SS
    # 밑변과 그 양 끝 2px 안은 0 — 바닥에 딱 붙는다
    near = np.array([abs(p[1] - ybot) < 2 * SS for p in P]) | flat
    off[near] = 0
    T = np.roll(P, -1, 0) - np.roll(P, 1, 0); T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-6)
    Nrm = np.stack([T[:, 1], -T[:, 0]], 1)
    return P + Nrm * off[:, None]


def fields(name, H, flip, owob):
    s = S[name]; W = round(H * s['w'] / s['h'])
    m0, d, W, H = G3.fields(name, H, flip, True)
    if not owob: return m0, d, W, H
    Ws, Hs = W * SS, H * SS
    pts = np.array(s['points'], np.float32)
    pts[:, 0] = (pts[:, 0] - pts[:, 0].min()) / (pts[:, 0].max() - pts[:, 0].min()) * (Ws - 1)
    pts[:, 1] = (pts[:, 1] - pts[:, 1].min()) / (pts[:, 1].max() - pts[:, 1].min()) * (Hs - 1)
    P = wobble_poly(pts, owob)
    m = np.zeros((Hs, Ws), np.uint8); cv2.fillPoly(m, [np.round(P).astype(np.int32)], 1)
    if flip: m = m[:, ::-1].copy()
    return m, d, W, H


def render(name, H, flip, q, owob=0.0, seed=11, paint='#CCC1BA', ink='#2B2B2B'):
    m, d, W, H = fields(name, H, flip, owob)
    g, fade = G.text_mask(m, ['여기서 크게 말해본 적', '없다'], 16)
    rg = G6c.region_q(m, d, fade, 3.75, 0.0225, G6.WOB['미세'], seed, q)
    cut = G6.hatch(rg, G6.WOB['미세'], seed)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = BG
    out[(m > 0) & ~cut] = G.hexrgb(paint)
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(ink), np.float32) * a
    return np.clip(cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


def fonts():
    fb = ImageFont.truetype(G.FONT_SANS, 26); fb.set_variation_by_axes([700])
    fl = ImageFont.truetype(G.FONT_SANS, 34); fl.set_variation_by_axes([800])
    fm = ImageFont.truetype(G.FONT_SANS, 17); fm.set_variation_by_axes([600])
    fs = ImageFont.truetype(G.FONT_SANS, 15); fs.set_variation_by_axes([400])
    return fb, fl, fm, fs


def sheet_amount():
    fb, fl, fm, fs = fonts(); CW, RH, LW = 410, 200, 230
    ROWS = [('나', '그늘 조금 더', 30), ('①', '나와 다 사이', 33), ('②', '나와 다 사이', 36), ('다', '그늘 더', 40)]
    cv_ = Image.new('RGB', (LW + CW * 5 + 10, 100 + RH * len(ROWS)), BG); dr = ImageDraw.Draw(cv_)
    dr.text((20, 16), '1번 장 — 어느 줄의 그늘 양이 제일 좋은가요?  (나 · ① · ② · 다)', font=fb, fill=(255, 255, 255))
    dr.text((20, 58), '나와 다는 아까 본 그 줄. ① · ②가 그 사이입니다. 윤곽은 아직 곧은 그대로.', font=fs, fill=(170, 170, 170))
    for r, (k, lab, q) in enumerate(ROWS):
        y = 100 + r * RH
        dr.text((20, y + 44), k, font=fl, fill=(255, 255, 255)); dr.text((80, y + 58), lab, font=fm, fill=(220, 220, 220))
        for c, (n, flp, nl) in enumerate(G6.CAST):
            img = render(n, 150, flp, q); h, w = img.shape[:2]
            cv_.paste(Image.fromarray(img), (LW + c * CW, y + RH - 20 - h))
        dr.line([(20, y + RH - 6), (cv_.size[0] - 20, y + RH - 6)], fill=(55, 55, 55))
    return cv_


def sheet_outline():
    fb, fl, fm, fs = fonts(); CW, RH, LW, ZW = 410, 200, 230, 480
    cast = [('stone-b', True), ('stone-c', True), ('stone-moon', True)]
    keys = list(OWOB)
    cv_ = Image.new('RGB', (LW + CW * 3 + ZW + 20, 100 + RH * len(keys)), BG); dr = ImageDraw.Draw(cv_)
    dr.text((20, 16), '2번 장 — 돌 윤곽의 구불구불, 어느 줄이 좋은가요?  (그늘 양은 ①과 ② 사이로 둠)', font=fb, fill=(255, 255, 255))
    dr.text((20, 58), '밑변(바닥에 닿는 곳)은 곧게 둡니다. 맨 오른쪽은 달의 윗선을 3배 확대.', font=fs, fill=(170, 170, 170))
    for r, k in enumerate(keys):
        y = 100 + r * RH
        dr.text((20, y + 44), k, font=fm, fill=(255, 255, 255)); dr.text((20, y + 72), f'{OWOB[k]}px', font=fs, fill=(150, 150, 150))
        moon = None
        for c, (n, flp) in enumerate(cast):
            img = render(n, 150, flp, 35, OWOB[k]); h, w = img.shape[:2]
            cv_.paste(Image.fromarray(img), (LW + c * CW, y + RH - 20 - h))
            if n == 'stone-moon': moon = img
        crop = Image.fromarray(moon).crop((150, 0, 310, 58)).resize((480, 174), Image.NEAREST)
        cv_.paste(crop, (LW + CW * 3 + 10, y + 6))
        dr.line([(20, y + RH - 6), (cv_.size[0] - 20, y + RH - 6)], fill=(55, 55, 55))
    return cv_


if __name__ == '__main__':
    sheet_amount().save(os.path.join(G.OUT, 'tex-amount-8-1.png'))
    sheet_outline().save(os.path.join(G.OUT, 'tex-outline-8-2.png'))
    print('저장')
