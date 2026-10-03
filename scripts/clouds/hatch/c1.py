# 구름 결 격자 1 — 구름의 그늘을 어디서 오는 빛으로 지을까. 앱이 짓는 띠 구름(cloud_shapes.mjs → cloud_shapes.json) 다섯 × 빛 둘:
#   가 위에서 오는 빛 — 봉우리마다 밑(10-04 결 격자 2의 구름 그대로)   나 오른쪽 위 빛 — 벽의 돌과 같은 빛(StoneTex.light)
# 구름은 사진 명암이 윤곽과 안 맞아 윤곽에서 계산한다: 빛 쪽 윤곽까지의 거리 ÷ (그것 + 반대쪽 밑까지의 거리). 나는 판을 빛이 위로
# 오게 돌려 같은 셈을 하고 되돌린다. 나머지는 돌에서 고른 값 그대로(양 35% · 뭉갬 3.75px · 정리 2.25% · 흔들림 '미세' · 글 둘레 ·
# 틈 ≤ 획 × 1.6). 벽 실제 화소(1920×1080, 한 변 401.8px). 결과는 임시 폴더
import cv2, numpy as np, json, os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'stones', 'hatch'))
import grid1 as G, grid4 as G4, grid6 as G6

SS, P = G.SS, G.P
OUT = os.environ.get('HATCH_OUT') or os.path.join(__import__('tempfile').gettempdir(), 'megafont-cloud-hatch')
os.makedirs(OUT, exist_ok=True)
FONT_DACAPO = f'{G.REPO}/public/fonts/MapoDacapo.woff2'
LIGHT = (0.6, -0.8)                      # 벽의 빛(화면, 아래가 +) — StoneTex.light
Q, BLUR, DROP, FADE = 35, 3.75, 0.0225, (0.5, 1.3)
WOB = G6.WOB['미세']
COLORS = [('코랄', '#F78D8C', '#1E3655'), ('해바라기', '#FFA400', '#1E3655'), ('난초', '#BE80C7', '#142438'),
          ('연분홍', '#FAC7DD', '#1E3655'), ('라벤더', '#C9B6EE', '#1E3655')]


def shape_mask(r, pad=8):
    """윤곽(꼬리 · 조각까지)을 벽 화소로 — SS배 판, 원점 = 판 왼쪽 위"""
    rings = [r['pts']] + r['extra']; k = r['uPx']
    allp = np.concatenate([np.array(q, np.float32) for q in rings])
    ox, oy = allp[:, 0].min() * k - pad, allp[:, 1].min() * k - pad
    W = int(np.ceil(allp[:, 0].max() * k - ox + pad)); H = int(np.ceil(allp[:, 1].max() * k - oy + pad))
    m = np.zeros((H * SS, W * SS), np.uint8)
    for q in rings:
        a = (np.array(q, np.float32) * k - [ox, oy]) * SS
        cv2.fillPoly(m, [np.round(a).astype(np.int32)], 1)
    return m, (ox, oy), W, H


def shade_up(m):
    """빛이 위에서 올 때의 어두움(0~1) — 위 · 옆 윤곽까지의 거리 ÷ (그것 + 밑까지의 거리). 봉우리마다 아래가 어둡다"""
    Hs, Ws = m.shape
    ext = m.copy()
    for x in range(Ws):
        col = np.nonzero(m[:, x])[0]
        if len(col): ext[col.min():, x] = 1
    ext = np.pad(ext, ((0, 0), (1, 1)))
    dtop = cv2.distanceTransform(ext, cv2.DIST_L2, 5)[:, 1:-1]
    base = np.zeros(Ws, np.float32)
    for x in range(Ws):
        col = np.nonzero(m[:, x])[0]; base[x] = col.max() if len(col) else 0
    yy = np.mgrid[0:Hs, 0:Ws][0].astype(np.float32)
    dbase = np.maximum(base[None, :] - yy, 0)
    t = dtop / (dtop + dbase + 1e-3)
    t = cv2.GaussianBlur(t, (0, 0), 2 * SS)
    d = np.clip((t - 0.45) / 0.5, 0, 1)
    return (d * d * (3 - 2 * d)) * m


