# design/tree-photo(trees.json + alpha) → 앱 자료
#   src/assets/trees/<id>.png   그리는 판 — 키 1280, 초록 = 칠(255 · 0), 빨강 = 덩이 밑 그늘(빗금 자리). 빗금 무늬는 앱이 화면에서 그린다
#   src/lib/treePhoto.data.ts   재는 판 — 칸 격자(키 160)의 칠 · 그늘 비트, 수관 가운데 · 밑, 새가 앉는 끝
# 사진 한 장에 한 그루만 싣는다(trees.json에서 id = alpha인 것). 뒤집기 · 폭 늘이기 · 버드나무 가닥은 앱이 글마다 한다
# (cloud.ts treeFor · TreeArt, 2026-09-30 디자이너 — '구름처럼 유동성 있는 규칙'). 버드나무는 늘어뜨리기 전의 수관을 싣는다
# 결은 벽 480px에서 고른 값이라 큰 판은 shape.tree(px=1280/480)로 짓는다
import sys, os, json, base64, cv2, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); import shape

HERE = os.path.dirname(__file__)
APP = os.path.join(HERE, '..', '..')
IMG_H, GRID_H = 1280, 160


def bits(a):
    return base64.b64encode(np.packbits(a.astype(np.uint8).ravel(), bitorder='big').tobytes()).decode()


def grid_of(a, gw, full=0.5):
    """칸 격자 — 칸 안에서 a가 full 넘게 차면 1. 칠은 0.97(거의 다) — 버드나무 가닥 사이 1~2px 틈이 칸에서 뭉개져 글이
    가닥 커튼 위에 앉았다(글 200개 중 22~49개, 2026-09-30)"""
    return (cv2.resize(a.astype(np.float32), (gw, GRID_H), interpolation=cv2.INTER_AREA) > full).astype(np.uint8)


def crown(g):
    """수관 — 칠한 폭이 가장 넓은 줄의 30% 넘는 줄들. 가운데(칠의 무게중심)와 밑 줄"""
    w = g.sum(1).astype(np.float32); rows = np.nonzero(w >= 0.3 * w.max())[0]
    ys, xs = np.nonzero(g[rows.min():rows.max() + 1])
    return float(xs.mean() + 0.5), float(ys.mean() + rows.min() + 0.5), int(rows.max() + 1)


def trunk_top(g, crown_row):
    """줄기가 시작하는 줄 — 밑에서부터 올라가며 폭이 줄기 굵기(맨 밑 여덟 줄의 가운데 값)의 1.6배를 넘지 않는 데까지.
    수관 밑보다 위로는 안 올라간다. 앱이 이 아래 줄기만 늘여 나무 키를 다르게 한다(cloud.ts treeFor · TreeArt)"""
    w = g.sum(1).astype(float); H = len(w); base = np.median(w[H - 8:]); y = H - 1
    while y > 0 and w[y - 1] <= base * 1.6 + 1: y -= 1
    return max(y, crown_row)


def perches(g, bottom):
    """새가 앉는 끝 — 꼭대기, 그리고 수관 왼쪽 · 오른쪽 3분의 1에서 가장 높은 윗선. 칸 좌표(윗선 위)"""
    top = np.array([np.argmax(g[:, x]) if g[:, x].any() else GRID_H for x in range(g.shape[1])])
    cols = np.nonzero(top < bottom)[0]
    out, x0, x1 = [], cols.min(), cols.max() + 1
    for a, b in ((x0, x1), (x0, x0 + (x1 - x0) // 3), (x1 - (x1 - x0) // 3, x1)):
        seg = np.arange(a, b); k = int(seg[np.argmin(top[seg])])
        p = (k + 0.5, float(top[k]))
        if p not in out: out.append(p)
    return out


if __name__ == '__main__':
    T = json.load(open(os.path.join(shape.ROOT, 'trees.json'), encoding='utf-8'))['trees']
    os.makedirs(os.path.join(APP, 'src', 'assets', 'trees'), exist_ok=True)
    rows = []
    for t in [t for t in T if t['id'] == t['alpha']]:
        m, sh = shape.tree(t, Hd=IMG_H, px=IMG_H / 480, drape_on=False)
        H, W = m.shape
        img = np.zeros((H, W, 3), np.uint8); img[..., 1] = m * 255; img[..., 2] = (sh & m) * 255   # BGR — 초록 칠, 빨강 그늘
        cv2.imwrite(os.path.join(APP, 'src', 'assets', 'trees', f"{t['id']}.png"), img, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        gw = max(1, round(W * GRID_H / H))
        gp, gs = grid_of(m, gw, 0.97), grid_of(sh & m, gw)
        cx, cy, bottom = crown(grid_of(m, gw))
        pr = perches(grid_of(m, gw), bottom)
        tt = trunk_top(grid_of(m, gw), bottom)
        sp = 'pine' if t['species'] == 'pine' else 'willow'
        rows.append(f"  {{ id: '{t['id']}', species: '{sp}', drape: {'true' if 'drape' in t else 'false'}, gw: {gw}, gh: {GRID_H}, cx: {cx:.2f}, cy: {cy:.2f}, crown: {bottom}, trunk: {tt}, "
                    f"perch: [{', '.join(f'[{x:.1f}, {y:.1f}]' for x, y in pr)}],\n"
                    f"    img: new URL('../assets/trees/{t['id']}.png', import.meta.url).href,\n"
                    f"    paint: '{bits(gp)}',\n    shade: '{bits(gs)}' }}")
        print(t['id'], (H, W), 'grid', (GRID_H, gw), 'crown', round(cx), round(cy), bottom, 'perch', pr)
    head = """// 자동 생성 — scripts/trees/export.py가 design/tree-photo에서 만든다. 손으로 고치지 않는다.
// 당당한의 사진 나무 일곱 그루(2026-09-30, 디자이너가 격자로 고른 판) — 소나무 5 · 버드나무 2(늘어뜨리기 전의 수관, drape).
// 뒤집기 · 폭 늘이기 · 버드나무 가닥은 앱이 글마다 한다(cloud.ts treeFor · TreeArt).
// 그리는 판은 src/assets/trees/<id>.png(키 1280 — 초록 = 칠, 빨강 = 덩이 밑 그늘). 여기 있는 것은 재는 판이다:
// 칸 격자(키 gh = 160, 폭 gw) — paint = 칠(1), shade = 그늘(1), 줄 차례 · 큰 비트 먼저, base64.
// cx · cy = 수관 가운데(칸), crown = 수관 밑 줄(칸), trunk = 줄기가 시작하는 줄(칸 — 그 아래는 줄기뿐), perch = 새가 앉는 끝(칸, 윗선 위).

export interface TreeShape {
  id: string; species: 'pine' | 'willow'; drape: boolean; gw: number; gh: number; cx: number; cy: number; crown: number; trunk: number;
  perch: readonly (readonly [number, number])[]; img: string; paint: string; shade: string;
}

export const TREE_PHOTOS: readonly TreeShape[] = [
"""
    open(os.path.join(APP, 'src', 'lib', 'treePhoto.data.ts'), 'w', encoding='utf-8', newline='\n').write(head + ',\n'.join(rows) + '\n];\n')
    print(len(rows), '그루')
