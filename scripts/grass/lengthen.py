# 민들레 줄기 늘리기(디자이너 10-04 "자연스럽게") — 사진 줄기의 굵기 · 기운 방향을 이어받아, 밑동으로 갈수록 곧게 서는 완만한 곡선.
# 길이 = 머리 지름 × 3.5~6(이름이 씨앗 — 같은 포기는 늘 같은 길이). 굵기는 밑동 쪽이 조금(15%) 굵다. d035는 이미 길다
import numpy as np, sys, zlib
S = sys.argv[1]
def runs_near(row, cx):
    xs = np.nonzero(row)[0]
    if not len(xs): return None
    segs, s = [], xs[0]
    for a, b in zip(xs, xs[1:]):
        if b != a + 1: segs.append((s, a)); s = b
    segs.append((s, xs[-1]))
    return min(segs, key=lambda r: abs((r[0] + r[1]) / 2 - cx))
for k in sys.argv[2:] or ['d030', 'd044', 'd069', 'd070', 'd076', 'd082']:
    m = np.load(f'{S}/sil/{k}.npy').astype(np.uint8); H, W = m.shape
    # 줄기 폭 · 가운데 — 밑 12% 줄들에서
    cx = np.nonzero(m[H - 1])[0].mean(); widths = []
    for y in range(H - 1, int(H * 0.88), -1):
        r = runs_near(m[y], cx)
        if r: widths.append(r[1] - r[0] + 1); cx = (r[0] + r[1]) / 2
    ws = float(np.median(widths))
    # 머리 밑 — 밑에서 올라가며 폭이 줄기의 2.5배를 넘는 첫 줄
    cx = np.nonzero(m[H - 1])[0].mean(); centers = {}
    yj = 0
    for y in range(H - 1, -1, -1):
        r = runs_near(m[y], cx)
        if not r: continue
        if r[1] - r[0] + 1 > ws * 2.5: yj = y; break
        cx = (r[0] + r[1]) / 2; centers[y] = cx
    head_top = np.nonzero(m.any(1))[0].min(); head_d = max(yj - head_top, int(np.ptp(np.nonzero(m[:yj + 1].any(0))[0])))
    # 사진 줄기는 머리 밑에서 머리 지름의 0.3배까지만 남기고, 그 끝의 방향을 잰다
    yk = min(H - 1, yj + max(4, int(head_d * 0.3)))
    ys_ = [y for y in centers if yj < y <= yk]; ys_.sort()
    if len(ys_) >= 3:
        slope = np.polyfit(ys_, [centers[y] for y in ys_], 1)[0]
    else:
        slope = 0.0
    tx, ty = centers.get(yk, cx), yk
    if k == 'd035': ws = max(2.0, head_d * 0.13)   # 사진 줄기가 머리에 비해 굵다(0.25배) — 다른 홀씨(0.08~0.15배)에 맞춘다
    r = 3.5 + (zlib.crc32(k.encode()) % 1000) / 1000 * 2.5
    L = int(head_d * r)
    # 2차 곡선: 위 끝 T(사진 줄기 방향), 조절점 C = T + 방향 × L/2, 밑 B = (C.x, T.y + L) — 밑동에서 수직
    d = np.array([slope, 1.0]); d /= np.linalg.norm(d)
    T = np.array([tx, ty]); C = T + d * (L * 0.5); B = np.array([C[0], ty + L])
    pts = [(1 - t) ** 2 * T + 2 * (1 - t) * t * C + t ** 2 * B for t in np.linspace(0, 1, L * 2)]
    xs_all = [p[0] for p in pts]
    pad_l = int(max(0, -min(xs_all) + ws * 2)); pad_r = int(max(0, max(xs_all) - W + ws * 2))
    out = np.zeros((ty + L + 2, W + pad_l + pad_r), np.uint8)
    out[:yk + 1, pad_l:pad_l + W] = m[:yk + 1]
    for i, p in enumerate(pts):
        t = i / (len(pts) - 1); wd = ws * (1 + 0.15 * t)
        x, y = p[0] + pad_l, int(round(p[1]))
        out[y, max(0, int(x - wd / 2)):int(x + wd / 2) + 1] = 1
    ys, xs = np.nonzero(out)
    np.save(f'{S}/sil/{k}.npy', out[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    print(k, head_d, round(ws, 1), round(slope, 2), round(r, 1))
