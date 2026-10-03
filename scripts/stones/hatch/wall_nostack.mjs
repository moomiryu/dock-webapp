// 쌓임 금지 확인 — 큰 돌이 많은 벽(차분한 열 · 나무 셋). 돌 수 · 돌마다 바닥에서 뜬 거리(상자의 가장 낮은 모서리). 가짜 글은 이 브라우저만
//   node wall_nostack.mjs <이름> [씨앗]
const D = await import(new URL('../../lib/drive.mjs', import.meta.url).href);
const HATCH = (process.env.HATCH_OUT || (await import('node:path')).join((await import('node:os')).tmpdir(), 'megafont-stone-hatch')) + '/';   // 결과는 임시 폴더
(await import('node:fs')).mkdirSync(HATCH, { recursive: true });
const name = process.argv[2] ?? 'x', seed = +(process.argv[3] ?? 7);
const OUT = HATCH + 'ns-';
const P = [['#CCC1BA', '#2B2B2B'], ['#1E3655', '#FFE600'], ['#801420', '#FFFFFF'], ['#B5D0F2', '#1E3655'], ['#134329', '#FFFFFF'], ['#3E315A', '#FFFFFF'], ['#07513C', '#FFFFFF'], ['#2B2B2B', '#FFFFFF']];
const T = ['여기서 크게 말해본 적 없다', '오늘은 아무 말도 하고 싶지 않았다', '조용히 오래 생각했다', '그래도 내일은 올 거야', '사흘 뒤면 사라질 말이라서 더 솔직하게',
  '괜찮아', '천천히 가도 된다', '아무도 모르게 혼자 웃었다', '기숙사 창문 밖 나무가 오늘따라 커 보였다', '말하지 못한 것들이 오래 남는다'];
const now = Date.now();
const M = T.map((text, i) => ({ id: `ns-${i}`, text, createdAt: now - i * 60000,
  tone: { font: 'chabun', tone: 1, wght: 400, slnt: 0, size: [60, 52, 60, 56, 60, 52, 60, 56, 60, 52][i], paletteIdx: 0, graphicIdx: -1, speed: 0.5, weight: 0.5,
    align: ['hang-up', 'hang-mid', 'hang-down'][i % 3], backgroundColor: P[i % 8][0], textColor: P[i % 8][1] } }));
for (const [i, t] of ['저는 과기대를 사랑하는데 총장님은 아니신가봐요', '오늘 하루도 버텼다', '같이 밥 먹을 사람 구함'].entries())
  M.push({ id: `ns-t${i}`, text: t, createdAt: now - 700000 - i * 1000, tone: { font: 'ttoryeot', tone: 1, wght: 700, slnt: 0, size: 40, paletteIdx: 0, graphicIdx: -1, align: 'center', backgroundColor: ['#F6E67B', '#59A173', '#DC7671'][i], textColor: '#000000', manner: i % 2 } });
const { page, close } = await D.open({ size: { width: 1920, height: 1080 }, quiet: true });
await page.addInitScript((sd) => { let a = sd; Math.random = () => { a += 0x6D2B79F5; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, seed);
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`${page.__base}/?mock=1`, { waitUntil: 'load' });
await page.evaluate((m) => localStorage.setItem('megafont.mock.messages.v1', JSON.stringify(m)), M);
await page.goto(`${page.__base}/wall?mock=1`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(14000);
const info = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.wall-block.is-stone')];
  const lows = els.map((el) => el.querySelector('.cloud-bubble').getBoundingClientRect().bottom);
  const floor = Math.max(...lows);
  return { stones: els.length, ids: els.map((el) => el.dataset.id).sort(), floor: Math.round(floor), lifted: lows.map((b) => Math.round(floor - b)).filter((g) => g > 12) };
});
console.log(name, '씨앗', seed, JSON.stringify(info), '오류', errs.length ? errs.slice(0, 3) : '없음');
await page.screenshot({ path: `${OUT}${name}.png` });
await close();
