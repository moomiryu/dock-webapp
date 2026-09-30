# 다정한의 띠 구름 — 사진에서 딴 구름 머리로 새 구름을 짓는다(2026-09-30).
#
# 고른 12장은 design/cloud-photo/band/에 있다. 이 스크립트는 **새로** 지을 때 쓴다 — 결과는 임시 폴더
# (CLOUD_OUT, 없으면 OS 임시 폴더의 megafont-clouds)에 쓰고 고른 12장을 덮어쓰지 않는다.
#
#   python scripts/clouds/band.py 12          # 12장
#
# 재료: design/cloud-photo/crowns/의 머리 8개(격자에서 눈으로 고른 것 — 출처는 crowns.json, 원본 사진과
# 라이선스는 src/sources.json). 머리는 원본 사진에서 '위에서부터 채운 하늘'을 빼고 여러 높이의 가로선에서
# 잘라 뗐다 — 잘린 밑이 뭉게구름의 평평한 밑이 된다.
#
# 짓는 법(디자이너 레퍼런스: 보라 띠 — 가로로 긴 띠, 한쪽 묵직 → 가는 꼬리, 한쪽 선은 완만 · 반대쪽은 둥근 돌출):
#   머리 3~5개를 밑선 위에 한쪽으로 점점 작게, 세로로 눌러 겹쳐 세우고 → 끝에 혀 모양 꼬리 →
#   약하게 휜다. 여기까지가 격자에서 본 '띠'이고, 디자이너가 위아래를 되돌리라 해서
#   마지막에 한 번 더 뒤집는다 — 평평한 밑 · 위로 둥근 봉우리 · 옆으로 흐르는 꼬리.
#
# 버린 것(같은 날 격자): 옆으로 퍼진 층적운 조각(해안선처럼 들쭉날쭉해 구름으로 안 읽혔다) · 세로로 쌓은
# 탑(한 톤이면 돌 · 자루처럼 읽혀 차분한의 돌과 헷갈렸다) · 가로 늘임 1.6(구름을 납작하게) · 두 톤(원톤으로).
import cv2, numpy as np, json, os, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.path.join(ROOT, 'design', 'cloud-photo')
OUT = os.environ.get('CLOUD_OUT') or os.path.join(tempfile.gettempdir(), 'megafont-clouds')
os.makedirs(OUT, exist_ok=True)
N = int(sys.argv[1]) if len(sys.argv) > 1 else 12
SKY = np.array([0.21, 0.42, 0.72], np.float32)

