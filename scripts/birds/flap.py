# 날갯짓 장면 맞추기 — 장면마다 몸통 덩이(굵게 열어 날개 · 꼬리 · 머리를 걷은 것)의 가운데 · 기울기 · 길이를 기준 장면에 맞춘다.
# 결과: 같은 판(크기 S) 위에 겹친 장면들 → 확인판 · 움직이는 견본.
import json, os, sys
import numpy as np, cv2
sys.stdout.reconfigure(encoding="utf-8")
from paths import ROOT, WORK as OUT, mask as _mask
S = 1500

def disk(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))

def load(id_):
    a = (cv2.imread(_mask("cut", id_), 0) > 127).astype(np.uint8)
    ys, xs = np.nonzero(a); L = max(np.ptp(xs), np.ptp(ys))
    a = (cv2.GaussianBlur(a.astype(np.float32), (0, 0), max(0.8, 0.004 * L)) > 0.5).astype(np.uint8)
    return a, L

def core(a, L, rf=0.09):
    C = cv2.morphologyEx(a, cv2.MORPH_OPEN, disk(max(3, round(rf * L))))
    n, lb, st, _ = cv2.connectedComponentsWithStats(C)
    C = (lb == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
    ys, xs = np.nonzero(C); P = np.stack([xs, ys], 1).astype(np.float64)
    c = P.mean(0); U, Sv, Vt = np.linalg.svd(P - c, full_matrices=False)
    ax = Vt[0]
    if ax[0] < 0: ax = -ax                      # 머리가 왼쪽 — 축은 오른쪽(꼬리)으로
    proj = (P - c) @ ax
    return c, np.arctan2(ax[1], ax[0]), np.ptp(proj), C

# 머리 가운데 · 꼬리 끝(판 비율) — 두 점을 기준 장면에 맞춘다(닮음 변환)
ANCHOR = {"k015": ((0.18, 0.30), (0.91, 0.355)), "k022": ((0.28, 0.58), (0.97, 0.41)), "k023": ((0.39, 0.585), (0.94, 0.50))}

def align2(ids, ref):
    def pts(id_, a):
        h, w = a.shape; (hx, hy), (tx, ty) = ANCHOR[id_]
        return np.array([hx * w, hy * h]), np.array([tx * w, ty * h])
    ra, _ = load(ref); RH, RT = pts(ref, ra)
    rv = RT - RH; rlen = np.hypot(*rv); rth = np.arctan2(rv[1], rv[0])
    out = {}
    for id_ in ids:
        a, _ = load(id_); H, T = pts(id_, a); v = T - H
        s = rlen / np.hypot(*v); dth = rth - np.arctan2(v[1], v[0])
        c, sn = np.cos(dth) * s, np.sin(dth) * s
        M = np.array([[c, -sn, 0], [sn, c, 0]], np.float64)
        mid_src = (H + T) / 2; M[:, 2] = np.array([S / 2, S / 2]) - M[:, :2] @ mid_src
        out[id_] = cv2.warpAffine(a * 255, M, (S, S), flags=cv2.INTER_LINEAR) > 127
        print(id_, "길이 비", round(s, 3), "돌림", round(np.degrees(dth), 1))
    return out

def align(ids, ref):
    ra, rL = load(ref); rc, rth, rlen, _ = core(ra, rL)
    out = {}
    for id_ in ids:
        a, L = load(id_); c, th, ln, C = core(a, L)
        s = rlen / ln; dth = rth - th
        M = cv2.getRotationMatrix2D((float(c[0]), float(c[1])), np.degrees(-dth), s)
        M[:, 2] += np.array([S / 2, S / 2]) - c
        out[id_] = cv2.warpAffine(a * 255, M, (S, S), flags=cv2.INTER_LINEAR) > 127
        print(id_, "몸통 길이 비", round(s, 3), "돌림", round(np.degrees(dth), 1))
    return out

if __name__ == "__main__":
    ids = sys.argv[1].split(","); ref = sys.argv[2]; tag = sys.argv[3]
    fr = align2(ids, ref) if all(i in ANCHOR for i in ids) else align(ids, ref)
    # 확인판: 장면들 나란히 + 겹침(색으로)
    tiles = []
    for id_ in ids: tiles.append(np.where(fr[id_][..., None], 0, 255).astype(np.uint8).repeat(3, 2))
    over = np.full((S, S, 3), 255, np.uint8)
    cols = [(230, 60, 60), (40, 150, 40), (40, 80, 230), (200, 120, 0)]
    for k, id_ in enumerate(ids):
        m = fr[id_]; over[m] = (over[m] * 0.45 + np.array(cols[k]) * 0.55).astype(np.uint8)
    sheet = np.concatenate(tiles + [over], 1)
    cv2.imwrite(os.path.join(OUT, f"flap-{tag}.png"), cv2.resize(sheet, (sheet.shape[1] // 2, S // 2), interpolation=cv2.INTER_AREA))
    np.savez_compressed(os.path.join(OUT, f"flap-{tag}.npz"), **{k: v for k, v in fr.items()})
