// 벽에 나무 · 돌 · 구름을 함께 띄우고 두 장면(넓게 · 확대)을 멈춘 한 순간으로 찍는다 — 구름 결을 그 위에 얹어 '다 같이 있을 때'를 본다(c5.py).
// 구름마다 윤곽(path d) · 그림판(svg) 자리 · 말풍선 한 변(side) · 글자 하나하나의 네모 · 글자 크기를 wall_shot.json에.
// 가짜 글은 이 브라우저의 localStorage에만(저장소에 쓰지 않는다). 시계는 Playwright clock으로 멈춘다. 개발 서버가 떠 있어야 한다
import { writeFileSync, mkdirSync } from 'node:fs';
const D = await import(new URL('../../lib/drive.mjs', import.meta.url).href);
const OUT = (process.env.HATCH_OUT || (await import('node:path')).join((await import('node:os')).tmpdir(), 'megafont-cloud-hatch')) + '/';
mkdirSync(OUT, { recursive: true });
const seed = +(process.argv[2] ?? 7);
const now = Date.now();
const M = [];
const DORAN = [['#F78D8C', '#1E3655'], ['#FFA400', '#1E3655'], ['#BE80C7', '#142438'], ['#FAC7DD', '#1E3655'], ['#C9B6EE', '#1E3655'], ['#FB9376', '#1E3655'], ['#FFCAA8', '#1E3655']];
['괜찮아', '오늘은 조금 따뜻했다', '시험 끝나면 바다 보러 갈 거야', '천천히 가도 된다고 말해 주고 싶다', '고마웠다고 말하고 싶었어', '내일도 여기 올게', '기숙사 창문 밖 나무가 오늘따라 커 보였다']
  .forEach((text, i) => M.push({ id: `c${i}`, text, createdAt: now - i * 50000, tone: { font: 'doran', tone: 1, wght: 400, slnt: 0, size: [44, 44, 36, 52, 44, 36, 36][i],
    paletteIdx: 0, graphicIdx: -1, speed: 0.5, weight: 0.5, align: 'center', backgroundColor: DORAN[i][0], textColor: DORAN[i][1] } }));
const CHABUN = [['#CCC1BA', '#2B2B2B'], ['#1E3655', '#FFE600'], ['#801420', '#FFFFFF'], ['#134329', '#FFFFFF']];
['여기서 크게 말해본 적 없다', '조용히 오래 생각했다', '그래도 내일은 올 거야', '아무도 모르게 혼자 웃었다']
  .forEach((text, i) => M.push({ id: `s${i}`, text, createdAt: now - 400000 - i * 50000, tone: { font: 'chabun', tone: 1, wght: 400, slnt: 0, size: [44, 52, 36, 44][i],
    paletteIdx: 0, graphicIdx: -1, speed: 0.5, weight: 0.5, align: ['hang-up', 'hang-mid', 'hang-down', 'hang-mid'][i], backgroundColor: CHABUN[i][0], textColor: CHABUN[i][1] } }));
['저는 과기대를 사랑하는데 총장님은 아니신가봐요', '오늘 하루도 버텼다', '같이 밥 먹을 사람 구함', '시험 망했지만 괜찮아']
  .forEach((text, i) => M.push({ id: `t${i}`, text, createdAt: now - 700000 - i * 50000, tone: { font: 'ttoryeot', tone: 1, wght: 700, slnt: 0, size: 40, paletteIdx: 0,
    graphicIdx: -1, speed: 0.5, weight: [0.2, 0.5, 0.8, 0.5][i], align: 'center', backgroundColor: ['#F6E67B', '#59A173', '#DC7671', '#8FB7E0'][i], textColor: '#000000' } }));

const { page, close } = await D.open({ size: { width: 1920, height: 1080 }, quiet: true });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.addInitScript((sd) => { let a = sd; Math.random = () => { a += 0x6D2B79F5; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, seed);
await page.goto(`${page.__base}/?mock=1`, { waitUntil: 'load' });
await page.evaluate((m) => localStorage.setItem('megafont.mock.messages.v1', JSON.stringify(m)), M);
await page.clock.install();
await page.goto(`${page.__base}/wall?mock=1`, { waitUntil: 'load' });
await page.clock.resume();
await page.evaluate(() => document.fonts.ready);

const grab = (tones) => page.evaluate(async (tones) => {
  const C = await import('/src/lib/cloud.ts'), F = await import('/src/lib/fit.ts');
  const world = document.querySelector('.wall-world'), zoom = world ? new DOMMatrix(getComputedStyle(world).transform).a : 1;
  const out = [];
  for (const blk of document.querySelectorAll('.wall-block.is-cloud')) {
    const id = blk.dataset.id, tone = tones[id]; if (!tone) continue;
    const bub = blk.querySelector('.cloud-bubble'), svg = bub.querySelector('svg.cloud-art'), path = svg?.querySelector('path');
    if (!path) continue;
    const lines = C.linesFor(tone.text, tone.tone), cloud = C.cloudForTone(lines, tone.tone);
    const box = F.bubbleAt(lines, C.cloudShape(cloud), F.fillFromLegacySize(tone.tone.size));
    const sr = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, br = bub.getBoundingClientRect();
    const txt = bub.querySelector('.cloud-text'), chars = [];
    const walker = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT); let n;
    while ((n = walker.nextNode())) {
      const T = n.textContent, range = document.createRange();
      for (let i = 0; i < T.length; i++) { if (!T[i].trim()) continue; range.setStart(n, i); range.setEnd(n, i + 1); for (const q of range.getClientRects()) chars.push([q.left, q.top, q.right, q.bottom]); }
    }
    out.push({ id, d: path.getAttribute('d'), fill: path.getAttribute('fill'), svg: [sr.left, sr.top, sr.width, sr.height], vb: [vb.x, vb.y, vb.width, vb.height],
      sideScreen: br.width / box.w, sideLayout: bub.offsetWidth / box.w, fs: parseFloat(getComputedStyle(txt).fontSize), stroke: getComputedStyle(txt).getPropertyValue('--optical-stroke'),
      chars, textOpacity: getComputedStyle(txt).opacity, color: tone.tone.backgroundColor });
  }
  return { zoom, clouds: out };
}, tones);
const tones = Object.fromEntries(M.map((m) => [m.id, { text: m.text, tone: m.tone }]));
const freeze = async () => { const t = await page.evaluate(() => Date.now()); await page.clock.pauseAt(t + 50); await page.waitForTimeout(300); };

await page.waitForTimeout(15000);
await freeze();
const wide = await grab(tones);
await page.screenshot({ path: `${OUT}wall-wide.png` });
console.log('넓게: 확대', wide.zoom.toFixed(2), '구름', wide.clouds.length);
await page.clock.resume();
let zoomed = null;
for (let i = 0; i < 120; i++) {
  await page.waitForTimeout(1000);
  const z = await page.evaluate(() => { const w = document.querySelector('.wall-world'); return w ? new DOMMatrix(getComputedStyle(w).transform).a : 1; });
  if (z > 2.95) { await page.waitForTimeout(6000); await freeze(); zoomed = await grab(tones); await page.screenshot({ path: `${OUT}wall-zoom.png` }); break; }
}
console.log('확대:', zoomed ? `확대 ${zoomed.zoom.toFixed(2)} 구름 ${zoomed.clouds.length}` : '못 잡음', '| 오류', errs.length ? errs.slice(0, 3) : '없음');
writeFileSync(`${OUT}wall_shot.json`, JSON.stringify({ wide, zoomed }));
await close();