def shade_light(m, light):
    """빛이 light 쪽에서 올 때 — 판을 빛이 위로 오게 돌려 shade_up을 하고 되돌린다"""
    ang = np.degrees(np.arctan2(light[0], -light[1]))          # 위에서 시계 방향으로 몇 도
    if abs(ang) < 1e-6: return shade_up(m)
    Hs, Ws = m.shape; D = int(np.ceil(np.hypot(Hs, Ws))) + 4
    big = np.zeros((D, D), np.uint8); y0, x0 = (D - Hs) // 2, (D - Ws) // 2; big[y0:y0 + Hs, x0:x0 + Ws] = m
    R = cv2.getRotationMatrix2D((D / 2, D / 2), -ang, 1.0)      # 빛을 위로: 시계 반대로 ang만큼
    rm = (cv2.warpAffine(big.astype(np.float32), R, (D, D), flags=cv2.INTER_LINEAR) > 0.5).astype(np.uint8)
    rd = shade_up(rm)
    back = cv2.warpAffine(rd, cv2.invertAffineTransform(R), (D, D), flags=cv2.INTER_LINEAR)
    return back[y0:y0 + Hs, x0:x0 + Ws] * m


def text_layer(r, m, org):
    """글 — 다카포를 글 상자 가운데 정렬로(앱의 줄 높이 · 광학 크기). 글 판(SS배) · 글 둘레 판 · 획 굵기(px)"""
    k, op = r['uPx'], r['optic']; LH = r['lh'] * op; tb = r['textBox']
    f = ImageFont.truetype(FONT_DACAPO, max(4, round(op * k * SS)))
    img = Image.new('L', (m.shape[1], m.shape[0]), 0); dr = ImageDraw.Draw(img)
    cx = (tb['x'] + tb['w'] / 2) * k - org[0]
    for i, t in enumerate(r['lines']):
        cy = (tb['y'] + (i + 0.5) * LH) * k - org[1]
        dr.text((cx * SS, cy * SS), t, font=f, fill=255, anchor='mm')
    g = np.array(img)
    em = op * k * SS
    dist = cv2.distanceTransform((g <= 40).astype(np.uint8), cv2.DIST_L2, 5)
    fade = np.clip((dist - FADE[0] * em) / (FADE[1] * em), 0, 1); fade = fade * fade * (3 - 2 * fade)
    ink = (g > 127).astype(np.uint8)
    cs, _ = cv2.findContours(ink, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    per = sum(cv2.arcLength(c, True) for c in cs)
    stroke = (2 * ink.sum() / max(per, 1)) / SS
    return g, fade, stroke


def region_q(m, d, fade, seed, blur=BLUR):
    A, rr, wv, edge = WOB
    dd = cv2.GaussianBlur(d, (0, 0), blur * SS)
    if edge: dd = dd + edge * G6.noise(m.shape, 1.2, seed + 7)
    thr = np.percentile(dd[m > 0], 100 - Q)
    rg = (dd > max(thr, 1e-3)) & (m > 0)
    area = (m > 0).sum()
    rg = G4.drop_small(rg, DROP * area); rg = G4.fill_small(rg, m, DROP * area)
    rg &= fade > 0.5
    return G4.drop_small(rg, DROP * area * 0.5)


def hatch(rg, gap, seed):
    """나무 빗금 ／ — (x + y) 5px 칸, 검은 틈 gap(px). 흔들림 '미세'"""
    A, rr, wv, edge = WOB
    Hs, Ws = rg.shape; yy, xx = np.mgrid[0:Hs, 0:Ws]
    u = (xx + yy) / SS + A * G6.noise(rg.shape, 6, seed) + rr * G6.noise(rg.shape, 0.7, seed + 1)
    w = (P - gap) * (1 + wv * G6.noise(rg.shape, 4, seed + 2))
    return rg & ((u % P) >= w)


def render(r, light, paint, ink, seed=11):
    m, org, W, H = shape_mask(r)
    d = shade_up(m) if light is None else shade_light(m, light)
    g, fade, stroke = text_layer(r, m, org)
    gap = min(P - G.WP, 1.6 * stroke)
    rg = region_q(m, d, fade, seed)
    cut = hatch(rg, gap, seed)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = G.BG
    out[(m > 0) & ~cut] = G.hexrgb(paint)
    out[(m > 0) & cut] = G.hexrgb('#000000')                     # 검은 줄은 칠한 --ink
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(ink), np.float32) * a
    img = np.clip(cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)
    return img, stroke, gap, rg.sum() / max(1, (m > 0).sum())


