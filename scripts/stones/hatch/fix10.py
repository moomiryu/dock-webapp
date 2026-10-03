# 결 격자 10 — 글이 빗금보다 먼저 읽히게. 가는 글(무게 250 · 445) × 고치는 법 넷
#   지금 · 가 = 빗금의 검은 틈 ≤ 글 획 × 1.5(줄 간격은 그대로, 칠 줄이 굵어진다) · 나 = 글 둘레를 넓게 비운다(벽 px 바닥) · 다 = 가 + 나
import cv2, numpy as np, os
from PIL import Image, ImageDraw, ImageFont
import grid1 as G, grid6 as G6, grid6c as G6c, grid8 as G8, diag9 as D9

SS, BG = G.SS, G.BG
WOB = G6.WOB['미세']


def hatch_gap(rg, gap_perp, seed=11):
    A, r, wv, edge = WOB
    Hs, Ws = rg.shape; yy, xx = np.mgrid[0:Hs, 0:Ws]
    u = (xx + yy) / SS + A * G6.noise(rg.shape, 6, seed) + r * G6.noise(rg.shape, 0.7, seed + 1)
    wp = G.P - gap_perp * np.sqrt(2)                          # 칠 줄(x + y 단위) — 틈이 가늘면 칠 줄이 굵다
    w = wp * (1 + wv * G6.noise(rg.shape, 4, seed + 2))
    return rg & ((u % G.P) >= w)


def fade_wide(g, size):
    dist = cv2.distanceTransform((g <= 40).astype(np.uint8), cv2.DIST_L2, 5) / SS   # 벽 px
    r0 = max(0.5 * size, 7.0); r1 = r0 + max(1.3 * size, 20.0)
    f = np.clip((dist - r0) / (r1 - r0), 0, 1); return f * f * (3 - 2 * f)


def render(size, wght, mode, name='stone-moon', flip=True, lines=('여기서 크게 말해본 적', '없다')):
    H = round(150 * size / 15.8)
    while True:
        m, d, W, H2 = G8.fields(name, H, flip, G8.OWOB['미세'])
        got = D9.text_mask_w(m, list(lines), size, wght)
        if got: break
        H += 4
    g, fade = got
    if mode in ('나', '다'): fade = fade_wide(g, size)
    rg = G6c.region_q(m, d, fade, 3.75, 0.0225, WOB, 11, 35)
    gap = G.GAP / np.sqrt(2)
    if mode in ('가', '다'): gap = min(gap, 1.5 * D9.stroke_px(size, wght))
    cut = hatch_gap(rg, gap)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = BG
    out[(m > 0) & ~cut] = G.hexrgb('#CCC1BA')
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb('#2B2B2B'), np.float32) * a
    return np.clip(cv2.resize(out, (W, H2), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8), gap


if __name__ == '__main__':
    fb = ImageFont.truetype(G.FONT_SANS, 24); fb.set_variation_by_axes([700])
    fm = ImageFont.truetype(G.FONT_SANS, 16); fm.set_variation_by_axes([600])
    fs = ImageFont.truetype(G.FONT_SANS, 14); fs.set_variation_by_axes([400])
    ROWS = [('가장 작게 · 무게 250', 0.47, 250), ('보통 · 무게 250', 0.73, 250), ('보통 · 무게 445', 0.73, 445)]
    COLS = [('지금', '지금'), ('가', '가 · 빗금 틈을 글 획에 맞춰 가늘게'), ('나', '나 · 글 둘레를 넓게 비움'), ('다', '다 · 가 + 나')]
    CW, RHs, LW = 380, [150, 200, 200], 190
    cv_ = Image.new('RGB', (LW + CW * 4 + 10, 110 + sum(RHs) + 30 * 3), BG); dr = ImageDraw.Draw(cv_)
    dr.text((20, 14), '결 10 — 어느 칸이 글이 빗금보다 먼저 읽히면서 돌의 결도 남나?', font=fb, fill=(255, 255, 255))
    dr.text((20, 50), '가는 글(차분한 무게 250 · 445)에서 고치는 법 넷. 칸 아래 = 빗금의 검은 틈 굵기(지금은 2.3px)', font=fs, fill=(170, 170, 170))
    for c, (_, h) in enumerate(COLS): dr.text((LW + c * CW, 80), h, font=fm, fill=(235, 235, 235))
    y = 110
    for r, (lab, fill, w) in enumerate(ROWS):
        size = D9.SIDE * D9.UNIT * fill * D9.SCALE
        dr.text((20, y + RHs[r] // 2 - 10), lab, font=fm, fill=(235, 235, 235))
        for c, (md, _) in enumerate(COLS):
            img, gap = render(size, w, md); h, ww = img.shape[:2]
            cv_.paste(Image.fromarray(img), (LW + c * CW, y + RHs[r] - h))
            dr.text((LW + c * CW, y + RHs[r] + 4), f'빗금 틈 {gap:.1f}px', font=fs, fill=(140, 140, 140))
        y += RHs[r] + 30
    cv_.save(os.path.join(G.OUT, 'tex-text-fix-10.png')); print('저장', cv_.size)
