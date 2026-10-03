# 결 격자 3 — 벽의 빛 하나(오른쪽 위). 돌 다섯 × (빛이 맞는 쪽 · 반대쪽에 큰 명암을 다시 얹은 판). 무늬는 고른 C(사진 그늘 면 ／)
# 큰 명암 다시 얹기: 사진 밝기 = 큰 명암(넓게 뭉갠 판, 빛) + 잔 결(면 · 금). 뒤집을 때 잔 결만 뒤집고 큰 명암은 제자리에 둔다
import cv2, numpy as np, json, os
from PIL import Image, ImageDraw, ImageFont
import grid1 as G

REPO, SS, BG, S = G.REPO, G.SS, G.BG, G.S
LIGHT = {'stone-a': 'L', 'stone-b': 'R', 'stone-c': 'R', 'stone-d': 'R', 'stone-moon': 'L'}   # 사진의 빛(잰 값)
NAME = {'stone-a': '1번', 'stone-b': '2번', 'stone-c': '5번', 'stone-d': '12번', 'stone-moon': '달'}
WALL = 'R'


def fill_out(v, m, sig):
    """마스크 밖까지 이어지게 넓게 뭉갠 판(마스크 안 값만으로)"""
    num = cv2.GaussianBlur(v * m, (0, 0), sig); den = cv2.GaussianBlur(m.astype(np.float32), (0, 0), sig)
    return num / np.maximum(den, 1e-4)


def fields(name, H, flip, relight):
    s = S[name]; W = round(H * s['w'] / s['h'])
    im = cv2.imread(f'{REPO}/design/stone-photo/src/{name}.jpg'); sh = cv2.imread(f'{REPO}/design/stone-photo/shape/{name}.png', 0)
    ys, xs = np.nonzero(sh > 127); x0, y0 = xs.min(), ys.min()
    crop = im[y0:y0 + s['h'], x0:x0 + s['w']]
    Ws, Hs = W * SS, H * SS
    pts = np.array(s['points'], np.float32)
    pts[:, 0] = (pts[:, 0] - pts[:, 0].min()) / (pts[:, 0].max() - pts[:, 0].min()) * (Ws - 1)
    pts[:, 1] = (pts[:, 1] - pts[:, 1].min()) / (pts[:, 1].max() - pts[:, 1].min()) * (Hs - 1)
    m = np.zeros((Hs, Ws), np.uint8); cv2.fillPoly(m, [pts.astype(np.int32)], 1)
    L = cv2.cvtColor(cv2.resize(crop, (Ws, Hs), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2LAB)[:, :, 0].astype(np.float32)
    L = cv2.GaussianBlur(L, (0, 0), 1.2 * SS)
    if relight:
        # 잔 결(면 · 금)은 돌과 함께 뒤집고, 큰 명암(빛)은 늘 벽의 빛 쪽에서 오게 — 사진 빛이 벽과 같으면 그대로, 반대면 거울로.
        # 빛이 맞는 방향이면 결과는 사진 그대로(또는 통째로 뒤집은 것)와 같다
        sig = 0.15 * Ws
        low = fill_out(L, m, sig); det = L - low
        tgt = low if LIGHT[name] == WALL else low[:, ::-1]
        L = (det[:, ::-1] if flip else det) + tgt
    elif flip:
        L = L[:, ::-1].copy()
    if flip: m = m[:, ::-1].copy()
    inside = L[m > 0]; lo, hi = np.percentile(inside, 5), np.percentile(inside, 55)
    d = np.clip((hi - L) / (hi - lo), 0, 1) ** 1.2
    return m, d, W, H


def render(name, H, flip, relight, paint, ink, lines):
    m, d, W, H = fields(name, H, flip, relight)
    g, fade = G.text_mask(m, lines, 16)
    cut = G.v_face(m, d * fade, None, H) & (fade > 0.35)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = BG
    out[(m > 0) & ~cut] = G.hexrgb(paint)
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(ink), np.float32) * a
    return np.clip(cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


if __name__ == '__main__':
    names = ['stone-a', 'stone-b', 'stone-c', 'stone-d', 'stone-moon']
    HS, CW, RH = 150, 470, 200
    paint, ink, lines = '#CCC1BA', '#2B2B2B', ['여기서 크게 말해본 적', '없다']
    Wimg, Himg = 160 + CW * 3 + 20, 96 + RH * len(names)
    cv_ = Image.new('RGB', (Wimg, Himg), BG); dr = ImageDraw.Draw(cv_)
    fb = ImageFont.truetype(G.FONT_SANS, 22); fb.set_variation_by_axes([700])
    fs = ImageFont.truetype(G.FONT_SANS, 14); fs.set_variation_by_axes([400])
    fm = ImageFont.truetype(G.FONT_SANS, 15); fm.set_variation_by_axes([600])
    dr.text((20, 14), '결 3 — 벽의 빛 하나(오른쪽 위 ↙). 무늬는 고른 C', font=fb, fill=(255, 255, 255))
    dr.text((20, 46), '물음: 가운데(반대쪽 · 큰 명암 다시)가 왼쪽(사진 그대로)만큼 자연스러운가 — 그렇다면 돌 모양 열 가지를 그대로 쓴다', font=fs, fill=(190, 190, 190))
    heads = ['빛이 맞는 쪽 — 사진 그대로', '반대쪽 · 큰 명암 다시 얹음', '(참고) 반대쪽 · 명암까지 뒤집힘']
    for c, h in enumerate(heads): dr.text((160 + c * CW, 72), h, font=fm, fill=(235, 235, 235) if c < 2 else (130, 130, 130))
    for r, n in enumerate(names):
        y = 96 + r * RH
        ok_flip = LIGHT[n] != WALL       # 사진 빛이 벽과 반대면 뒤집어야 맞는다
        dr.text((20, y + RH // 2 - 20), NAME[n], font=fm, fill=(235, 235, 235))
        dr.text((20, y + RH // 2), f"사진 빛: {'왼쪽' if LIGHT[n] == 'L' else '오른쪽'} 위", font=fs, fill=(140, 140, 140))
        cells = [(ok_flip, False), (not ok_flip, True), (not ok_flip, False)]
        for c, (fl, rl) in enumerate(cells):
            img = render(n, HS, fl, rl, paint, ink, lines)
            if c == 2: img = (img * 0.55).astype(np.uint8)
            cv_.paste(Image.fromarray(img), (160 + c * CW, y + RH - 14 - img.shape[0]))
            dr.text((160 + c * CW, y + RH - 12), '뒤집음' if fl else '원래 방향', font=fs, fill=(120, 120, 120))
        dr.line([(20, y + RH + 4), (Wimg - 20, y + RH + 4)], fill=(50, 50, 50))
    cv_.save(os.path.join(G.OUT, 'tex-light-3.png')); print('저장', cv_.size)
