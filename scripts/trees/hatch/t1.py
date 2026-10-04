# 나무 결 격자 1 — 나무 빗금에도 돌 · 구름의 손맛(줄의 흔들림)을. 칸 = 지금(앱 그대로 — 곧은 줄, 화소마다 켜고 끔) · 미세(돌 · 구름과
# 같게) · 조금(한 단 더). 줄 = 나무 둘(소나무 · 버드나무)의 수관 + 소나무 그늘 3배 확대. 그리는 판은 앱과 같은 재료
# (src/assets/trees/<id>.png — 초록 = 칠, 빨강 = 그늘), 벽 실제 화소(나무 키 560px — 벽 1080의 52%). 바람 · 가닥 · 글자는 빼고 결만.
# 흔들림 값은 돌 격자(scripts/stones/hatch/grid6.py WOB) 그대로: (구불 px, 잔 거칠기 px, 굵기 오르내림 몫, 그늘 테두리 거칠기)
import cv2, numpy as np, os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'stones', 'hatch'))
import grid1 as G, grid6 as G6

SS, P, WP = G.SS, G.P, G.WP
REPO = G.REPO
OUT = os.environ.get('HATCH_OUT') or os.path.join(__import__('tempfile').gettempdir(), 'megafont-tree-hatch')
os.makedirs(OUT, exist_ok=True)
H = 560
TREES = [('pine-071', '#59A173', '소나무'), ('willow-017', '#F6E67B', '버드나무')]
COLS = [('지금', None), ('미세', '미세'), ('조금', '조금')]


def masks(tid, scale):
    im = np.array(Image.open(f'{REPO}/src/assets/trees/{tid}.png').convert('RGB')).astype(np.float32) / 255
    h0, w0 = im.shape[:2]; W = round(H * w0 / h0)
    big = cv2.resize(im, (W * scale, H * scale), interpolation=cv2.INTER_AREA)
    return big[..., 1], big[..., 0], W           # 칠(초록) · 그늘(빨강), 0~1


def render(tid, color, wob, seed=11):
    rgb = np.array(G.hexrgb(color), np.float32)
    if wob is None:
        # 지금 — 앱의 셰이더 그대로: 화소 가운데에서 그늘 > 0.5 이고 (x + y) mod 칸 >= 줄 굵기면 오려 낸다(켜고 끔, 다듬지 않음)
        paint, shade, W = masks(tid, 1)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        cut = (shade > 0.5) & (((xx + 0.5 + yy + 0.5) % P) >= WP)
        a = paint * (1 - cut)
        return np.clip(rgb[None, None] * a[..., None], 0, 255).astype(np.uint8)
    A, r, wv, edge = G6.WOB[wob]
    paint, shade, W = masks(tid, SS)
    # 그늘 테두리 — 조금 뭉갠 판에 잔 잡음을 더해 문턱(돌과 같은 손)
    sh = cv2.GaussianBlur(shade, (0, 0), 1.0 * SS) + edge * G6.noise(shade.shape, 1.2, seed + 7)
    rg = sh > 0.5
    cut = G6.hatch(rg, (A, r, wv, edge), seed).astype(np.float32)
    a = paint * (1 - cut)
    out = rgb[None, None] * a[..., None]
    return np.clip(cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


def font(size, wght):
    f = ImageFont.truetype(G.FONT_SANS, size); f.set_variation_by_axes([wght]); return f


if __name__ == '__main__':
    crown = 0.62                                             # 수관만(밑 줄기는 잘라 낸다)
    cells = [[render(t, c, w) for _, w in COLS] for t, c, _ in TREES]
    cw = max(im.shape[1] for row in cells for im in row) + 30
    LW, TOP = 160, 170
    rows_h = [int(H * crown) + 20 for _ in TREES]
    # 3배 확대 — 소나무 그늘이 많은 자리
    p0 = cells[0][0]; zx, zy, zw, zh = int(p0.shape[1] * 0.18), int(H * 0.30), 170, 110
    zh3 = zh * 3
    Wt, Ht = LW + 3 * cw, TOP + sum(rows_h) + zh3 + 110
    sheet = Image.new('RGB', (Wt, Ht), (24, 24, 24)); dr = ImageDraw.Draw(sheet)
    dr.text((30, 24), '물음 — 나무 빗금도 돌 · 구름처럼 손으로 그은 듯 흔들까요?', font=font(32, 800), fill=(255, 255, 255))
    dr.text((30, 72), "돌 · 구름은 '미세'를 골랐습니다(줄 자리 ±0.7px 낮은 결 + ±0.2px 잔 결, 굵기 ±10%, 그늘 테두리 잔 잡음). 벽 실제 크기, 바람 · 글자는 뺐습니다.",
            font=font(16, 400), fill=(200, 200, 200))
    for j, (name, w) in enumerate(COLS):
        dr.text((LW + j * cw, 116), f"{'가나다'[j]}  {name}" + ('  (돌 · 구름과 같게)' if w == '미세' else '  (앱 그대로 — 곧은 줄)' if w is None else ''),
                font=font(22, 700), fill=(255, 255, 255))
    y = TOP
    for i, (t, c, label) in enumerate(TREES):
        dr.text((30, y + 10), label, font=font(18, 600), fill=(220, 220, 220))
        for j, im in enumerate(cells[i]):
            sheet.paste(Image.fromarray(im[:int(H * crown)]), (LW + j * cw, y))
        y += rows_h[i]
    dr.text((30, y + 10), '소나무 그늘\n3배 확대', font=font(18, 600), fill=(220, 220, 220))
    for j, im in enumerate(cells[0]):
        crop = Image.fromarray(im[zy:zy + zh, zx:zx + zw]).resize((zw * 3, zh3), Image.NEAREST)
        sheet.paste(crop, (LW + j * cw, y))
    p = os.path.join(OUT, 't1-wobble.png'); sheet.save(p); print(p, sheet.size)
