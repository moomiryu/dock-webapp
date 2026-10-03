# 구름 결 격자 3 — 다정한(마포 다카포) 글자를 얼마나 굵게. 다카포는 굵기 축이 없어 같은 색 획을 덧댄다(--optical-stroke,
# paint-order: stroke fill — 덧댄 폭 w em만큼 획이 굵어진다). 맨 획은 평균 0.0275em(잉크 넓이 × 2 ÷ 둘레) — 차분한 500의 0.065em의 절반 아래.
# 빗금 틈은 글자 획 × 1.6까지('가')라 글이 굵어지면 빗금도 굵어진다.
# 줄 = 덧댄 획 사다리(가늘게 · 보통 · 굵게): 지금 0 · 0.1 · 0.2pt(12pt 기준) / 가 +0.12pt / 나 +0.24pt / 다 +0.36pt
# 칸 = 벽의 띠 구름(크기 36, 보이는 글자 13.7px — 작은 쪽) 가장 가늘게 · 그 3배 확대 · 가장 굵게 + 폰처럼 크게 46px(굵게 — 속공간이 막히나)
# 그늘은 밑 띠(격자 2 '가'). 결과는 임시 폴더
import cv2, numpy as np, json, os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import c1
from c1 import G, SS, P, LIGHT, OUT, font, FONT_DACAPO, FADE

BARE = 0.0275                         # 다카포 맨 획(em)
STEP = (0, 0.1 / 12, 0.2 / 12)        # 지금 사다리(em)
ROWS = [('지금', 0.0), ('가', 0.12 / 12), ('나', 0.24 / 12), ('다', 0.36 / 12)]
PAINT, INK = '#FFA400', '#1E3655'
ZOOM = (130, 62)                      # 확대 칸이 보는 벽 화소(가로 · 세로)     # 해바라기 — 가장 밝아 검은 틈이 가장 잘 보인다


def thicken(g, add_px):
    """글자 판(0~255)을 바깥으로 add_px/2씩(SS배 화소) — 덧댄 획의 바깥 반"""
    if add_px <= 0: return g
    dist = cv2.distanceTransform((g < 128).astype(np.uint8), cv2.DIST_L2, 5)
    return np.maximum(g.astype(np.float32), np.clip(add_px / 2 - dist + 0.5, 0, 1) * 255)


def text_thick(r, m, org, add_em):
    k, op = r['uPx'], r['optic']; LH = r['lh'] * op; tb = r['textBox']; px = op * k
    f = ImageFont.truetype(FONT_DACAPO, max(4, round(px * SS)))
    img = Image.new('L', (m.shape[1], m.shape[0]), 0); dr = ImageDraw.Draw(img)
    cx = (tb['x'] + tb['w'] / 2) * k - org[0]
    for i, t in enumerate(r['lines']):
        dr.text((cx * SS, ((tb['y'] + (i + 0.5) * LH) * k - org[1]) * SS), t, font=f, fill=255, anchor='mm')
    g = thicken(np.array(img), add_em * px * SS)
    em = px * SS
    dist = cv2.distanceTransform((g <= 40).astype(np.uint8), cv2.DIST_L2, 5)
    fade = np.clip((dist - FADE[0] * em) / (FADE[1] * em), 0, 1); fade = fade * fade * (3 - 2 * fade)
    return g, fade, (BARE + add_em) * px


