# 결 격자 13 — 차분한 '가장 굵게'를 900 넘어: 900 + 같은 색 획 덧대기(앱의 --optical-stroke, paint-order: stroke fill — 다정한과 같은 장치)
# 무게 100 ≈ 획 평균 +0.0093em(본명조 550 → 900을 재서). 덧댄 획 폭 w em이면 글자 획이 w em 굵어진다(바깥 반만 보인다)
# 줄 = 900 · 1000쯤 · 1100쯤 · 1200쯤, 칸 = 벽 보통(16px) · 벽 가장 크게(22px) · 폰처럼 크게(46px, 속공간이 막히나)
import cv2, numpy as np, os
from PIL import Image, ImageDraw, ImageFont
import grid1 as G, grid6 as G6, grid6c as G6c, grid8 as G8, diag9 as D9, fix10 as F10

SS, BG = G.SS, G.BG
WOB = G6.WOB['미세']
PER100 = 0.0093
ROWS = [('지금 900', 0.0), ('1000쯤', PER100), ('1100쯤', 2 * PER100), ('1200쯤', 3 * PER100)]
PAINT, INK = '#CCC1BA', '#2B2B2B'


def thicken(g, add_px):
    """글자 판(0~255)을 바깥으로 add_px/2만큼(배율 SS 화소) 두껍게 — 거리로 부분 덮임까지"""
    if add_px <= 0: return g
    r = add_px / 2
    dist = cv2.distanceTransform((g < 128).astype(np.uint8), cv2.DIST_L2, 5)
    cov = np.clip(r - dist + 0.5, 0, 1) * 255
    return np.maximum(g.astype(np.float32), cov)


def text_mask_thick(m, lines, size, w_em):
    got = D9.text_mask_w(m, lines, size, 900)
    if not got: return None
    g, _ = got
    g = thicken(g, w_em * size * SS)
    dist = cv2.distanceTransform((g <= 40).astype(np.uint8), cv2.DIST_L2, 5)
    fade = np.clip((dist - 0.5 * size * SS) / (1.3 * size * SS), 0, 1); fade = fade * fade * (3 - 2 * fade)
    return g, fade


def stone_cell(size, w_em, name='stone-moon', flip=True, lines=('여기서 크게 말해본 적', '없다')):
    H = round(150 * size / 15.8)
    while True:
        m, d, W, H2 = G8.fields(name, H, flip, G8.OWOB['미세'])
        got = text_mask_thick(m, list(lines), size, w_em)
        if got: break
        H += 4
    g, fade = got
    rg = G6c.region_q(m, d, fade, 3.75, 0.0225, WOB, 11, 35)
    gap = min(G.GAP / np.sqrt(2), 1.6 * (D9.stroke_px(size, 900) + w_em * size))
    cut = F10.hatch_gap(rg, gap)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = BG
    out[(m > 0) & ~cut] = G.hexrgb(PAINT)
    a = (np.clip(g, 0, 255) / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(INK), np.float32) * a
    return np.clip(cv2.resize(out, (W, H2), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


def big_cell(w_em, size=46, text='말해본 적 없다'):
    K = 4; f = ImageFont.truetype(G.FONT_SERIF, size * K); f.set_variation_by_axes([900])
    Wt = int(f.getlength(text)) + 40 * K; Ht = int(size * 2.0 * K)
    img = Image.new('L', (Wt, Ht), 0); ImageDraw.Draw(img).text((20 * K, int(0.35 * size * K)), text, font=f, fill=255)
    g = thicken(np.array(img), w_em * size * K)
    out = np.zeros((Ht, Wt, 3), np.float32); out[:] = G.hexrgb(PAINT)
    a = (np.clip(g, 0, 255) / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(INK), np.float32) * a
    return np.clip(cv2.resize(out, (Wt // K, Ht // K), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


if __name__ == '__main__':
    fb = ImageFont.truetype(G.FONT_SANS, 24); fb.set_variation_by_axes([700])
    fl = ImageFont.truetype(G.FONT_SANS, 26); fl.set_variation_by_axes([800])
    fm = ImageFont.truetype(G.FONT_SANS, 16); fm.set_variation_by_axes([600])
    fs = ImageFont.truetype(G.FONT_SANS, 13); fs.set_variation_by_axes([400])
    sizes = [('벽 · 보통 (16px)', 0.73), ('벽 · 가장 크게 (22px)', 1.0)]
    CW, BW, RH, LW = 490, 470, 230, 170
    cv_ = Image.new('RGB', (LW + CW * 2 + BW + 20, 110 + RH * len(ROWS)), BG); dr = ImageDraw.Draw(cv_)
    dr.text((20, 14), "결 13 — 차분한 '가장 굵게'를 900 넘어 (같은 색 획을 덧대어)", font=fb, fill=(255, 255, 255))
    dr.text((20, 50), '물음: 어느 줄까지 더 굵어도 글자 속(ㅁ · ㅂ · ㅇ의 빈 곳)이 막히지 않고 본명조로 읽히나 — 오른쪽 칸은 폰처럼 크게', font=fs, fill=(170, 170, 170))
    for c, (h, _) in enumerate(sizes): dr.text((LW + c * CW, 82), h, font=fm, fill=(235, 235, 235))
    dr.text((LW + 2 * CW, 82), '폰처럼 크게 (46px)', font=fm, fill=(235, 235, 235))
    for r, (lab, w) in enumerate(ROWS):
        y = 110 + r * RH
        dr.text((20, y + 60), lab, font=fl, fill=(255, 255, 255))
        dr.text((20, y + 98), f'획 +{w:.3f}em', font=fs, fill=(150, 150, 150))
        for c, (_, fill) in enumerate(sizes):
            size = D9.SIDE * D9.UNIT * fill * D9.SCALE
            img = stone_cell(size, w); h, ww = img.shape[:2]
            cv_.paste(Image.fromarray(img), (LW + c * CW, y + RH - 20 - h))
        b = big_cell(w); cv_.paste(Image.fromarray(b), (LW + 2 * CW, y + (RH - b.shape[0]) // 2))
        dr.line([(20, y + RH - 6), (cv_.size[0] - 20, y + RH - 6)], fill=(55, 55, 55))
    cv_.save(os.path.join(G.OUT, 'tex-heavy-13.png')); print('저장', cv_.size)
