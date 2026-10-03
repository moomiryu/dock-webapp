# 구름 결 격자 4 — 그늘 양: 구름에서 가장 어두운 몇 %까지를 그늘로 칠하나. 다정한은 칠이 밝아 검은 틈이 돌보다 잘 보인다.
# 줄 = 다정한 색 다섯(앱이 짓는 띠 구름 다섯), 칸 = 25 · 35(돌과 같게) · 45 · 55%
# 고정: 빛 오른쪽 위 · 밑 띠(격자 2) · 다정한 획 0.46pt(보통, 격자 3 '다') · 틈 ≤ 획 × 1.6 · 뭉갬 3.75px · 조각 2.25% 정리 · 흔들림 '미세'.
# 결과는 임시 폴더
import cv2, numpy as np, json, os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import c1, c3
from c1 import G, SS, P, LIGHT, COLORS, OUT, font

QS = [25, 35, 45, 55]


def cell(r, q, paint, ink, seed=11):
    m, org, W, H = c1.shape_mask(r)
    add = float(r['stroke'].rstrip('em'))
    g, fade, stroke = c3.text_thick(r, m, org, add)
    gap = min(P - G.WP, 1.6 * stroke)
    c1.Q = q
    rg = c1.region_q(m, c1.shade_light(m, LIGHT), fade, seed)
    cut = c1.hatch(rg, gap, seed)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = G.BG
    out[(m > 0) & ~cut] = G.hexrgb(paint); out[(m > 0) & cut] = 0
    a = (np.clip(g, 0, 255) / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(ink), np.float32) * a
    img = np.clip(cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)
    return img, rg.sum() / max(1, (m > 0).sum()), gap


if __name__ == '__main__':
    rows = json.load(open(os.path.join(OUT, 'cloud_shapes.json'), encoding='utf-8'))
    cells = [[cell(r, q, COLORS[i][1], COLORS[i][2]) for q in QS] for i, r in enumerate(rows)]
    LW, CW, TOP = 150, max(c[0].shape[1] for row in cells for c in row) + 24, 190
    RH = [max(c[0].shape[0] for c in row) + 36 for row in cells]
    Wt, Ht = LW + len(QS) * CW + 10, TOP + sum(RH) + 70
    sheet = Image.new('RGB', (Wt, Ht), (24, 24, 24)); dr = ImageDraw.Draw(sheet)
    dr.text((30, 26), '물음 — 구름의 그늘, 얼마나 칠할까요?', font=font(34, 800), fill=(255, 255, 255))
    dr.text((30, 76), '구름에서 가장 어두운 몇 %까지를 빗금으로 칠하나. 돌은 35%. 글 둘레는 비워서 실제로 칠해지는 몫은 칸 아래 숫자입니다.',
            font=font(17, 400), fill=(200, 200, 200))
    names = ['가', '나', '다', '라']
    for j, q in enumerate(QS):
        x = LW + j * CW
        dr.text((x, 124), f'{names[j]}  {q}%' + ('  (돌과 같게)' if q == 35 else ''), font=font(24, 700), fill=(255, 255, 255))
    y = TOP
    for i, (r, row) in enumerate(zip(rows, cells)):
        dr.text((30, y + 8), COLORS[i][0], font=font(17, 600), fill=(220, 220, 220))
        dr.text((30, y + 32), f"줄 {len(r['lines'])} · 크기 {r['size']}", font=font(13, 400), fill=(150, 150, 150))
        dr.text((30, y + 52), f"빗금 틈 {row[0][2]:.2f}px", font=font(13, 400), fill=(150, 150, 150))
        for j, (img, cover, _) in enumerate(row):
            x = LW + j * CW
            sheet.paste(Image.fromarray(img), (x, y + 4))
            dr.text((x, y + 6 + img.shape[0]), f'칠한 그늘 {cover * 100:.0f}%', font=font(12, 400), fill=(120, 120, 120))
        y += RH[i]
    dr.text((30, Ht - 46), "고정: 빛 오른쪽 위 · 밑 띠 · 다정한 획 0.46pt(보통) · 검은 틈 ≤ 글자 획 × 1.6 · 뭉갬 3.75px · 작은 조각 2.25% 정리 · 흔들림 '미세' "
            "· 글 둘레 0.5~1.8em 비움. 벽 실제 크기, 멈춘 한 순간", font=font(13, 400), fill=(150, 150, 150))
    p = os.path.join(OUT, 'c4-amount.png'); sheet.save(p); print(p, sheet.size)
