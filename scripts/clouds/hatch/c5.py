# 구름 결 격자 5 — '다 같이 있을 때'. 벽(나무 · 돌 · 구름)의 멈춘 한 순간(wall_shot.mjs) 위에 구름 결을 그늘 양 35 · 45 · 55%로 얹는다.
# 두 장면 그대로: 넓게(구름은 글 없이 작게) · 확대(×3, 구름 글이 읽힌다). 결의 크기는 나무 · 돌처럼 말풍선 한 변에 비례(StoneTex 길이 = 한 변의 몫)
# — 화면의 구름이 401.76px 한 변의 몇 배인가(sideScreen / 401.76)로 줄 간격 · 뭉갬 · 흔들림을 늘이고 줄인다.
# 결과: wall-<장면>-<양>.png + 한 장씩 넘겨 보는 wall-compare.html(임시 폴더)
import cv2, numpy as np, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import c1
from c1 import G, SS, P, LIGHT, OUT, FADE

BARE = 0.0275
STROKE_MID = 0.46 / 12          # 다정한 보통의 덧댄 획(em) — 가짜 글은 모두 무게 보통
QS = [35, 45, 55]


def rings(d):
    out = []
    for part in re.findall(r'M([^Z]+)Z', d):
        pts = [tuple(map(float, q.split(','))) for q in part.split('L')]
        out.append(np.array(pts, np.float32))
    return out


def cloud_cut(c, q, seed=11):
    """구름 하나의 빗금(화면 화소의 덮임 0~1)과 그 자리"""
    sx, sy, sw, sh = c['svg']; vx, vy, vw, vh = c['vb']
    scr = [np.stack([sx + (r[:, 0] - vx) / vw * sw, sy + (r[:, 1] - vy) / vh * sh], 1) for r in rings(c['d'])]
    s = c['sideScreen'] / 401.76                                   # 화면 화소 / 결의 화소
    allp = np.concatenate(scr); pad = 8 * s
    ox, oy = allp[:, 0].min() - pad, allp[:, 1].min() - pad
    Wl = int(np.ceil((allp[:, 0].max() + pad - ox) / s)); Hl = int(np.ceil((allp[:, 1].max() + pad - oy) / s))
    m = np.zeros((Hl * SS, Wl * SS), np.uint8)
    for r in scr: cv2.fillPoly(m, [np.round((r - [ox, oy]) / s * SS).astype(np.int32)], 1)
    # 글자 크기(결의 화소) — .cloud-text의 font-size는 물려받은 16px라 못 쓴다. 글자 네모의 높이(다카포 ≈ 1.185em)로
    em = float(np.median([y1 - y0 for _, y0, _, y1 in c['chars']])) / s / 1.185 if c['chars'] else 16.0
    t = np.zeros_like(m)
    for x0, y0, x1, y1 in c['chars']:
        cy, hw = (y0 + y1) / 2, 0.42 * em * s
        a = np.round((np.array([[x0 + 0.04 * (x1 - x0), cy - hw], [x1 - 0.04 * (x1 - x0), cy + hw]]) - [ox, oy]) / s * SS).astype(int)
        cv2.rectangle(t, tuple(a[0]), tuple(a[1]), 1, -1)
    dist = cv2.distanceTransform((t == 0).astype(np.uint8), cv2.DIST_L2, 5)
    E = em * SS
    fade = np.clip((dist - FADE[0] * E) / (FADE[1] * E), 0, 1); fade = fade * fade * (3 - 2 * fade)
    stroke = (BARE + (float(c['stroke'].strip().rstrip('em')) if c['stroke'].strip() else STROKE_MID)) * em
    gap = min(P - G.WP, 1.6 * stroke)
    c1.Q = q
    rg = c1.region_q(m, c1.shade_light(m, LIGHT), fade, seed)
    cut = c1.hatch(rg, gap, seed).astype(np.float32)
    W, H = int(round(Wl * s)), int(round(Hl * s))
    return cv2.resize(cut, (W, H), interpolation=cv2.INTER_AREA), int(round(ox)), int(round(oy))


