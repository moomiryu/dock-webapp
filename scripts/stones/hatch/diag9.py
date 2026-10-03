# 결 격자 9 — 글이 빗금보다 뒤로 밀리나. 차분한 글자 크기 셋(크기 막대 가장 작게 · 보통 · 가장 크게) × 무게 셋(250 · 445 · 900)
# 돌은 글에 맞춰 커지고 작아진다(앱처럼) — 빗금 칸은 벽에 고정(5px)이라 작은 글일수록 빗금이 상대적으로 무겁다
import cv2, numpy as np, os
from PIL import Image, ImageDraw, ImageFont
import grid1 as G, grid6 as G6, grid6c as G6c, grid8 as G8

SS, BG = G.SS, G.BG
SIZES = [('가장 작게', 0.47), ('보통', 0.73), ('가장 크게', 1.0)]     # 크기 막대(SIZE_FILLS)
WEIGHTS = [250, 445, 900]
SIDE, UNIT, SCALE = 401.76, 0.074, 0.73                             # 벽 한 변 · UNIT_TOP · 차분한 opticalFix


def text_mask_w(m, lines, size, wght):
    Hs, Ws = m.shape; f = ImageFont.truetype(G.FONT_SERIF, round(size * SS)); f.set_variation_by_axes([wght])
    lh = size * 1.55 * SS; tw = max(f.getlength(t) for t in lines); th = lh * len(lines)
    pad = int(0.7 * size * SS)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (int(tw + 2 * pad) | 1, int(th + 2 * pad) | 1))
    ok = cv2.erode(m, k); ys, xs = np.nonzero(ok)
    if not len(xs): return None
    my, mx = np.nonzero(m); cy, cx = my.mean() + 0.08 * Hs, mx.mean()
    i = np.argmin((xs - cx) ** 2 + ((ys - cy) * 1.2) ** 2); X, Y = xs[i] - tw / 2, ys[i] - th / 2
    img = Image.new('L', (Ws, Hs), 0); dr = ImageDraw.Draw(img)
    for j, t in enumerate(lines): dr.text((X, Y + j * lh + (lh - size * SS) / 2), t, font=f, fill=255)
    g = np.array(img)
    dist = cv2.distanceTransform((g <= 40).astype(np.uint8), cv2.DIST_L2, 5)
    fade = np.clip((dist - 0.5 * size * SS) / (1.3 * size * SS), 0, 1); fade = fade * fade * (3 - 2 * fade)
    return g, fade


def stroke_px(size, wght):
    """획 굵기 평균(벽 px) — 크게 그린 글자의 잉크 넓이 × 2 ÷ 둘레(가로 · 세로 획을 고루). 뼈대 거리의 가운데값은 들쭉날쭉했다"""
    f = ImageFont.truetype(G.FONT_SERIF, 200); f.set_variation_by_axes([wght])
    T = '여기서 크게 말해본'
    img = Image.new('L', (int(f.getlength(T)) + 40, 300), 0); ImageDraw.Draw(img).text((20, 20), T, font=f, fill=255)
    a = (np.array(img) > 127).astype(np.uint8)
    cs, _ = cv2.findContours(a, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    return float(2 * a.sum() / sum(cv2.arcLength(c, True) for c in cs) * size / 200)


def render(name, flip, size, wght, lines=('여기서 크게 말해본 적', '없다')):
    H = round(150 * size / 15.8)
    while True:
        m, d, W, H2 = G8.fields(name, H, flip, G8.OWOB['미세'])
        got = text_mask_w(m, list(lines), size, wght)
        if got: break
        H += 4
    g, fade = got
    rg = G6c.region_q(m, d, fade, 3.75, 0.0225, G6.WOB['미세'], 11, 35)
    cut = G6.hatch(rg, G6.WOB['미세'], 11)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = BG
    out[(m > 0) & ~cut] = G.hexrgb('#CCC1BA')
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb('#2B2B2B'), np.float32) * a
    return np.clip(cv2.resize(out, (W, H2), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


if __name__ == '__main__':
    fb = ImageFont.truetype(G.FONT_SANS, 24); fb.set_variation_by_axes([700])
    fm = ImageFont.truetype(G.FONT_SANS, 16); fm.set_variation_by_axes([600])
    fs = ImageFont.truetype(G.FONT_SANS, 14); fs.set_variation_by_axes([400])
    gap = G.GAP / np.sqrt(2)
    CW, RHs, LW = 470, [150, 200, 260], 150
    cv_ = Image.new('RGB', (LW + CW * 3 + 10, 110 + sum(RHs) + 30 * 3), BG); dr = ImageDraw.Draw(cv_)
    dr.text((20, 14), '결 9 — 글이 빗금보다 뒤로 밀리나? (차분한 · 돌빛 · 달 · 벽 실제 화소)', font=fb, fill=(255, 255, 255))
    dr.text((20, 50), f'빗금 줄 사이 검은 틈은 글 크기와 상관없이 {gap:.1f}px. 칸 아래 = 글자 크기 · 획 굵기(가운데값).', font=fs, fill=(170, 170, 170))
    for c, w in enumerate(WEIGHTS): dr.text((LW + c * CW, 80), f'무게 {w}' + (' (가장 가늘게)' if w == 250 else ' (가장 굵게)' if w == 900 else ''), font=fm, fill=(235, 235, 235))
    y = 110
    for r, (lab, fill) in enumerate(SIZES):
        size = SIDE * UNIT * fill * SCALE
        dr.text((20, y + RHs[r] // 2 - 10), lab, font=fm, fill=(235, 235, 235))
        for c, w in enumerate(WEIGHTS):
            img = render('stone-moon', True, size, w); h, ww = img.shape[:2]
            cv_.paste(Image.fromarray(img), (LW + c * CW, y + RHs[r] - h))
            dr.text((LW + c * CW, y + RHs[r] + 4), f'글자 {size:.1f}px · 획 {stroke_px(size, w):.2f}px', font=fs, fill=(140, 140, 140))
        y += RHs[r] + 30
    cv_.save(os.path.join(G.OUT, 'tex-text-9.png')); print('저장', cv_.size)
    for lab, fill in SIZES:
        size = SIDE * UNIT * fill * SCALE
        print(lab, f'{size:.1f}px', [f'{stroke_px(size, w):.2f}' for w in WEIGHTS])
