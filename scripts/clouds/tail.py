# 다정한의 띠 구름 — 몸통은 그대로, 꼬리만 '혹의 사슬'로 다시 짓는다(2026-10-01).
#
#   python scripts/clouds/tail.py
#
# 고른 띠 12장(design/cloud-photo/band)의 꼬리가 "구름이 아니라 코브라 같다"는 말을 들었다. 몸통 · 꼬리 길이 · 방향은
# 디자이너가 그대로 두자 했고, 꼬리를 **그리는 법**만 지브리 · 가와세 하스이 식으로 바꾼다(design/landscape.md '구름'):
#   · 혹의 사슬 — 몸통에서 멀어질수록 둥근 혹이 하나씩 작아지고 낮아진다. 지금은 사진 조각 하나가 가늘게 빠졌다
#   · 끝 너머 떨어진 조각 한두 개 — 지금은 뾰족하게 빠졌다
#   · 톱니 대신 둥근 잔 혹 — 사진 머리를 혹 크기로 줄여 반타원 지붕 안에 담고 혹 키의 10%로 뭉갠다
#   · 혹마다 밑 양끝이 살짝 들린다
#   · 두께 — 꼬리 뿌리가 몸통 최대 두께의 ROOT(1/4). 지금(1/5) · 1/4 · 지브리 장면만큼(1/3) 격자에서 골랐다.
#     벽 실제 크기에서 지금 꼬리는 10px 안팎이라 그 안에 혹을 그려도 톱니로만 읽혔다
#
# 길이는 지금 앱에 보이는 꼬리 그대로 — 앱이 몸통 밖을 옆으로 0.5배 누르던 것(PRESS)을 여기서 미리 하고 그 위에 짓는다.
# 앱은 이제 누르지 않는다(PERSONAS.doran.photo.tail = 1). 몸통 끝은 띠 판에서 두께로 다시 재지 않고 **앱이 실제로 보는
# 자리**를 쓴다(band-chain/bodies.json — 옛 자료로 글 열두 개를 지어 몸통 상자 끝을 띠 좌표로 되돌린 가운데값. 띠 판에서
# 두께 40%로 다시 재면 앱보다 좁아 꼬리가 7~14% 짧아졌다).
#
# 결과는 임시 폴더(CLOUD_OUT, 없으면 OS 임시 폴더의 megafont-clouds-tail)에 쓴다 — 고른 판(band-chain)을 덮어쓰지 않는다.
# 같은 씨앗이라 다시 돌리면 같은 판이 나온다.
import cv2, numpy as np, json, os, tempfile

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BAND = os.path.join(ROOT_DIR, 'design', 'cloud-photo', 'band')
CROWN = os.path.join(ROOT_DIR, 'design', 'cloud-photo', 'crowns')
CHAIN = os.path.join(ROOT_DIR, 'design', 'cloud-photo', 'band-chain')
OUT = os.environ.get('CLOUD_OUT') or os.path.join(tempfile.gettempdir(), 'megafont-clouds-tail')
os.makedirs(OUT, exist_ok=True)
ROOT = float(os.environ.get('ROOT', 0.27))    # 꼬리 뿌리 두께 — 몸통 최대 두께의 몫(1/4 격자 칸은 0.27로 지었다)
SMOOTH = 0.1          # 혹을 뭉개는 폭(혹 키의 몫) — 톱니가 둥근 잔 혹이 된다
PRESS = 0.5           # 지금 앱이 몸통 밖을 옆으로 누르던 배수 — 꼬리 길이를 지금과 같게
BODIES = json.load(open(os.path.join(CHAIN, 'bodies.json'), encoding='utf-8'))

crowns = []
for i in range(1, 8):                                   # c00(고리 모양)은 뺀다 — 끝에 구멍 · 부스러기가 났다
    a = cv2.imread(os.path.join(CROWN, f'c0{i}.png'), cv2.IMREAD_UNCHANGED)[:, :, 3].astype(np.float32) / 255
    ys, xs = np.nonzero(a > 0.5); crowns.append(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1])


