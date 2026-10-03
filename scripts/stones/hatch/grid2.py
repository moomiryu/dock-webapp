# 결 격자 2 — 한 풍경의 세 결. 줄마다 나무 · 돌 · 구름을 벽 실제 화소로 나란히:
#   1) 모두 빗금(돌 C · 구름 ／)  2) 돌 점 · 구름 가로줄  3) 돌 점 · 구름 물결(봉우리 윤곽을 따라 겹치는 선)
# 구름의 명암은 윤곽에서 계산한다 — 위에서 오는 빛, 봉우리마다 아래쪽이 어둡다(나무 덩이 밑 그늘과 같은 원리. 좌우 뒤집어도 맞는다)
import cv2, numpy as np, json, os
from PIL import Image, ImageDraw, ImageFont
import grid1 as G

REPO, SS, BG = G.REPO, G.SS, G.BG
PV = G.P / np.sqrt(2)          # 나무 빗금 줄 사이(수직 거리) 3.54px — 가로줄 · 물결도 같은 촘촘함
GV = G.GAP / np.sqrt(2)        # 가장 어두운 자리의 검은 틈 2.33px
FONT_DACAPO = f'{REPO}/public/fonts/MapoDacapo.woff2'
BODY = json.load(open(f'{REPO}/design/cloud-photo/band-chain/bodies.json', encoding='utf-8'))


def cloud_fields(bid, W):
    a = (cv2.imread(f'{REPO}/design/cloud-photo/band-chain/{bid}_mask.png', 0) > 127).astype(np.uint8)
    ys, xs = np.nonzero(a); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    a = a[y0:y1, x0:x1]; H = round(W * a.shape[0] / a.shape[1])
    m = (cv2.resize(a.astype(np.float32), (W * SS, H * SS), interpolation=cv2.INTER_LINEAR) > 0.5).astype(np.uint8)
    Hs, Ws = m.shape
    # 아래로 늘인 판 — 밑을 안으로 쳐서 '위 · 옆 윤곽까지의 거리'만 잰다
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
    t = dtop / (dtop + dbase + 1e-3)                  # 0 = 봉우리 윗선, 1 = 밑
    t = cv2.GaussianBlur(t, (0, 0), 2 * SS)
    d = np.clip((t - 0.45) / 0.5, 0, 1); d = d * d * (3 - 2 * d)
    b0, b1 = BODY[bid]; bx0, bx1 = (b0 - x0) / (x1 - x0) * Ws, (b1 - x0) / (x1 - x0) * Ws
    return m, d * m, dtop, (bx0, bx1), W, H


def cloud_text(m, body, lines, size):
    Hs, Ws = m.shape; f = ImageFont.truetype(FONT_DACAPO, size * SS)
    lh = size * 1.45 * SS; tw = max(f.getlength(t) for t in lines); th = lh * len(lines); pad = int(0.6 * size * SS)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (int(tw + 2 * pad) | 1, int(th + 2 * pad) | 1))
    ok = cv2.erode(m, k); ok[:, :int(body[0])] = 0; ok[:, int(body[1]):] = 0
    ys, xs = np.nonzero(ok)
    if not len(xs): return None
    cx = (body[0] + body[1]) / 2; my = np.nonzero(m)[0].mean()
    i = np.argmin((xs - cx) ** 2 + ((ys - my) * 1.5) ** 2); X, Y = xs[i] - tw / 2, ys[i] - th / 2
    img = Image.new('L', (Ws, Hs), 0); dr = ImageDraw.Draw(img)
    for j, t in enumerate(lines):
        dr.text((X + (tw - f.getlength(t)) / 2, Y + j * lh + (lh - size * SS) / 2), t, font=f, fill=255)
    g = np.array(img)
    dist = cv2.distanceTransform((g <= 40).astype(np.uint8), cv2.DIST_L2, 5)
    fade = np.clip((dist - 0.5 * size * SS) / (1.3 * size * SS), 0, 1); fade = fade * fade * (3 - 2 * fade)
    return g, fade


def c_hatch(m, d, dtop):
    r = (d > 0.5).astype(np.uint8)
    return G.hatch_region((m & r).astype(bool))


