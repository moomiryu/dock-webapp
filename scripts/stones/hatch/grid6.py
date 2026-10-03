# 결 격자 6 — (가) 빗금 흔들림 세기: 없음 · 아주 미세 · 미세 · 조금  (나) '중'과 '강' 사이 셋 × 돌 다섯(흔들림 '미세')
# 흔들림 = 줄이 따라 흐르는 자리를 낮은 결의 잡음으로 밀고(구불) + 잔 잡음으로 가장자리를 거칠게 + 굵기를 조금 오르내림.
# 그늘 덩이의 테두리도 같은 잔 잡음으로 거칠게 — 뭉갠 덩이의 매끈한 테두리가 사진 돌 위에서 어색했다
import cv2, numpy as np, os
from PIL import Image, ImageDraw, ImageFont
import grid1 as G, grid3 as G3, grid4 as G4

SS, BG, P, WP = G.SS, G.BG, G.P, G.WP
_N = {}


def noise(shape, sig, seed):
    key = (shape, sig, seed)
    if key not in _N:
        r = np.random.default_rng(seed).standard_normal(shape).astype(np.float32)
        n = cv2.GaussianBlur(r, (0, 0), sig * SS); _N[key] = n / (n.std() + 1e-6)
    return _N[key]


WOB = {'없음': (0, 0, 0, 0), '아주 미세': (0.35, 0.12, 0.06, 0.03), '미세': (0.7, 0.2, 0.1, 0.05), '조금': (1.2, 0.3, 0.15, 0.08)}
# (구불 px, 잔 거칠기 px, 굵기 오르내림 몫, 테두리 거칠기 — d에 더하는 몫)


def region(m, d, fade, sig, frac, wob, seed):
    A, r, wv, edge = wob
    dd = cv2.GaussianBlur(d, (0, 0), sig * SS)
    if edge: dd = dd + edge * noise(m.shape, 1.2, seed + 7)
    rg = (dd > 0.5) & (m > 0)
    area = (m > 0).sum()
    rg = G4.drop_small(rg, frac * area); rg = G4.fill_small(rg, m, frac * area)
    rg &= fade > 0.5
    return G4.drop_small(rg, frac * area * 0.5)


def hatch(rg, wob, seed):
    A, r, wv, edge = wob
    Hs, Ws = rg.shape; yy, xx = np.mgrid[0:Hs, 0:Ws]
    u = (xx + yy) / SS
    if A or r: u = u + A * noise(rg.shape, 6, seed) + r * noise(rg.shape, 0.7, seed + 1)
    w = WP * (1 + wv * noise(rg.shape, 4, seed + 2)) if wv else WP
    return rg & ((u % P) >= w)


def render(name, H, flip, level, wob, seed=11, paint='#CCC1BA', ink='#2B2B2B', lines=('여기서 크게 말해본 적', '없다')):
    sig, frac = level
    m, d, W, H = G3.fields(name, H, flip, True)
    g, fade = G.text_mask(m, list(lines), 16)
    cut = hatch(region(m, d, fade, sig, frac, wob, seed), wob, seed)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = BG
    out[(m > 0) & ~cut] = G.hexrgb(paint)
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(ink), np.float32) * a
    return np.clip(cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


def fonts():
    fb = ImageFont.truetype(G.FONT_SANS, 22); fb.set_variation_by_axes([700])
    fs = ImageFont.truetype(G.FONT_SANS, 14); fs.set_variation_by_axes([400])
    fm = ImageFont.truetype(G.FONT_SANS, 15); fm.set_variation_by_axes([600])
    return fb, fs, fm


def sheet_wobble():
    fb, fs, fm = fonts(); keys = list(WOB); CW = 400
    cv_ = Image.new('RGB', (20 + CW * len(keys), 560), BG); dr = ImageDraw.Draw(cv_)
    dr.text((20, 14), '결 6가 — 빗금 흔들림 세기 (달 · 뒤집음 · 정리 \'강\')', font=fb, fill=(255, 255, 255))
    dr.text((20, 46), '물음: 어느 칸이 손으로 그은 줄처럼 자연스러운가 — 위는 벽 실제 크기, 아래는 3배 확대', font=fs, fill=(190, 190, 190))
    for c, k in enumerate(keys):
        img = render('stone-moon', 150, True, G4.LEVELS[3][1], WOB[k]); h, w = img.shape[:2]
        x = 20 + c * CW
        dr.text((x, 74), k, font=fm, fill=(235, 235, 235))
        cv_.paste(Image.fromarray(img), (x, 100 + 150 - h))
        crop = Image.fromarray(img).crop((10, 30, 130, 120)).resize((360, 270), Image.NEAREST)
        cv_.paste(crop, (x, 270))
    return cv_


MID = [('중과 강 사이 ① — 뭉갬 3.4px · 조각 1.9% 아래', (3.4, 0.019)), ('② — 뭉갬 3.75px · 조각 2.25% 아래', (3.75, 0.0225)),
       ('③ — 뭉갬 4.1px · 조각 2.6% 아래', (4.1, 0.026))]
CAST = [('stone-a', False, '1번 · 원래'), ('stone-b', True, '2번 · 뒤집음'), ('stone-c', True, '5번 · 뒤집음'),
        ('stone-d', False, '12번 · 원래'), ('stone-moon', True, '달 · 뒤집음')]


def sheet_levels():
    fb, fs, fm = fonts(); HS = 150; CW, RH = 420, 220
    cv_ = Image.new('RGB', (20 + CW * len(CAST), 90 + RH * len(MID)), BG); dr = ImageDraw.Draw(cv_)
    dr.text((20, 14), "결 6나 — '중'과 '강' 사이 셋 × 돌 다섯 (흔들림 '미세' · 빛 오른쪽 위)", font=fb, fill=(255, 255, 255))
    dr.text((20, 46), '물음: 어느 줄이 전체적으로 그늘이 알맞은가 — 작은 조각은 거슬리지 않으면서 너무 비지도 않게', font=fs, fill=(190, 190, 190))
    for r, (lab, lv) in enumerate(MID):
        y = 90 + r * RH
        dr.text((20, y), lab, font=fm, fill=(235, 235, 235))
        for c, (n, fl, nl) in enumerate(CAST):
            img = render(n, HS, fl, lv, WOB['미세']); h, w = img.shape[:2]
            cv_.paste(Image.fromarray(img), (20 + c * CW, y + RH - 26 - h))
            dr.text((20 + c * CW, y + RH - 22), nl, font=fs, fill=(130, 130, 130))
        dr.line([(20, y + RH - 2), (cv_.size[0] - 20, y + RH - 2)], fill=(50, 50, 50))
    return cv_


if __name__ == '__main__':
    sheet_wobble().save(os.path.join(G.OUT, 'tex-wobble-6a.png'))
    sheet_levels().save(os.path.join(G.OUT, 'tex-levels-6b.png'))
    print('저장')
