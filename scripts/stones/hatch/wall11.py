# 결 격자 11 — '가'(빗금 틈 ≤ 글 획 × 1.5)로 굵은 글 · 가는 글의 돌을 벽처럼 나란히. 위 = 모두 돌빛, 아래 = 차분한 색을 섞어
import cv2, numpy as np, os
from PIL import Image, ImageDraw, ImageFont
import grid1 as G, grid6 as G6, grid6c as G6c, grid8 as G8, diag9 as D9, fix10 as F10

SS, BG = G.SS, G.BG
WOB = G6.WOB['미세']
PAL = {'남색': ('#1E3655', '#FFE600'), '돌빛': ('#CCC1BA', '#2B2B2B'), '진홍': ('#801420', '#FFFFFF'), '연청': ('#B5D0F2', '#1E3655'),
       '짙은 초록': ('#134329', '#FFFFFF'), '보라': ('#3E315A', '#FFFFFF')}
# (돌, 뒤집음, 무게, 크기 막대, 글, 아래 줄 색)
CAST = [('stone-a', False, 900, 0.73, ['괜찮아'], '남색'),
        ('stone-b', True, 250, 0.47, ['조용히 오래', '생각했다'], '돌빛'),
        ('stone-c', False, 445, 0.73, ['오늘은 아무 말도', '하고 싶지 않았다'], '진홍'),
        ('stone-d', True, 900, 1.0, ['사흘 뒤면 사라질', '말이라서 더', '솔직하게'], '연청'),
        ('stone-moon', True, 250, 0.73, ['여기서 크게 말해본 적', '없다'], '짙은 초록'),
        ('stone-b', False, 445, 0.47, ['그래도 내일은', '올 거야'], '보라')]


def render(name, flip, wght, fill, lines, paint, ink):
    size = D9.SIDE * D9.UNIT * fill * D9.SCALE
    H = round(150 * size / 15.8 * (0.8 if len(lines) == 1 else 1))
    while True:
        m, d, W, H2 = G8.fields(name, H, flip, G8.OWOB['미세'])
        got = D9.text_mask_w(m, list(lines), size, wght)
        if got: break
        H += 4
    g, fade = got
    rg = G6c.region_q(m, d, fade, 3.75, 0.0225, WOB, 11, 35)
    gap = min(G.GAP / np.sqrt(2), 1.6 * D9.stroke_px(size, wght))   # 획 평균으로 재며 1.6(뼈대 가운데값으로 1.5와 같은 틈)
    cut = F10.hatch_gap(rg, gap)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = BG
    out[(m > 0) & ~cut] = G.hexrgb(paint)
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(ink), np.float32) * a
    return np.clip(cv2.resize(out, (W, H2), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8), gap, size


if __name__ == '__main__':
    fb = ImageFont.truetype(G.FONT_SANS, 24); fb.set_variation_by_axes([700])
    fm = ImageFont.truetype(G.FONT_SANS, 16); fm.set_variation_by_axes([600])
    fs = ImageFont.truetype(G.FONT_SANS, 13); fs.set_variation_by_axes([400])
    STRIP = 330
    cv_ = Image.new('RGB', (1920, 90 + 2 * (STRIP + 60)), BG); dr = ImageDraw.Draw(cv_)
    dr.text((20, 14), "결 11 — '가'로 굵은 글 · 가는 글의 돌을 나란히 (벽 1920px 폭 그대로)", font=fb, fill=(255, 255, 255))
    dr.text((20, 50), '물음: 나란히 섰을 때 결의 진하기가 서로 달라도 자연스러운가 — 한 벽의 돌로 읽히나', font=fs, fill=(170, 170, 170))
    for r, (lab, colored) in enumerate([('같은 색(돌빛) — 결의 진하기만 비교', False), ('실제처럼 색을 섞어', True)]):
        y0 = 90 + r * (STRIP + 60); ground = y0 + STRIP
        dr.text((20, y0), lab, font=fm, fill=(235, 235, 235))
        imgs = []
        for (n, fl, w, fill, lines, col) in CAST:
            paint, ink = PAL[col] if colored else PAL['돌빛']
            imgs.append((render(n, fl, w, fill, lines, paint, ink), w, fill, col))
        total = sum(i[0][0].shape[1] for i in imgs); gapx = (1920 - 40 - total) / (len(imgs) - 1)
        x = 20.0
        for (img, gap, size), w, fill, col in imgs:
            h, ww = img.shape[:2]
            cv_.paste(Image.fromarray(img), (int(x), ground - h))
            dr.text((int(x), ground + 6), f'무게 {w} · 글자 {size:.0f}px' + (f' · {col}' if colored else ''), font=fs, fill=(130, 130, 130))
            dr.text((int(x), ground + 24), f'빗금 틈 {gap:.1f}px', font=fs, fill=(130, 130, 130))
            x += ww + gapx
        dr.line([(0, ground), (1920, ground)], fill=(60, 60, 60))
    cv_.save(os.path.join(G.OUT, 'tex-wall-11.png')); print('저장', cv_.size)
