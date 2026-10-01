// 작업 폴더(BIRD_WORK 또는 OS 임시 폴더의 megafont-birds)에서 돌린다 — textboxes.json · grid-*.json을 거기서 읽고 쓴다
// 격자 — 앱 부품(CloudBubble · VoiceBubble)에 사진 새 형상을 넘겨 벽 실제 크기로 그린다.
// 행 = 글(한 줄 8자 · 두 줄 22자 · 여섯 줄 62자), 열 = 둥근 새(그대로 · 몸통으로) · 까마귀(그대로 · 몸통으로).
// 벽: 한 변 401.76px(1920×1080의 37.2vh), 새 · 박쥐는 그 0.68배(CREATURE_SCALE). 점선 네모 = 벽에서 이 새가 받는 한 칸.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const ROOT = 'C:/dev/megafont-webapp';
const { open } = await import(pathToFileURL(resolve(ROOT, 'scripts/lib/drive.mjs')).href);
const tag = process.argv[2] ?? 'v1';
const src = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : { heads: null, cells: JSON.parse(readFileSync('grid-cells.json', 'utf8')) };
const cells = src.cells, HEADS = src.heads, PAL = src.pal ?? { round: 'neon-green', crow: 'magenta' }, CLIP = !!src.clip;
const CW = 560, CH = 520, COLS = 4;
const { page, close } = await open({ size: { width: CW * COLS, height: 1700 }, scale: 1, quiet: true });
await page.goto(`${page.__base}/?mock=1`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.evaluate(async ({ cells, CW, CH, COLS, HEADS, PAL, CLIP }) => {
  const src = await (await fetch('/src/components/CloudBubble.tsx')).text();
  const reactUrl = src.match(/from "(\/node_modules\/\.vite\/deps\/react\.js\?v=[^"]+)"/)[1];
  const v = reactUrl.split('?')[1];
  const React = (await import(reactUrl)).default;
  const RD = await import(`/node_modules/.vite/deps/react-dom_client.js?${v}`); const createRoot = RD.createRoot ?? RD.default.createRoot;
  const CloudBubble = (await import('/src/components/CloudBubble.tsx')).default;
  const VoiceBubble = (await import('/src/components/VoiceBubble.tsx')).default;
  const { personaFor } = await import('/src/lib/cloud.ts');
  const { bubbleAt, fillFromLegacySize } = await import('/src/lib/fit.ts');
  const { fontMap, opticalFix } = await import('/src/lib/palettes.ts');
  const { ATTITUDE_COLORS } = await import('/src/lib/palettes-v2.ts');
  const SIDE = 401.76, CS = 0.68, side = SIDE * CS, fill = fillFromLegacySize(undefined);
  const pal = { round: ATTITUDE_COLORS.deulseok.find((c) => c.id === PAL.round), crow: ATTITUDE_COLORS.deulseok.find((c) => c.id === PAL.crow) };
  const optic = opticalFix.deulseok?.scale ?? 1;
  document.body.innerHTML = '';
  Object.assign(document.body.style, { display: 'block', margin: '0', background: '#fff', overflow: 'visible', height: 'auto' });
  const root = document.createElement('div');
  Object.assign(root.style, { display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${CW}px)`, width: `${CW * COLS}px` });
  document.body.appendChild(root);
  const heads = HEADS ?? ['둥근 새 · 그대로(새 전체가 한 칸)', '둥근 새 · 몸통으로(몸통이 한 칸)', '까마귀 · 그대로(새 전체가 한 칸)', '까마귀 · 몸통으로(몸통이 한 칸)'];
  for (const h of heads) {
    const d = document.createElement('div'); d.textContent = h;
    Object.assign(d.style, { font: '600 20px "Pretendard Variable", sans-serif', padding: '10px 14px', background: '#111', color: '#fff', borderRight: '2px solid #fff' });
    root.appendChild(d);
  }
  cells.forEach((c, i) => {
    const cell = document.createElement('div');
    Object.assign(cell.style, { width: `${CW}px`, height: `${CH}px`, position: 'relative', background: '#000', overflow: 'hidden', borderRight: '2px solid #fff', borderBottom: '2px solid #fff', boxSizing: 'border-box' });
    root.appendChild(cell);
    const cloud = { persona: personaFor('deulseok'), rule: 'B', circles: [], spikes: [], photo: { id: c.id, pts: c.pts, chars: [], x0: c.x0, x1: c.x1 }, w: c.w, h: c.h, text: c.text };
    const box = bubbleAt(c.lines, { body: (_a, _b, u) => ({ w: c.w * u, h: c.h * u }), tail: () => 0 }, fill);
    // 칸(점선) — 벽에서 이 말이 받는 한 변
    const frame = document.createElement('div');
    Object.assign(frame.style, { position: 'absolute', left: `${(CW - side) / 2}px`, top: `${(CH - 40 - side) / 2}px`, width: `${side}px`, height: `${side}px`, border: '1px dashed rgba(255,255,255,0.35)', boxSizing: 'border-box' });
    cell.appendChild(frame);
    const host = document.createElement('div');
    const bw = side * box.w, bh = side * box.h;
    Object.assign(host.style, { position: 'absolute', left: `${(CW - bw) / 2}px`, top: `${(CH - 40 - bh) / 2}px` });
    cell.appendChild(host);
    const col = pal[c.kind];
    createRoot(host).render(React.createElement(CloudBubble, { cloud, box, side: `${side}px`, color: col.bg, still: true },
      React.createElement(VoiceBubble, { text: c.lines.join('\n'), bg: col.bg, color: col.text, fontFamily: fontMap.deulseok, font: 'deulseok', weight: 400,
        manner: c.manner, speed: 0.5, weightPos: 0.5, fontSize: `${(side * box.unit * (c.tscale ?? 1)).toFixed(3)}px` })));
    // 클리핑 마스크 — 글 상자를 새 윤곽으로 자른다(윤곽을 글 상자 비율 좌표로 옮겨 objectBoundingBox로)
    if (CLIP) {
      const t = c.text, id = 'clipbird' + i, NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
      const cp = document.createElementNS(NS, 'clipPath'); cp.setAttribute('id', id); cp.setAttribute('clipPathUnits', 'objectBoundingBox');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M' + c.pts.map(([x, y]) => `${((x - t.x) / t.w).toFixed(5)},${((y - t.y) / t.h).toFixed(5)}`).join('L') + 'Z');
      cp.appendChild(p); svg.appendChild(cp); document.body.appendChild(svg);
      const hook = () => { const el = host.querySelector('.cloud-text'); if (el) el.style.clipPath = `url(#${id})`; else requestAnimationFrame(hook); };
      requestAnimationFrame(hook);
    }
    // 라벨 — 보이는 글자 크기 · 새 전체 px · 칸 밖으로 나간 몫
    const glyph = side * box.unit * optic * (c.tscale ?? 1), full = side * 0.074 * fill * optic, whole = Math.max(...c.whole) * box.unit * side;
    const out = Math.max(0, (Math.max(...c.whole) * box.unit * side) / side - 1);
    const lab = document.createElement('div');
    lab.textContent = `${c.lines.join('').replace(/ /g, '').length}자 ${c.lines.length}줄 · ${c.id} · 글자 ${glyph.toFixed(1)}px(${(glyph / full * 100).toFixed(0)}%) · 새가 칸의 ${(whole / side * 100).toFixed(0)}%`;
    Object.assign(lab.style, { position: 'absolute', left: '0', right: '0', bottom: '0', height: '40px', lineHeight: '40px', padding: '0 12px', font: '500 16px "Pretendard Variable", sans-serif', color: '#fff', background: '#222' });
    cell.appendChild(lab);
  });
}, { cells, CW, CH, COLS, HEADS, PAL, CLIP });
await page.waitForTimeout(3500);   // Adobe 킷 · 핸드젯이 늦게 온다
const el = await page.$('body > div');
await el.screenshot({ path: `grid-${tag}.png` });
await close();
console.log(`grid-${tag}.png`);