def c_lines(m, d, dtop):
    Hs, Ws = m.shape; yy = np.mgrid[0:Hs, 0:Ws][0] / SS
    g = d * GV
    return (m > 0) & (g >= 0.5) & ((yy % PV) < g)


def c_wave(m, d, dtop):
    g = d * GV
    return (m > 0) & (g >= 0.5) & (((dtop / SS) % PV) < g)


def render_cloud(bid, W, paint, ink, lines, fn):
    while True:   # 앱처럼 — 글이 겨우 드는 크기까지 키운다
        m, d, dtop, body, W, H = cloud_fields(bid, W)
        got = cloud_text(m, body, lines, 21)
        if got: break
        W += 20
    print('구름 폭', W, '키', H)
    g, fade = got
    cut = fn(m, d * fade, dtop) & (fade > 0.35)
    out = np.zeros(m.shape + (3,), np.float32); out[:] = BG
    out[(m > 0) & ~cut] = G.hexrgb(paint)
    a = (g / 255.0)[..., None]; out = out * (1 - a) + np.array(G.hexrgb(ink), np.float32) * a
    return np.clip(cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA), 0, 255).astype(np.uint8)


SETS = [('1 · 모두 빗금', G.v_face, '돌: 사진 그늘 면 ／', c_hatch, '구름: 봉우리 밑 ／'),
        ('2 · 돌 점 · 구름 가로줄', G.v_dot, '돌: 점', c_lines, '구름: 가로줄(동판화의 하늘 결)'),
        ('3 · 돌 점 · 구름 물결', G.v_dot, '돌: 점', c_wave, '구름: 물결(봉우리 윤곽을 따라 겹치는 선)')]
TREE_C, STONE = '#59A173', ('stone-b', 300, '#CCC1BA', '#2B2B2B', ['여기서 크게 말해본 적', '없다'])
CLOUD = ('b00', 470, '#F78D8C', '#1E3655', ['오늘 고마웠다고', '말하고 싶었어'])

if __name__ == '__main__':
    RH, LAB = 300, 34
    tree = G.tree_ref(270, TREE_C)
    Wimg = 1260; Himg = 80 + (RH + LAB) * len(SETS) + 10
    cv_ = Image.new('RGB', (Wimg, Himg), BG); dr = ImageDraw.Draw(cv_)
    fb = ImageFont.truetype(G.FONT_SANS, 22); fb.set_variation_by_axes([700])
    fs = ImageFont.truetype(G.FONT_SANS, 14); fs.set_variation_by_axes([400])
    fm = ImageFont.truetype(G.FONT_SANS, 16); fm.set_variation_by_axes([600])
    dr.text((20, 14), '결 2 — 한 풍경의 세 결 (나무 · 돌 · 구름, 벽 실제 화소)', font=fb, fill=(255, 255, 255))
    dr.text((20, 46), '물음: 어느 줄이 한 풍경으로 가장 자연스럽나 — 셋이 서로 다른 것으로 읽히면서도 한 손으로 그린 것처럼', font=fs, fill=(190, 190, 190))
    for r, (title, sfn, slab, cfn, clab) in enumerate(SETS):
        y = 80 + r * (RH + LAB); ground = y + RH - 8
        if r: dr.line([(20, y - 6), (Wimg - 20, y - 6)], fill=(60, 60, 60))
        dr.text((20, y), title, font=fm, fill=(235, 235, 235))
        cv_.paste(Image.fromarray(tree), (40, ground - tree.shape[0]))
        st = G.render(*STONE[:3], STONE[3], STONE[4], sfn)
        cv_.paste(Image.fromarray(st), (40 + tree.shape[1] + 30, ground - st.shape[0]))
        cl = render_cloud(*CLOUD[:4], CLOUD[4], cfn)
        cx = 40 + tree.shape[1] + 30 + st.shape[1] + 40
        cv_.paste(Image.fromarray(cl), (cx, y + 40))
        dr.text((40, ground + 6), '나무: 덩이 밑 ／(지금)', font=fs, fill=(150, 150, 150))
        dr.text((40 + tree.shape[1] + 30, ground + 6), slab, font=fs, fill=(225, 225, 225))
        dr.text((cx, y + 40 + cl.shape[0] + 8), clab, font=fs, fill=(225, 225, 225))
    cv_.save(os.path.join(G.OUT, 'tex-set-2.png')); print('저장', cv_.size)