crowns = []
for c in json.load(open(os.path.join(DATA, 'crowns', 'crowns.json'), encoding='utf-8')):
    im = cv2.imread(os.path.join(DATA, 'crowns', c['file']), cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
    crowns.append({'src': c['src'], 'rgb': im[:, :, [2, 1, 0]], 'a': im[:, :, 3], 'hw': im.shape[0] / im.shape[1]})


def scaled(c, height, flip):
    rgb, a = c['rgb'], c['a']
    if flip: rgb, a = rgb[:, ::-1], a[:, ::-1]
    s = height / a.shape[0]
    it = cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC
    return cv2.resize(np.ascontiguousarray(rgb), None, fx=s, fy=s, interpolation=it), np.clip(cv2.resize(np.ascontiguousarray(a), None, fx=s, fy=s, interpolation=it), 0, 1)


def put(P, A, rgb, a, cx, base):
    """밑을 base에 맞춰 세운다(빛의 스크린 — 이음매 없음)"""
    h, w = a.shape; x0, y0 = int(cx - w / 2), int(base - h)
    xs, ys, xe, ye = max(0, x0), max(0, y0), min(A.shape[1], x0 + w), min(A.shape[0], y0 + h)
    aa = a[ys - y0:ye - y0, xs - x0:xe - x0, None]
    P[ys:ye, xs:xe] = 1 - (1 - P[ys:ye, xs:xe]) * (1 - rgb[ys - y0:ye - y0, xs - x0:xe - x0] * aa)
    A[ys:ye, xs:xe] = 1 - (1 - A[ys:ye, xs:xe]) * (1 - aa[..., 0])



def variant_band(seed):
    """레퍼런스(보라 띠)의 구름 — 가로로 긴 띠, 한쪽 묵직 → 반대쪽 가는 꼬리, 윗선 완만 · 수평, 아랫선 둥근 돌출과 골.
    둥근 머리를 밑선 위에 왼→오 점점 작게 세우고 끝에 납작한 꼬리를 붙인 뒤 위아래를 뒤집는다 —
    평평한 밑선이 완만한 윗선이 되고, 봉우리들이 아랫선의 둥근 돌출이 된다"""
    rng = np.random.default_rng(11000 + seed)
    W, H = 2800, 1000
    P, A = np.zeros((H, W, 3), np.float32), np.zeros((H, W), np.float32)
    base = H * 0.86
    n = int(rng.choice([3, 4, 5], p=[0.35, 0.4, 0.25]))
    f = np.linspace(1.0, rng.uniform(0.3, 0.45), n) * rng.uniform(0.85, 1.15, n)
    span = rng.uniform(0.5, 0.62) * W
    ws = f / f.sum() * span * rng.uniform(1.3, 1.55)
    xs = [0.0]
    for i in range(1, n): xs.append(xs[-1] + (ws[i - 1] + ws[i]) / 2 * rng.uniform(0.4, 0.6))   # 더 겹쳐 두께가 부드럽게 오르내리게
    xs = np.array(xs); xs += W * 0.42 - (xs[0] + xs[-1]) / 2
    names = []
    for i in range(n):
        c = crowns[rng.integers(len(crowns))]
        rgb, a = scaled(c, ws[i] * c['hw'], rng.random() < 0.5)
        k = rng.uniform(0.45, 0.62)                             # 세로로 눌러 봉우리를 얕게 — 깊으면 고드름처럼 매달렸다(첫 판)
        rgb = cv2.resize(rgb, (rgb.shape[1], max(8, int(rgb.shape[0] * k))), interpolation=cv2.INTER_AREA)
        a = np.clip(cv2.resize(a, (a.shape[1], rgb.shape[0]), interpolation=cv2.INTER_AREA), 0, 1)
        put(P, A, rgb, a, xs[i], base + rng.uniform(-0.01, 0.01) * H)
        names.append(c['src'])
    if rng.random() < 0.85:                                      # 꼬리 — 혀처럼: 밑동이 두껍고 끝으로 가늘어진다
        c = crowns[rng.integers(len(crowns))]
        tw = ws[-1] * rng.uniform(1.2, 2.0)
        th = max(8, int(ws[-1] * c['hw'] * rng.uniform(0.35, 0.5)))
        src = c['rgb'][:, ::-1] if rng.random() < 0.5 else c['rgb']
        rgb = cv2.resize(np.ascontiguousarray(src), (int(tw), th), interpolation=cv2.INTER_AREA)
        a = np.clip(cv2.resize(np.ascontiguousarray(c['a']), (int(tw), th), interpolation=cv2.INTER_AREA), 0, 1)
        ramp = (1 - np.linspace(0, 1, int(tw), dtype=np.float32)) ** 0.6
        a = a * (0.35 + 0.65 * ramp)[None, :] + 0.0
        a = np.clip(a * 1.25 * ramp[None, :] ** 0.25, 0, 1)
        put(P, A, rgb, a, xs[-1] + ws[-1] * 0.2 + tw / 2, base)
        names.append(c['src'])
    xx = np.arange(W, dtype=np.float32)
    # 밑선(뒤집으면 윗선) — 긴 흐름은 수평, 작은 요철은 있게
    walk = cv2.GaussianBlur(rng.normal(0, 1, W).astype(np.float32).reshape(1, -1), (0, 0), 9).ravel()
    walk = walk / (np.abs(walk).max() + 1e-6)
    wave = base + (np.sin(xx / W * np.pi * rng.uniform(1.0, 2.2) + rng.uniform(0, 6.3)) * 0.012 + walk * 0.014) * H   # 윗선의 잔 요철 — 0.006은 자로 그은 선 같았다
    below = (np.arange(H)[:, None] > wave[None, :]).astype(np.float32)
    fade = cv2.GaussianBlur(below, (0, 0), 1.5)
    A *= (1 - fade); P *= (1 - fade[..., None])
    amp = rng.uniform(0.003, 0.008) * W
    dx = cv2.resize(rng.normal(size=(4, 10)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC) * amp
    dy = cv2.resize(rng.normal(size=(4, 10)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC) * amp * 0.5
    X, Y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    P = cv2.remap(P, X + dx, Y + dy, cv2.INTER_LINEAR, borderValue=0); A = cv2.remap(A, X + dx, Y + dy, cv2.INTER_LINEAR, borderValue=0)
    P, A = P[::-1], A[::-1]                                      # 위아래를 뒤집는다
    if rng.random() < 0.3: P, A = P[:, ::-1], A[:, ::-1]        # 묵직한 쪽은 주로 왼쪽, 가끔 오른쪽
    P, A = np.ascontiguousarray(P), np.ascontiguousarray(A)
    yy, xs2 = np.where(A > 0.02); mg = int(0.04 * max(np.ptp(xs2), np.ptp(yy)))
    y0, y1, x0, x1 = max(0, yy.min() - mg), min(A.shape[0], yy.max() + mg), max(0, xs2.min() - mg), min(A.shape[1], xs2.max() + mg)
    short = lambda t: t.replace('File:', '').split('.')[0][:24]
    return P[y0:y1, x0:x1], A[y0:y1, x0:x1], {'main': short(names[0]), 'side': n - 1, 'sy': 1.0, 'stack': ' / '.join(short(x) for x in names)}


def sky_bg(W, H):
    g = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    return np.broadcast_to(SKY * 0.82 * (1 - g) + np.minimum(SKY * 1.12, 1) * g, (H, W, 3)).copy()


def trace(P, A, long=1000):
    h, w = A.shape; s = long / max(h, w)
    A = cv2.resize(A, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    P = cv2.resize(P, (A.shape[1], A.shape[0]), interpolation=cv2.INTER_AREA)
    photo = sky_bg(A.shape[1], A.shape[0]) * (1 - A[..., None]) + P
    L = long
    a = cv2.GaussianBlur(A, (0, 0), 0.0012 * L)   # 찢긴 결이 살게 조금만 뭉갠다(0.004는 종 · 바위처럼 매끈했다)
    m = (a > 0.5).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(0.003 * L) | 1,) * 2))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    whole = float(st[1 + np.argmax(st[1:, 4]), 4] / max(1, st[1:, 4].sum()))
    m = (lab == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
    ff = m.copy(); cv2.floodFill(ff, np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8), (0, 0), 1); m = m | (1 - ff)
    c = max(cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea)
    outline = cv2.approxPolyDP(c, 0.0008 * L, True)[:, 0, :].tolist()
    m = np.zeros_like(m); cv2.fillPoly(m, [np.array(outline, np.int32)], 1)
    hull = cv2.convexHull(np.array(outline, np.int32))
    return {'w': m.shape[1], 'h': m.shape[0], 'outline': outline, 'shade': [], 'thr': 0.0,
            'solidity': round(float(m.sum() / max(1, cv2.contourArea(hull))), 3), 'whole': round(whole, 3), 'aspect': round(m.shape[1] / m.shape[0], 2)}, m, photo



# 구름다움의 문 — 가로로 긴 띠(폭 ÷ 높이 2.2~4.5), 옹골참 0.62 이상, 떨어져 나간 조각 없음
out, tried = [], 0
while len(out) < N and tried < N * 8:
    P, A, info = variant_band(tried); tried += 1
    P, A = np.ascontiguousarray(P[::-1]), np.ascontiguousarray(A[::-1])   # 위아래를 되돌린다(디자이너) — 평평한 밑, 위로 봉우리
    t, m, photo = trace(P, A)
    if not (2.2 <= t['aspect'] <= 4.5) or t['solidity'] < 0.62 or t['whole'] < 0.97: continue
    vid = f'b{len(out):02d}'
    cv2.imwrite(os.path.join(OUT, f'{vid}_photo.jpg'), (np.clip(photo, 0, 1) * 255).astype(np.uint8)[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 88])
    np.savez_compressed(os.path.join(OUT, f'{vid}_mask.npz'), m=m)
    out.append({'id': vid, 'seed': tried - 1, **{k: t[k] for k in ('w', 'h', 'aspect', 'solidity', 'outline')}, 'stack': info['stack']})
    print(vid, 'seed', tried - 1, 'aspect', t['aspect'], 'solid', t['solidity'])
json.dump({'variants': out}, open(os.path.join(OUT, 'band.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('만든 수', tried, '남긴 수', len(out), '→', OUT)