def compose(img, clouds, q):
    out = img.astype(np.float32).copy(); Hh, Ww = out.shape[:2]
    for c in clouds:
        a, ox, oy = cloud_cut(c, q)
        h, w = a.shape
        x0, y0, x1, y1 = max(0, ox), max(0, oy), min(Ww, ox + w), min(Hh, oy + h)
        if x1 <= x0 or y1 <= y0: continue
        aa = a[y0 - oy:y1 - oy, x0 - ox:x1 - ox][..., None]
        out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1 - aa)          # 검은 줄 = --ink(#000)
    return np.clip(out, 0, 255).astype(np.uint8)


if __name__ == '__main__':
    J = json.load(open(os.path.join(OUT, 'wall_shot.json'), encoding='utf-8'))
    shots = []
    for scene, key in (('wide', 'wide'), ('zoom', 'zoomed')):
        if not J.get(key): continue
        img = cv2.imread(os.path.join(OUT, f'wall-{scene}.png'))
        cv2.imwrite(os.path.join(OUT, f'wall-{scene}-0.png'), img)
        for q in QS:
            cv2.imwrite(os.path.join(OUT, f'wall-{scene}-{q}.png'), compose(img, J[key]['clouds'], q))
        shots.append(scene)
    names = {'0': '지금 — 구름 빗금 없음', '35': '가 · 35% (돌과 같게)', '45': '나 · 45%', '55': '다 · 55%'}
    scenes = {'wide': '넓게 (구름은 글 없이 작게)', 'zoom': '확대 ×3 (구름 글이 읽힌다)'}
    html = f'''<!doctype html><meta charset="utf-8"><title>구름 그늘 양 — 벽에서 다 같이</title>
<style>body{{margin:0;background:#181818;color:#eee;font-family:"Noto Sans KR",sans-serif}}
header{{padding:14px 20px;display:flex;gap:28px;align-items:center;flex-wrap:wrap}} h1{{font-size:24px;margin:0}}
button{{font:inherit;font-size:17px;padding:8px 14px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:14px;cursor:pointer}}
button.on{{background:#eee;color:#111}} img{{display:block;width:100%;height:auto}} small{{color:#999;font-size:14px}}</style>
<header><h1>물음 — 다 같이 있을 때 산만한가?</h1><div id=q></div><div id=s></div>
<small>숫자 키 1~4 · ← → 로 양, Tab으로 장면. 벽 1920×1080 실제 화소 · 멈춘 한 순간</small></header><img id=v>
<script>const Q={json.dumps(['0'] + [str(q) for q in QS])},N={json.dumps(names, ensure_ascii=False)},S={json.dumps(shots)},SN={json.dumps(scenes, ensure_ascii=False)};
let q=1,s=0;const v=document.getElementById('v');
function draw(){{v.src=`wall-${{S[s]}}-${{Q[q]}}.png`;
document.getElementById('q').innerHTML=Q.map((x,i)=>`<button class="${{i==q?'on':''}}" onclick="q=${{i}};draw()">${{N[x]}}</button>`).join(' ');
document.getElementById('s').innerHTML=S.map((x,i)=>`<button class="${{i==s?'on':''}}" onclick="s=${{i}};draw()">${{SN[x]}}</button>`).join(' ');}}
addEventListener('keydown',e=>{{if(e.key>='1'&&e.key<='4')q=+e.key-1;else if(e.key=='ArrowRight')q=Math.min(Q.length-1,q+1);else if(e.key=='ArrowLeft')q=Math.max(0,q-1);else if(e.key=='Tab'){{e.preventDefault();s=(s+1)%S.length}}else return;draw()}});draw();</script>'''
    p = os.path.join(OUT, 'wall-compare.html'); open(p, 'w', encoding='utf-8').write(html); print(p)
