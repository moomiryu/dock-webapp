# 움직이는 견본 — 날갯짓(장 수 × 한 번의 시간). 작은 새(앉은 몸 + 종다리 날개)와 까마귀(큰까마귀 연속 사진 세 장)
import base64, io, json, os, sys
import numpy as np, cv2
from paths import ROOT, WORK as OUT
def png(m, rgb, H):
    ys, xs = np.nonzero(m); m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1] if False else m
    h, w = m.shape; s = H / h
    m = cv2.resize(m.astype(np.uint8) * 255, (max(1, int(w * s)), H), interpolation=cv2.INTER_AREA)
    rgba = np.zeros((m.shape[0], m.shape[1], 4), np.uint8); rgba[..., :3] = rgb[::-1]; rgba[..., 3] = m
    ok, buf = cv2.imencode(".png", rgba); return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode()
def frames_small(id_):
    fr = {k: (cv2.imread(os.path.join(OUT, "flap", f"{id_}-{k}.png"), 0) > 127) for k in ("sit", "up", "mid", "down")}
    return fr
def frames_crow():
    z = np.load(os.path.join(OUT, "flap-crow3.npz")); fr = {"up": z["k023"], "mid": z["k015"], "down": z["k022"]}
    U = fr["up"] | fr["mid"] | fr["down"]; ys, xs = np.nonzero(U)
    b = (ys.min() - 6, ys.max() + 6, xs.min() - 6, xs.max() + 6)
    return {k: v[b[0]:b[1], b[2]:b[3]] for k, v in fr.items()}
LIME = (0xA6, 0xFF, 0x00); MAG = (0xF0, 0x00, 0xFF)
sm = frames_small(sys.argv[1] if len(sys.argv) > 1 else "r1127"); cr = frames_crow()
HS, HC = 150, 150     # 벽에서 새 한 마리 높이쯤(한 변 401.8 × 0.68 안)
S = {k: png(v, LIME, HS) for k, v in sm.items()}; C = {k: png(v, MAG, HC) for k, v in cr.items()}
SEQ = {"2장": ["up", "down"], "3장": ["up", "mid", "down", "mid"]}
SPEEDS = [("--t-return", "220ms", 220), ("--t-hold × 0.4 (지금 기하 새)", "280ms", 280), ("--t-slow", "400ms", 400), ("--t-hold", "700ms", 700)]
cells = []
for nm, seq in SEQ.items():
    for lab, txt, ms in SPEEDS:
        cells.append({"seq": seq, "ms": ms, "lab": f"{nm} · 날갯짓 한 번 {lab} = {txt}"})
html = """<!doctype html><meta charset="utf-8"><title>날갯짓 견본</title>
<style>body{margin:0;background:#fff;font:500 15px "Pretendard Variable","Malgun Gothic",sans-serif}
.g{display:grid;grid-template-columns:repeat(4,460px)}.c{height:300px;background:#000;position:relative;border:1px solid #fff}
.c img{position:absolute;bottom:60px}.c .s{left:40px}.c .k{right:30px}.l{position:absolute;left:0;right:0;bottom:0;height:34px;line-height:34px;padding:0 10px;color:#fff;background:#222;font-size:13px}
h1{font-size:18px;margin:10px 14px}</style>
<h1>날갯짓 — 행: 장 수 · 열: 날갯짓 한 번의 시간. 왼쪽 작은 새(앉은 몸 + 종다리 날개), 오른쪽 까마귀(큰까마귀 연속 사진)</h1><div class="g" id="g"></div>
<script>const S=__S__,C=__C__,cells=__CELLS__;const g=document.getElementById('g');
cells.forEach(c=>{const d=document.createElement('div');d.className='c';const a=new Image(),b=new Image();a.className='s';b.className='k';d.append(a,b);
const l=document.createElement('div');l.className='l';l.textContent=c.lab;d.append(l);g.append(d);let i=0;
const step=c.ms/c.seq.length;const tick=()=>{const f=c.seq[i%c.seq.length];a.src=S[f];b.src=C[f];i++};tick();setInterval(tick,step);});</script>"""
html = html.replace("__S__", json.dumps(S)).replace("__C__", json.dumps(C)).replace("__CELLS__", json.dumps(cells, ensure_ascii=False))
open(os.path.join(OUT, "flap-sample.html"), "w", encoding="utf-8").write(html); print("ok")
