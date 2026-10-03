# 결 격자 6다 — 그늘 양: 사진에서 가장 어두운 몇 %까지를 그늘로 치나(정리 ② · 흔들림 '미세'). 지금은 약 30%
import cv2, numpy as np, os
from PIL import Image, ImageDraw
import grid1 as G, grid3 as G3, grid4 as G4, grid6 as G6

SS, BG = G.SS, G.BG


def region_q(m, d, fade, sig, frac, wob, seed, q):
    A, r, wv, edge = wob
    dd = cv2.GaussianBlur(d, (0, 0), sig * SS)
    if edge: dd = dd + edge * G6.noise(m.shape, 1.2, seed + 7)
    thr = np.percentile(dd[m > 0], 100 - q)
    rg = (dd > max(thr, 1e-3)) & (m > 0)
    area = (m > 0).sum()
    rg = G4.drop_small(rg, frac * area); rg = G4.fill_small(rg, m, frac * area)
    rg &= fade > 0.5
    return G4.drop_small(rg, frac * area * 0.5)


def render(name, H, flip, q, level=(3.75, 0.0225), wob=G6.WOB['미세'], seed=11):
    m, d, W, H = G3.fields(name, H, flip, True)
    g, fade = G.text_mask(m, ['여기서 크게 말해본 적', '없다'], 16)
    rg = region_q(m, d, fade, *level, wob, seed, q)
    cover = rg.sum() / (m > 0).sum()
    cut = G6.hatch(rg, wob, seed)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = BG
    out[(m > 0) & ~cut] = G.hexrgb('#CCC1BA')
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb('#2B2B2B'), np.float32) * a
    return np.clip(cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8), cover


if __name__ == '__main__':
    fb, fs, fm = G6.fonts(); HS, CW, RH = 150, 420, 230
    QS = [(30, '30%'), (40, '40%'), (50, '50%')]
    cv_ = Image.new('RGB', (20 + CW * len(G6.CAST), 90 + RH * len(QS)), BG); dr = ImageDraw.Draw(cv_)
    dr.text((20, 14), "결 6다 — 그늘 양: 사진에서 가장 어두운 몇 %까지 그늘로 치나 (정리 ② · 흔들림 '미세')", font=fb, fill=(255, 255, 255))
    dr.text((20, 46), '물음: 어느 줄이 전체적으로 그늘이 알맞은가 — 돌마다 제 사진 안에서 어두운 순서로 센다 · 칸 아래 숫자 = 정리 뒤 실제로 빗금이 든 몫', font=fs, fill=(190, 190, 190))
    for r, (q, lab) in enumerate(QS):
        y = 90 + r * RH
        dr.text((20, y), f'어두운 {lab}', font=fm, fill=(235, 235, 235))
        for c, (n, fl, nl) in enumerate(G6.CAST):
            img, cov = render(n, HS, fl, q); h, w = img.shape[:2]
            cv_.paste(Image.fromarray(img), (20 + c * CW, y + RH - 30 - h))
            dr.text((20 + c * CW, y + RH - 26), f'{nl} · 빗금 {cov * 100:.0f}%', font=fs, fill=(130, 130, 130))
        dr.line([(20, y + RH - 4), (cv_.size[0] - 20, y + RH - 4)], fill=(50, 50, 50))
    cv_.save(os.path.join(G.OUT, 'tex-amount-6c.png')); print('저장', cv_.size)
