# 구름 결 격자 2 — 그늘이 어디에 지나. 빛은 돌과 같은 오른쪽 위로 정했다(격자 1: 띠 구름은 밑이 평평해 위 · 오른쪽 위 차이가
# 거의 안 보였다). 앱이 짓는 띠 구름 다섯 × 둘, 그늘 양은 둘 다 구름의 35%(돌과 같게):
#   가 밑 띠 — 기둥마다 윗선에서 밑까지 어디쯤인가로 셈: 구름 전체의 밑이 어둡다(10-04 결 격자 2에서 본 구름)
#   나 가장자리 따라 — 구름을 부푼 덩이로 보고(윤곽에서 안으로 둥글게) 빛을 등진 쪽(왼쪽 · 아래)의 가장자리가 어둡다. 해진 가장자리의 결을 따라간다
# 봉우리 하나하나를 둥근 덩이로 보는 그늘(초승달)도 해 봤다 — 이 구름들은 윗선이 평평한 띠라 봉우리가 거의 안 잡혀 뺐다.
# 나머지는 돌에서 고른 값 그대로(c1.py). 벽 실제 화소. 결과는 임시 폴더
import cv2, numpy as np, json, os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import c1
from c1 import G, SS, P, LIGHT, COLORS, OUT, font

RIM = (5, 14)       # 부푼 덩이의 둥근 가장자리 폭(벽 px) — 잔 결 · 큰 결
LZ = 0.55           # 빛의 높이(화면에서 얼마나 앞으로 나와 있나)


def shade_rim(m):
    """윤곽에서 안으로 둥글게 부푼 덩이 — 결마다 반지름 R의 둥근 가장자리를 더하고, 면의 방향과 빛으로 어두움을 셈"""
    D = cv2.distanceTransform(np.pad(m, 1), cv2.DIST_L2, 5)[1:-1, 1:-1] / SS
    h = np.zeros_like(D)
    for R in RIM:
        c = np.clip(D, 0, R); h += np.sqrt(c * (2 * R - c))
    h = cv2.GaussianBlur(h, (0, 0), 1.0 * SS)
    gy, gx = np.gradient(h, 1.0 / SS)
    n = np.dstack([-gx, -gy, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    l = np.array([LIGHT[0], LIGHT[1], LZ]); l /= np.linalg.norm(l)
    s = (n * l).sum(2)
    return np.clip((l[2] - s) / l[2], 0, 1) * m


def render(r, mode, paint, ink, seed=11):
    m, org, W, H = c1.shape_mask(r)
    g, fade, stroke = c1.text_layer(r, m, org)
    stroke += float(r['stroke'].rstrip('em')) * r['optic'] * r['uPx']   # 앱이 덧대는 같은 색 획(다정한 가운데 0.1pt)
    gap = min(P - G.WP, 1.6 * stroke)
    if mode == 'band': rg = c1.region_q(m, c1.shade_light(m, LIGHT), fade, seed)
    else: rg = c1.region_q(m, shade_rim(m), fade, seed, blur=1.0)
    cut = c1.hatch(rg, gap, seed)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = G.BG
    out[(m > 0) & ~cut] = G.hexrgb(paint)
    out[(m > 0) & cut] = 0
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(ink), np.float32) * a
    img = np.clip(cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)
    return img, stroke, gap, rg.sum() / max(1, (m > 0).sum())


if __name__ == '__main__':
    rows = json.load(open(os.path.join(OUT, 'cloud_shapes.json'), encoding='utf-8'))
    cols = [('가', '밑 띠', '구름 전체의 밑이 어둡다 (10-04 결 격자 2에서 본 것)', 'band'),
            ('나', '가장자리 따라', '빛을 등진 왼쪽 · 아래 가장자리가 해진 결을 따라 어둡다', 'rim')]
    cells = [[render(r, c[3], COLORS[i][1], COLORS[i][2]) for c in cols] for i, r in enumerate(rows)]
    LW, CW, TOP = 150, max(c[0].shape[1] for row in cells for c in row) + 40, 190
    RH = [max(c[0].shape[0] for c in row) + 40 for row in cells]
    Wt, Ht = LW + len(cols) * CW + 10, TOP + sum(RH) + 70
    sheet = Image.new('RGB', (Wt, Ht), (24, 24, 24)); dr = ImageDraw.Draw(sheet)
    dr.text((30, 26), '물음 — 구름의 그늘, 어디에 지면 구름답나요?', font=font(34, 800), fill=(255, 255, 255))
    dr.text((30, 76), '빛은 돌과 같은 오른쪽 위 하나로 정했습니다. 그늘 양은 둘 다 구름의 35%(돌과 같게).', font=font(17, 400), fill=(200, 200, 200))
    for j, c in enumerate(cols):
        x = LW + j * CW
        dr.text((x, 118), f'{c[0]}  {c[1]}', font=font(24, 700), fill=(255, 255, 255))
        dr.text((x, 152), c[2], font=font(14, 400), fill=(170, 170, 170))
    y = TOP
    for i, (r, row) in enumerate(zip(rows, cells)):
        dr.text((30, y + 8), COLORS[i][0], font=font(17, 600), fill=(220, 220, 220))
        dr.text((30, y + 32), f"줄 {len(r['lines'])} · 크기 {r['size']}", font=font(13, 400), fill=(150, 150, 150))
        for j, (img, _, _, cover) in enumerate(row):
            x = LW + j * CW
            sheet.paste(Image.fromarray(img), (x, y + 4))
            dr.text((x, y + 8 + img.shape[0]), f'그늘 {cover * 100:.0f}%', font=font(12, 400), fill=(120, 120, 120))
        y += RH[i]
    dr.text((30, Ht - 46), "고정: 빛 오른쪽 위 · 빗금 흔들림 '미세' · 글 둘레 0.5~1.8em 비움 · 검은 틈 ≤ 글자 획 × 1.6(다정한은 획이 가늘어 틈도 가늘다 — 다음 물음) "
            "· 벽 실제 크기, 멈춘 한 순간", font=font(13, 400), fill=(150, 150, 150))
    p = os.path.join(OUT, 'c2-where.png'); sheet.save(p); print(p, sheet.size)
