# 결 격자 4 — 작은 명암 조각 정리. 돌 셋(5번 · 12번 · 달 — 조각이 거슬린다) × 정리 넷(지금 · 약 · 중 · 강)
# 정리 = 명암을 더 넓게 뭉갠 뒤 자르고(σ) · 돌 넓이의 a%보다 작은 그늘 조각은 걷고 · 그늘 안의 a%보다 작은 틈은 메운다
# 나무의 '속 메우기'(갇힌 빈틈 중 넓이 0.4% 아래)와 같은 손. 글 둘레는 정리한 뒤에 걷고, 그때 생긴 부스러기도 다시 걷는다
import cv2, numpy as np, os
from PIL import Image, ImageDraw, ImageFont
import grid1 as G, grid3 as G3

BG = G.BG; SS = G.SS


def drop_small(r, minpx):
    n, lb, st, _ = cv2.connectedComponentsWithStats(r.astype(np.uint8), 8)
    keep = np.zeros(n, bool); keep[1:] = st[1:, 4] >= minpx
    return keep[lb]


def fill_small(r, m, minpx):
    holes = (m > 0) & ~r
    n, lb, st, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8), 4)
    # 돌 가장자리에 닿은 틈은 틈이 아니라 그늘 밖 — 메우지 않는다
    edge = cv2.dilate((m == 0).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    touch = np.zeros(n, bool); touch[np.unique(lb[edge & holes])] = True
    fill = np.zeros(n, bool); fill[1:] = (st[1:, 4] < minpx) & ~touch[1:]
    return r | fill[lb]


def region(m, d, fade, sig, frac):
    r = (cv2.GaussianBlur(d, (0, 0), sig * SS) > 0.5) & (m > 0)
    area = (m > 0).sum()
    if frac:
        r = drop_small(r, frac * area); r = fill_small(r, m, frac * area)
    r &= fade > 0.5                                      # 글 둘레를 둥글게 걷는다
    if frac: r = drop_small(r, frac * area * 0.5)        # 걷으며 생긴 부스러기
    else:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * SS + 1,) * 2)
        r = cv2.morphologyEx(cv2.morphologyEx(r.astype(np.uint8), cv2.MORPH_OPEN, k), cv2.MORPH_CLOSE, k) > 0
    return r


def render(name, H, flip, relight, level, paint='#CCC1BA', ink='#2B2B2B', lines=('여기서 크게 말해본 적', '없다')):
    sig, frac = level
    m, d, W, H = G3.fields(name, H, flip, relight)
    g, fade = G.text_mask(m, list(lines), 16)
    cut = G.hatch_region(region(m, d, fade, sig, frac))
    out = np.zeros(m.shape + (3,), np.float32); out[:] = BG
    out[(m > 0) & ~cut] = G.hexrgb(paint)
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(ink), np.float32) * a
    return np.clip(cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


LEVELS = [('지금 — 뭉갬 1.5px · 2px 부스러기만', (1.5, 0)), ('약 — 뭉갬 2px · 조각 0.5% 아래 걷기', (2.0, 0.005)),
          ('중 — 뭉갬 3px · 조각 1.5% 아래', (3.0, 0.015)), ('강 — 뭉갬 4.5px · 조각 3% 아래', (4.5, 0.03))]

if __name__ == '__main__':
    names = ['stone-c', 'stone-d', 'stone-moon']
    HS, CW, RH = 150, 440, 200
    Wimg, Himg = 130 + CW * len(LEVELS) + 10, 96 + RH * len(names)
    cv_ = Image.new('RGB', (Wimg, Himg), BG); dr = ImageDraw.Draw(cv_)
    fb = ImageFont.truetype(G.FONT_SANS, 22); fb.set_variation_by_axes([700])
    fs = ImageFont.truetype(G.FONT_SANS, 14); fs.set_variation_by_axes([400])
    fm = ImageFont.truetype(G.FONT_SANS, 15); fm.set_variation_by_axes([600])
    dr.text((20, 14), '결 4 — 작은 명암 조각 정리 (빛 오른쪽 위 · 빗금 C)', font=fb, fill=(255, 255, 255))
    dr.text((20, 46), '물음: 어느 칸부터 작은 조각이 거슬리지 않으면서, 아직 돌의 면 · 결로 읽히나', font=fs, fill=(190, 190, 190))
    for c, (h, _) in enumerate(LEVELS): dr.text((130 + c * CW, 72), h, font=fm, fill=(235, 235, 235))
    for r, n in enumerate(names):
        y = 96 + r * RH; fl = G3.LIGHT[n] != G3.WALL
        dr.text((20, y + RH // 2 - 10), G3.NAME[n], font=fm, fill=(235, 235, 235))
        for c, (_, lv) in enumerate(LEVELS):
            img = render(n, HS, fl, False, lv)
            cv_.paste(Image.fromarray(img), (130 + c * CW, y + RH - 14 - img.shape[0]))
        dr.line([(20, y + RH + 2), (Wimg - 20, y + RH + 2)], fill=(50, 50, 50))
    cv_.save(os.path.join(G.OUT, 'tex-clean-4.png')); print('저장', cv_.size)
