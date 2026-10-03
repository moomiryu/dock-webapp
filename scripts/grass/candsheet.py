# 풀 후보 판 — 사진 · 한 색 실루엣(크게) · 벽 크기(땅 32px 위, 키 60px)를 위아래로. 색은 땅과 같은 --grey-800
import cv2, numpy as np, sys, re, os
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]
tok = open('src/styles/tokens.css', encoding='utf-8').read()
hexv = lambda n: re.search(r'--%s:\s*(#[0-9a-fA-F]{6})' % n, tok).group(1)
G800 = tuple(int(hexv('grey-800')[i:i + 2], 16) for i in (1, 3, 5)); LABEL = hexv('grey-300')
os.makedirs(f'{S}/sil', exist_ok=True)
SETS = {
  'foxtail': [('f020', '이삭 넷'), ('f036', '이삭 줄'), ('f037', '이삭 다발'), ('f038', '빽빽한 덤불'), ('f039', '덤불 + 긴 잎'),
              ('f044', '듬성한 이삭'), ('f045', '이삭 둘'), ('f057', '곧은 이삭 하나'), ('f059', '고개 숙인 이삭 + 줄기')],
  'dandelion': [('d030', '꽃'), ('d035', '작은 홀씨 · 긴 줄기'), ('d044', '홀씨'), ('d069', '날아가는 홀씨'), ('d070', '홀씨'), ('d076', '헝클어진 홀씨'), ('d082', '홀씨 · 굽은 줄기'), ('d070L', 'd070 줄기 ×3 · 가늘게')],
  'clover': [('c015', '꽃'), ('c054', '꽃 · 처진 꽃잎'), ('c073', '꽃 · 치마'), ('c074', '꽃'), ('c090', '잎')],
}
STEM_ADD = {'f059'}   # 줄기가 사진에 없다 — 이삭 왼쪽 밑동에서 아래로 그린다
STEM_CLEAN = {'d035', 'c090', 'c054'}   # 줄기 끝에 붙은 풀 · 흙 덩이를 걷는다
EXTEND = {'f020', 'f036', 'f037', 'f038', 'f039', 'f044', 'f045', 'd069'}   # 땅선에서 잘린 줄기 — 아래로 이어 그린다
def stem_width(m, y0, y1):
    ws = []
    for y in range(y0, y1):
        xs = np.nonzero(m[y])[0]
        if len(xs): ws.append(xs.max() - xs.min() + 1)
    return int(np.median(ws)) if ws else 3
def clean(k):
    if k == 'd070L':   # 홀씨는 그대로, 줄기를 3배로 늘리고 폭을 0.6배로
        m = clean('d070'); H, W = m.shape
        rows = [y for y in range(H) if m[y].sum() > 0]
        head_bot = next(y for y in range(int(H * 0.45), H) if m[y].sum() < W * 0.1)
        sw = max(2, int(stem_width(m, head_bot + 5, H - 2) * 0.6)); L = (H - head_bot) * 3
        out = np.zeros((head_bot + L, W), np.uint8); out[:head_bot] = m[:head_bot]
        cx = np.nonzero(m[head_bot + 3])[0].mean()
        for t in range(L): out[head_bot + t, max(0, int(cx + 0.02 * t - sw / 2)):int(cx + 0.02 * t + sw / 2) + 1] = 1
        return out
    m = (cv2.imread(f'{S}/mask/{k}-pad.png' if k in EXTEND or k in STEM_ADD else f'{S}/mask/{k}.png', 0) > 0).astype(np.uint8)
    H, W = m.shape
    if k in EXTEND:   # 땅선 찌꺼기 — 밑 6% 띠에서 넓게 퍼진 덩이를 걷고, 키가 작은 덩이를 버린다
        ys0 = np.nonzero(m.any(1))[0]; top, bot = ys0.min(), ys0.max(); band = max(3, int((bot - top) * 0.06))
        for y in range(bot - band, bot + 1):
            row = m[y]; x = 0
            while x < W:
                if row[x]:
                    s0 = x
                    while x < W and row[x]: x += 1
                    if x - s0 > W * 0.025: m[y, s0:x] = 0
                x += 1
        n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
        for i in range(1, n):
            if st[i][3] < (bot - top) * 0.15: m[lab == i] = 0
    # 구멍 메우기 — 바깥에서 닿지 않는 빈 곳
    inv = (1 - m).copy(); ff = np.zeros((H + 2, W + 2), np.uint8)
    for x in range(W):
        for y in (0, H - 1):
            if inv[y, x]: cv2.floodFill(inv, ff, (x, y), 2)
    for y in range(H):
        for x in (0, W - 1):
            if inv[y, x] == 1: cv2.floodFill(inv, ff, (x, y), 2)
    m[inv == 1] = 1
    m = (cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.8) > 0.5).astype(np.uint8)
    ys, xs = np.nonzero(m); y1 = ys.max()
    if k in STEM_CLEAN:   # 밑 20%는 위에서 내려온 줄기 폭 · 자리만 남긴다
        y0 = ys.min(); hgt = y1 - y0; cut = y1 - int(hgt * 0.2)
        sw = stem_width(m, cut - int(hgt * 0.15), cut); cx = np.nonzero(m[cut])[0].mean()
        for y in range(cut, y1 + 1):
            xs_ = np.nonzero(m[y])[0]
            if len(xs_): cx = 0.7 * cx + 0.3 * np.clip(xs_.mean(), cx - 2, cx + 2)
            m[y] = 0; m[y, max(0, int(cx - sw / 2)):int(cx + sw / 2) + 1] = 1
    if k in STEM_ADD:   # 이삭 왼쪽 끝 밑동에서 아래로 — 이삭 높이의 1.3배, 조금 왼쪽으로 기울게
        y0 = ys.min(); hgt = y1 - y0; left = xs.min()
        base_y = ys[xs < left + 0.04 * W].max(); base_x = left + 0.02 * W; sw = max(3, int(0.012 * W))
        L = int(hgt * 1.3)
        for t in range(L):
            xc = base_x - 0.08 * t; yy = base_y + t
            if yy < H: m[yy, max(0, int(xc - sw / 2)):int(xc + sw / 2) + 1] = 1
    if k in EXTEND:   # 줄기 끝마다 그 방향으로 키의 25%만큼 잇는다
        span = ys.max() - ys.min(); up = max(4, int(span * 0.05))
        row = m[y1]; runs, x = [], 0
        while x < W:
            if row[x]:
                s = x
                while x < W and row[x]: x += 1
                runs.append((s, x - 1))
            x += 1
        for s, e in runs:
            cx0 = (s + e) / 2
            seg = np.nonzero(m[y1 - up, max(0, s - 6):e + 7])[0]
            cx1 = (seg.mean() + max(0, s - 6)) if len(seg) else cx0
            dx = (cx0 - cx1) / up; L = int(span * 0.25)
            wdt = max(1, e - s + 1)
            for t in range(L):
                xc = cx0 + dx * t
                m[min(H - 1, y1 + t) if y1 + t < H else H - 1, max(0, int(xc - wdt / 2)):int(xc + wdt / 2) + 1] = 1
        if y1 + int(span * 0.25) >= H:   # 판 밑을 넘으면 판을 늘려 다시
            pass
    ys, xs = np.nonzero(m)
    return m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
