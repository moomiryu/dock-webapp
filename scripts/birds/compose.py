# 작은 새의 날갯짓 — 앉은 둥근 새(다리 걷은 판)의 몸에 종다리(w090)의 날개를 붙여 세 장면(올림 · 수평 · 내림)을 짓는다.
# 날개는 종다리 판에서 몸 윗선 위(올림) · 아랫선 아래(내림)를 떼고, 수평은 올린 날개를 꼬리 쪽으로 눕힌다.
# 크기는 몸통 덩이 넓이의 비(√)로, 붙는 자리는 몸통 덩이의 등(올림 · 수평) · 가운데(내림).
import json, os, sys
import numpy as np, cv2
sys.stdout.reconfigure(encoding="utf-8")
from paths import ROOT, WORK as OUT, mask as _mask
ROUND = "r1546 r1127 r870 r1062 r561 r012 r1148 r254 r764".split()
FACE = {"r1546": 1, "r1127": -1, "r870": -1, "r1062": 1, "r561": 1, "r012": 1, "r1148": 1, "r254": -1, "r764": 1}   # 1 = 머리가 오른쪽
WING = float(os.environ.get("WING", "1.0"))      # 날개 크기 배수(격자로 고를 값)
MID = float(os.environ.get("MID", "35"))         # 수평 장면 — 올린 날개를 꼬리 쪽으로 눕히는 각(도)

def disk(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
def mask(path): return (cv2.imread(path, 0) > 127).astype(np.uint8)
def core(a, rf=0.10):
    ys, xs = np.nonzero(a); L = max(np.ptp(xs), np.ptp(ys))
    C = cv2.morphologyEx(a, cv2.MORPH_OPEN, disk(max(3, round(rf * L))))
    n, lb, st, _ = cv2.connectedComponentsWithStats(C)
    return (lb == 1 + np.argmax(st[1:, 4])).astype(np.uint8)

# 종다리 — 머리가 왼쪽. 날개 조각과 뿌리(판 좌표)
lark = mask(_mask("cut", "w090")); LH, LW = lark.shape
yy, xx = np.mgrid[0:LH, 0:LW]
up_root = np.array([0.50 * LW, 0.425 * LH]); down_root = np.array([0.48 * LW, 0.545 * LH])
near = lambda r, k: np.hypot(xx - r[0], yy - r[1]) < k * LW
up = lark * (((yy < 0.425 * LH) & (xx > 0.38 * LW) & (xx < 0.72 * LW)) | near(up_root, 0.07))   # 밑동은 둥글게 남겨 몸에 묻는다
down = lark * (((yy > 0.545 * LH) & (xx < 0.62 * LW)) | near(down_root, 0.07))
lark_core_area = core(lark).sum()

def paste(canvas, piece, root, at, s, rot, flip):
    """piece(판)를 root 기준으로 s배 · rot도 돌리고(flip이면 좌우 뒤집어) canvas의 at에 얹는다"""
    M = cv2.getRotationMatrix2D((float(root[0]), float(root[1])), rot, s)
    if flip:   # 뿌리를 축으로 좌우 뒤집기
        F = np.array([[-1, 0, 2 * root[0]], [0, 1, 0]], np.float64)
        M = M @ np.vstack([F, [0, 0, 1]])
    M[:, 2] += at - root
    w = cv2.warpAffine(piece * 255, M, (canvas.shape[1], canvas.shape[0]), flags=cv2.INTER_LINEAR) > 127
    return canvas | w.astype(np.uint8)

def frames(id_):
    a = mask(_mask("cut2", id_))
    pad = 500; a = cv2.copyMakeBorder(a, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    C = core(a); ys, xs = np.nonzero(C)
    cx, cy = xs.mean(), ys.mean(); top, bot = ys.min(), ys.max(); cw = np.ptp(xs)
    face = FACE[id_]; flip = face == 1                       # 종다리는 머리가 왼쪽 — 오른쪽을 보는 새는 날개를 뒤집는다
    s = np.sqrt(C.sum() / lark_core_area) * WING
    shoulder = np.array([cx + face * 0.06 * cw, top + 0.30 * (bot - top)])
    belly = np.array([cx + face * 0.05 * cw, cy])
    rot_mid = -MID if not flip else MID                      # 꼬리 쪽으로 눕힌다
    f_up = paste(a.copy(), up, up_root, shoulder, s, 0, flip)
    f_mid = paste(a.copy(), up, up_root, shoulder, s, rot_mid, flip)
    f_down = paste(a.copy(), down, down_root, belly, s, 0, flip)
    # 틈 메우기 — 날개 밑동과 몸 사이의 가는 틈(몸 길이의 1.5%)을 닫는다
    L = max(np.ptp(np.nonzero(a)[1]), np.ptp(np.nonzero(a)[0])); r = max(2, round(0.015 * L))
    f_up, f_mid, f_down = [cv2.morphologyEx(f, cv2.MORPH_CLOSE, disk(r)) for f in (f_up, f_mid, f_down)]
    ys, xs = np.nonzero(f_up | f_mid | f_down | a)
    box = (xs.min() - 10, ys.min() - 10, xs.max() + 10, ys.max() + 10)
    crop = lambda m: m[box[1]:box[3], box[0]:box[2]]
    return {"sit": crop(a), "up": crop(f_up), "mid": crop(f_mid), "down": crop(f_down)}

if __name__ == "__main__":
    tag = sys.argv[1] if len(sys.argv) > 1 else "v1"
    os.makedirs(os.path.join(OUT, "flap"), exist_ok=True)
    rows = []
    for id_ in ROUND:
        fr = frames(id_)
        for k, m in fr.items(): cv2.imwrite(os.path.join(OUT, "flap", f"{id_}-{k}.png"), m * 255)
        cell = 260
        tiles = []
        for k in ("sit", "up", "mid", "down"):
            m = fr[k]; h, w = m.shape; s = cell / max(h, w)
            t = cv2.resize((1 - m) * 255, (max(1, int(w * s)), max(1, int(h * s))), interpolation=cv2.INTER_AREA)
            T = np.full((cell, cell), 255, np.uint8); T[(cell - t.shape[0]) // 2:(cell - t.shape[0]) // 2 + t.shape[0], (cell - t.shape[1]) // 2:(cell - t.shape[1]) // 2 + t.shape[1]] = t
            tiles.append(T)
        rows.append(np.concatenate(tiles, 1))
    sheet = np.concatenate(rows, 0)
    cv2.imwrite(os.path.join(OUT, f"compose-{tag}.png"), sheet)
    print("ok")