def cell(r, add_em, seed=11):
    m, org, W, H = c1.shape_mask(r)
    g, fade, stroke = text_thick(r, m, org, add_em)
    gap = min(P - G.WP, 1.6 * stroke)
    rg = c1.region_q(m, c1.shade_light(m, LIGHT), fade, seed)
    cut = c1.hatch(rg, gap, seed)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = G.BG
    out[(m > 0) & ~cut] = G.hexrgb(PAINT); out[(m > 0) & cut] = 0
    a = (np.clip(g, 0, 255) / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(INK), np.float32) * a
    # 3배 확대 칸 — 글 둘째 줄 가운데에서 구름 밑까지(4배로 그린 판에서 잘라 3배로)
    tb, k = r['textBox'], r['uPx']
    cx, y0 = (tb['x'] + tb['w'] / 2) * k - org[0], (tb['y'] + tb['h'] * 0.52) * k - org[1]
    zw, zh = ZOOM
    X0, Y0 = int((cx - zw / 2) * SS), int(max(0, y0) * SS)
    crop = out[Y0:Y0 + zh * SS, X0:X0 + zw * SS]
    zoom = cv2.resize(crop, (crop.shape[1] * 3 // SS, crop.shape[0] * 3 // SS), interpolation=cv2.INTER_AREA)
    img = cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA)
    return np.clip(img, 0, 255).astype(np.uint8), stroke, gap, np.clip(zoom, 0, 255).astype(np.uint8)


def phone(text, add_em, px=46):
    f = ImageFont.truetype(FONT_DACAPO, px * SS)
    W = int(f.getlength(text) / SS) + 24; H = int(px * 1.5)
    img = Image.new('L', (W * SS, H * SS), 0); ImageDraw.Draw(img).text((12 * SS, H * SS / 2), text, font=f, fill=255, anchor='lm')
    g = thicken(np.array(img), add_em * px * SS)
    out = np.zeros((H * SS, W * SS, 3), np.float32); out[:] = G.hexrgb(PAINT)
    a = (np.clip(g, 0, 255) / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(INK), np.float32) * a
    return np.clip(cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


if __name__ == '__main__':
    shapes = json.load(open(os.path.join(OUT, 'cloud_shapes.json'), encoding='utf-8'))
    r = next(s for s in shapes if s['id'] == 'b03')
    cells = [[cell(r, a + s) for s in (STEP[0], STEP[2])] for _, a in ROWS]
    phones = [phone('괜찮아 따뜻했다', a + STEP[2]) for _, a in ROWS]
    cw, zw, pw = cells[0][0][0].shape[1] + 30, cells[0][0][3].shape[1] + 30, max(p.shape[1] for p in phones) + 20
    xs = [230, 230 + cw, 230 + cw + zw, 230 + 2 * cw + zw]
    TOP = 190
    RH = max(max(c[0].shape[0], c[3].shape[0]) for row in cells for c in row) + 40
    Wt, Ht = xs[3] + pw + 10, TOP + len(ROWS) * RH + 80
    sheet = Image.new('RGB', (Wt, Ht), (24, 24, 24)); dr = ImageDraw.Draw(sheet)
    dr.text((30, 26), '물음 — 다정한 글자를 얼마나 굵게 할까요?', font=font(34, 800), fill=(255, 255, 255))
    dr.text((30, 76), '다카포는 굵기 축이 없어 같은 색 획을 덧댑니다. 글이 굵어지면 빗금 틈도 그만큼 굵어집니다(틈 ≤ 글자 획 × 1.6).',
            font=font(17, 400), fill=(200, 200, 200))
    heads = [('벽 · 가장 가늘게', '띠 구름, 보이는 글자 13.7px(작은 쪽)'), ('가장 가늘게 · 3배로 키워 봄', '벽 크기에선 차이가 작아서'),
             ('벽 · 가장 굵게', ''), ('폰처럼 크게 46px · 굵게', '속공간이 막히나')]
    for x, (h, sub) in zip(xs, heads):
        dr.text((x, 130), h, font=font(20, 700), fill=(255, 255, 255))
        dr.text((x, 160), sub, font=font(13, 400), fill=(150, 150, 150))
    for i, (name, a) in enumerate(ROWS):
        y = TOP + i * RH
        pts = ' · '.join(f'{(a + s) * 12:.2f}' for s in STEP)
        dr.text((30, y + 6), name, font=font(28, 800), fill=(255, 255, 255))
        dr.text((30, y + 44), f'덧댄 획 {pts}pt', font=font(13, 400), fill=(170, 170, 170))
        dr.text((30, y + 64), f'가장 가는 획 = 지금의 {(BARE + a) / BARE:.2f}배', font=font(13, 400), fill=(150, 150, 150))
        (thin, st0, gp0, zoom), (thick, st2, gp2, _) = cells[i]
        sheet.paste(Image.fromarray(thin), (xs[0], y)); sheet.paste(Image.fromarray(zoom), (xs[1], y))
        sheet.paste(Image.fromarray(thick), (xs[2], y)); sheet.paste(Image.fromarray(phones[i]), (xs[3], y + 10))
        dr.text((xs[0], y + thin.shape[0] + 4), f'획 {st0:.2f}px · 빗금 틈 {gp0:.2f}px', font=font(12, 400), fill=(130, 130, 130))
        dr.text((xs[2], y + thick.shape[0] + 4), f'획 {st2:.2f}px · 빗금 틈 {gp2:.2f}px', font=font(12, 400), fill=(130, 130, 130))
    dr.text((30, Ht - 50), "참고: 나무 · 돌의 빗금 틈은 2.3~3.3px. 차분한은 가장 가는 글 획을 0.065em(무게 500)으로 올렸다 — 다정한 지금 가장 가는 획은 0.0275em. "
            "가운데(보통)는 두 끝의 가운데. 그늘 밑 띠 · 양 35% · 흔들림 '미세'. 벽 실제 크기", font=font(13, 400), fill=(150, 150, 150))
    p = os.path.join(OUT, 'c3-stroke.png'); sheet.save(p); print(p, sheet.size)