def extend_canvas(k):
    m = (cv2.imread(f'{S}/mask/{k}.png', 0) > 0).astype(np.uint8)
    H, W = m.shape; big = np.zeros((int(H * 1.4), W), np.uint8); big[:H] = m; cv2.imwrite(f'{S}/mask/{k}-ext.png', big * 255)
font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 17); small = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 14)
CW, PH, SH, WH = 200, 150, 280, 130
for sp, items in SETS.items():
    sheet = Image.new('RGB', (len(items) * (CW + 10) + 10, 30 + PH + SH + WH + 70), (0, 0, 0))
    d = ImageDraw.Draw(sheet)
    for i, (k, name) in enumerate(items):
        x = 10 + i * (CW + 10)
        if k in EXTEND or k in STEM_ADD:   # 아래로 이을 자리가 판 안에 있게 판을 늘린다
            m0 = (cv2.imread(f'{S}/mask/{k}.png', 0) > 0).astype(np.uint8); H, W = m0.shape
            pad = np.zeros((int(H * 1.5), W), np.uint8); pad[:H] = m0; cv2.imwrite(f'{S}/mask/{k}-pad.png', pad * 255)
        sil = clean(k); np.save(f'{S}/sil/{k}.npy', sil)
        ph = Image.open(f'{S}/mask/{k.rstrip("L")}-work.jpg').convert('RGB'); ph.thumbnail((CW, PH)); sheet.paste(ph, (x + (CW - ph.width) // 2, 30 + (PH - ph.height) // 2))
        a = Image.fromarray((sil * 255).astype(np.uint8)); f = min(CW / a.width, SH / a.height)
        a = a.resize((max(1, int(a.width * f)), max(1, int(a.height * f))), Image.LANCZOS)
        col = Image.new('RGB', a.size, G800); sheet.paste(col, (x + (CW - a.width) // 2, 30 + PH + 8 + SH - a.height), a)
        # 벽 크기 — 땅 32px, 풀 키 60px(밑 6px은 땅에 묻힘)
        y0 = 30 + PH + SH + 20; gy = y0 + WH - 32
        d.rectangle([x, gy, x + CW - 1, y0 + WH - 1], fill=G800)
        b = Image.fromarray((sil * 255).astype(np.uint8)); f2 = 60 / b.height
        b = b.resize((max(1, int(b.width * f2)), 60), Image.LANCZOS)
        if b.width > CW: b = b.crop(((b.width - CW) // 2, 0, (b.width + CW) // 2, 60))
        sheet.paste(Image.new('RGB', b.size, G800), (x + (CW - b.width) // 2, gy - 60 + 6), b)
        d.text((x, 4), f'{k}  {name}', font=font, fill=LABEL)
    d.text((10, 30 + PH + SH + WH + 30), '위: 사진 · 가운데: 한 색 실루엣(--grey-800) · 아래: 벽 실제 크기 — 땅 32px 위에 키 60px', font=small, fill=LABEL)
    sheet.save(f'{S}/../grass-{sp}.png'); print(sp, sheet.size)