def lobe(rng, w, h, lift_b):
    """혹 하나 — 사진 머리를 (w, h)로 줄여 반타원 지붕 안에 담고, 밑 양끝을 lift_b만큼 들고, 혹 크기에 맞춰 뭉갠다"""
    w, h = max(6, int(w)), max(5, int(h))
    a = crowns[rng.integers(len(crowns))]
    if rng.random() < 0.5: a = a[:, ::-1]
    # 머리를 키 h 그대로, 폭만 조금 넉넉히 줄여 가운데를 자른다 — 윗선(사진의 잔 혹)은 살고 잘린 옆은 지붕이 둥글게 깎는다.
    # 키를 넉넉히 잡고 밑을 잘랐더니 머리의 윗결이 잘려 혹 지붕이 평평한 사다리꼴이 됐다
    ww = int(w * 1.15)
    p = cv2.resize(np.ascontiguousarray(a), (ww, h), interpolation=cv2.INTER_AREA)[:, (ww - w) // 2:(ww - w) // 2 + w]
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    u = (X + 0.5 - w / 2) / (w / 2)
    dome = (h - Y) <= h * np.sqrt(np.clip(1 - u * u, 0, 1))                  # 둥근 지붕(반타원)
    belly = (h - 1 - Y) >= lift_b * (1 - np.sqrt(np.clip(1 - u * u, 0, 1)))   # 밑 양끝이 들린다
    m = ((p > 0.5) & dome & belly).astype(np.float32)
    return (cv2.GaussianBlur(m, (0, 0), max(1.0, SMOOTH * h)) > 0.5).astype(np.uint8)


def stamp(dst, src, cx, bottom):
    h, w = src.shape; x0, y0 = int(round(cx - w / 2)), int(round(bottom - h + 1))
    xs, ys, xe, ye = max(0, x0), max(0, y0), min(dst.shape[1], x0 + w), min(dst.shape[0], y0 + h)
    if xe > xs and ye > ys: dst[ys:ye, xs:xe] |= src[ys - y0:ye - y0, xs - x0:xe - x0]


def rebuild(vid):
    """→ (지금 앱에 보이는 판, 꼬리를 다시 지은 판, 쪽마다 기록)"""
    m = np.load(os.path.join(BAND, f'{vid}_mask.npz'))['m'].astype(np.uint8)
    rng = np.random.default_rng(int(vid[1:]) * 97 + 5)
    Tm = m.sum(0).max()
    bx0, bx1 = BODIES[vid][0], BODIES[vid][1]
    base = int(np.median([np.nonzero(m[:, x])[0].max() for x in range(bx0, bx1 + 1) if m[:, x].any()]))
    pad = 40                                           # 떨어진 조각 여유
    m = np.pad(m, ((0, 0), (pad, pad))); bx0 += pad; bx1 += pad
    W = m.shape[1]
    body = m.copy(); body[:, :bx0] = 0; body[:, bx1 + 1:] = 0
    # 지금 앱에 보이는 꼬리 — 몸통 밖을 0.5배로 누른다
    now = body.copy()
    for sd, edge in ((-1, bx0), (1, bx1)):
        src = m * ((np.arange(W) < edge) if sd < 0 else (np.arange(W) > edge))[None, :]
        ys, xs = np.nonzero(src)
        now[ys, np.round(edge + (xs - edge) * PRESS).astype(int)] = 1
    now = cv2.morphologyEx(now, cv2.MORPH_CLOSE, np.ones((1, 3), np.uint8))
    Tn = now.sum(0).astype(np.float32)
    Tns = cv2.GaussianBlur(Tn.reshape(1, -1), (0, 0), 3).ravel()
    keep, tail, info = now.copy(), np.zeros_like(m), []
    for sd, edge in ((-1, bx0), (1, bx1)):
        ext = np.nonzero(Tn > 0)[0]; tip = ext.min() if sd < 0 else ext.max()
        L0 = abs(tip - edge)
        if L0 < 4: continue
        # 지금 꼬리가 뿌리 두께 h0로 가늘어지는 곳(xt)에서 잘라 그 바깥을 혹의 사슬로. 그 안쪽의 덩이는 그대로 둔다
        h0 = ROOT * Tm
        xt = next((edge + sd * d for d in range(L0) if Tns[edge + sd * d] < h0 * 1.05), None)
        if xt is None: continue
        L = abs(tip - xt)
        if L < 0.6 * h0: continue
        if sd < 0: keep[:, :xt] = 0
        else: keep[:, xt + 1:] = 0
        # 혹은 자른 자리의 실제 밑에 선다 — 몸통 밑선이 출렁이는 띠가 있어 평균 밑선에 세우면 자른 자리에 단이 생겼다
        near = keep[:, min(xt, xt - sd * 6):max(xt, xt - sd * 6) + 1]
        bl = int(np.nonzero(near.any(1))[0].max()) if near.any() else base
        # 혹 n개 · 줄어드는 비 q — 혹이 꼬리 길이의 92%를 덮고 끝 혹이 첫 혹의 55~72%가 되는 짝(더 작아지면 끝이 먼지 같았다)
        best = None
        for n in range(1, 9):
            for q in np.linspace(0.62, 0.95, 34):
                hs = h0 * q ** np.arange(n); ws = hs * 1.7
                span = ws[0] * 0.5 + sum(ws[i] * 0.6 for i in range(1, n))
                last = hs[-1] / h0
                cost = abs(span - 0.92 * L) / L + (0 if 0.55 <= last <= 0.72 or n == 1 else 0.5 * min(abs(last - 0.55), abs(last - 0.72)))
                if best is None or cost < best[0]: best = (cost, n, q)
        _, n, q = best
        x, lobes = 0.0, []
        for i in range(n):
            h = h0 * q ** i * (rng.uniform(0.92, 1.08) if i else 1.0)
            w = h * rng.uniform(1.55, 1.85)
            cx = 0.0 if i == 0 else x + w * 0.5            # 첫 혹은 자른 면 위에 가운데를 둔다(면을 덮는다)
            lobes.append((cx, w, h))
            x = cx + w * 0.5 - w * rng.uniform(0.35, 0.45)  # 35~45% 겹친다 — 반쯤 겹치면 혹이 비탈로 뭉개졌다
        end = max(cx + w / 2 for cx, w, h in lobes)
        hp, pieces = lobes[-1][2] * rng.uniform(0.78, 0.86), []
        for j in range(2):                                 # 떨어진 조각 — 끝 혹의 0.8배쯤, 둘째는 그 0.65배쯤
            gap = hp * rng.uniform(0.35, 0.55); wp = hp * rng.uniform(1.5, 1.8)
            if end + gap + wp > L * 1.18 or hp < 3: break
            pieces.append((end + gap + wp / 2, wp, hp)); end = end + gap + wp
            hp *= rng.uniform(0.62, 0.7)
        for k, (cx, w, h) in enumerate(lobes):
            stamp(tail, lobe(rng, w, h, h * rng.uniform(0.1, 0.2) if k else 0), xt + sd * cx, bl)
        for cx, w, h in pieces:
            stamp(tail, lobe(rng, w, h, h * rng.uniform(0.15, 0.25)), xt + sd * cx, bl - h * rng.uniform(0.04, 0.12))
        info.append({'side': sd, 'len': int(L), 'lobes': len(lobes), 'pieces': len(pieces)})
    return now, keep | tail, info


def crop1000(m):
    """band.py처럼 둘레에 4% 여백을 두고 자른 뒤 가로 1000으로"""
    ys, xs = np.nonzero(m); mg = int(0.04 * max(np.ptp(xs), np.ptp(ys)))
    m = m[max(0, ys.min() - mg):ys.max() + mg + 1, max(0, xs.min() - mg):xs.max() + mg + 1]
    return (cv2.resize(m.astype(np.float32), (1000, round(m.shape[0] * 1000 / m.shape[1])), interpolation=cv2.INTER_AREA) > 0.5).astype(np.uint8)


def rings(m):
    """윤곽 — 큰 덩이 하나(outline)와 떨어진 조각들(extra). 점 줄이기는 band.py와 같은 0.0008L"""
    cs = sorted(cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea, reverse=True)
    out = [cv2.approxPolyDP(c, 0.8, True)[:, 0, :].tolist() for c in cs if cv2.contourArea(c) > 12]
    return out[0], out[1:]


res = []
for i in range(12):
    vid = f'b{i:02d}'
    now, new, info = rebuild(vid)
    m = crop1000(new)
    outline, extra = rings(m)
    res.append({'id': vid, 'w': m.shape[1], 'h': m.shape[0], 'outline': outline, 'extra': extra})
    cv2.imwrite(os.path.join(OUT, f'{vid}_mask.png'), m * 255)
    cv2.imwrite(os.path.join(OUT, f'{vid}_now.png'), crop1000(now) * 255)
    print(vid, info)
json.dump({'variants': res}, open(os.path.join(OUT, 'band.json'), 'w', encoding='utf-8'))
print('→', OUT)