def font(size, wght):
    f = ImageFont.truetype(G.FONT_SANS, size); f.set_variation_by_axes([wght]); return f


if __name__ == '__main__':
    rows = json.load(open(os.path.join(OUT, 'cloud_shapes.json'), encoding='utf-8'))
    cols = [('가', '위에서 오는 빛 — 봉우리마다 밑', '10-04 결 격자 2의 구름 그대로', None),
            ('나', '오른쪽 위 빛 — 벽의 돌과 같은 빛', '봉우리마다 왼쪽 아래가 어둡다', LIGHT)]
    cells = [[render(r, c[3], COLORS[i][1], COLORS[i][2]) for c in cols] for i, r in enumerate(rows)]
    LW, CW, GAPX, TOP = 190, max(c[0].shape[1] for row in cells for c in row) + 40, 30, 190
    RH = [max(c[0].shape[0] for c in row) + 44 for row in cells]
    Wt, Ht = LW + len(cols) * CW + GAPX, TOP + sum(RH) + 70
    sheet = Image.new('RGB', (Wt, Ht), (24, 24, 24)); dr = ImageDraw.Draw(sheet)
    dr.text((30, 26), '물음 — 구름의 그늘, 빛을 어디서 받게 할까요?', font=font(34, 800), fill=(255, 255, 255))
    dr.text((30, 76), '돌은 오른쪽 위 빛 하나로 맞췄습니다. 구름은 사진 명암을 못 써서 윤곽에서 그늘을 계산합니다.', font=font(17, 400), fill=(200, 200, 200))
    for j, c in enumerate(cols):
        x = LW + j * CW
        dr.text((x, 118), f'{c[0]}  {c[1]}', font=font(22, 700), fill=(255, 255, 255))
        dr.text((x, 150), c[2], font=font(15, 400), fill=(170, 170, 170))
    y = TOP
    for i, (r, row) in enumerate(zip(rows, cells)):
        dr.text((30, y + 10), COLORS[i][0], font=font(17, 600), fill=(220, 220, 220))
        dr.text((30, y + 34), f"줄 {len(r['lines'])} · 크기 {r['size']}", font=font(14, 400), fill=(150, 150, 150))
        dr.text((30, y + 54), f"획 {row[0][1]:.2f}px → 틈 {row[0][2]:.2f}px", font=font(14, 400), fill=(150, 150, 150))
        for j, (img, _, _, cover) in enumerate(row):
            x = LW + j * CW
            sheet.paste(Image.fromarray(img), (x, y + 6))
            dr.text((x, y + 10 + img.shape[0]), f'그늘 {cover * 100:.0f}%', font=font(13, 400), fill=(120, 120, 120))
        y += RH[i]
    dr.text((30, Ht - 46), "고정: 그늘 양 35% · 뭉갬 3.75px · 작은 조각 2.25% 정리 · 빗금 흔들림 '미세' · 글 둘레 0.5~1.8em 비움 · 검은 틈 ≤ 글자 획 × 1.6 "
            "(돌과 같게). 벽 실제 크기, 멈춘 한 순간", font=font(14, 400), fill=(150, 150, 150))
    p = os.path.join(OUT, 'c1-light.png'); sheet.save(p); print(p, sheet.size)
