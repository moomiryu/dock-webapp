// 벽 — 구름 결의 무게. 나무 · 돌 · 구름(빗금 결)을 띄우고 CPU를 rate배 느리게(파이 흉내) 해서 잰다:
//   켜질 때(구름마다 결을 셈하는 동안) 가장 긴 프레임 · 넓게 본 장면의 초당 프레임 · 확대(×3) 장면의 초당 프레임
//   node perf_cloud.mjs [rate=4]
const D = await import(new URL('../../lib/drive.mjs', import.meta.url).href);
const rate = +(process.argv[2] ?? 4), now = Date.now(), M = [];
const DORAN = [['#F78D8C', '#1E3655'], ['#FFA400', '#1E3655'], ['#BE80C7', '#142438'], ['#FAC7DD', '#1E3655'], ['#C9B6EE', '#1E3655'], ['#FB9376', '#1E3655'], ['#FFCAA8', '#1E3655'], ['#F690BC', '#1E3655']];
['괜찮아', '오늘은 조금 따뜻했다', '시험 끝나면 바다 보러 갈 거야', '천천히 가도 된다고 말해 주고 싶다', '고마웠다고 말하고 싶었어', '내일도 여기 올게', '기숙사 창문 밖 나무가 오늘따라 커 보였다', '같이 걷자']
  .forEach((text, i) => M.push({ id: `c${i}`, text, createdAt: now - i * 50000, tone: { font: 'doran', tone: 1, wght: 400, slnt: 0, size: [44, 44, 36, 52, 44, 36, 36, 60][i],
    paletteIdx: 0, graphicIdx: -1, speed: 0.5, weight: (i % 5) / 4, align: ['center', 'arch', 'smile'][i % 3], backgroundColor: DORAN[i][0], textColor: DORAN[i][1] } }));
['여기서 크게 말해본 적 없다', '조용히 오래 생각했다', '그래도 내일은 올 거야'].forEach((text, i) => M.push({ id: `s${i}`, text, createdAt: now - 400000 - i * 50000,
  tone: { font: 'chabun', tone: 1, wght: 400, slnt: 0, size: 44, paletteIdx: 0, graphicIdx: -1, speed: 0.5, weight: 0.5, align: 'hang-mid', backgroundColor: '#1E3655', textColor: '#FFE600' } }));
['오늘 하루도 버텼다', '같이 밥 먹을 사람 구함', '시험 망했지만 괜찮아'].forEach((text, i) => M.push({ id: `t${i}`, text, createdAt: now - 700000 - i * 50000,
  tone: { font: 'ttoryeot', tone: 1, wght: 700, slnt: 0, size: 40, paletteIdx: 0, graphicIdx: -1, speed: 0.5, weight: 0.5, align: 'center', backgroundColor: '#59A173', textColor: '#000000' } }));
const { page, context, close } = await D.open({ size: { width: 1920, height: 1080 }, quiet: true });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.addInitScript(() => {
  const f = (window.__frames = []);
  const tick = (t) => { f.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await page.goto(`${page.__base}/?mock=1`, { waitUntil: 'load' });
await page.evaluate((m) => localStorage.setItem('megafont.mock.messages.v1', JSON.stringify(m)), M);
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await page.goto(`${page.__base}/wall?mock=1`, { waitUntil: 'load' });
await page.waitForTimeout(12000);
const span = (a, b) => page.evaluate(([a, b]) => {
  const f = window.__frames, t0 = f[0], s = f.filter((t) => t - t0 >= a && t - t0 < b);
  let worst = 0, over = 0;
  for (let i = 1; i < s.length; i++) { const d = s[i] - s[i - 1]; worst = Math.max(worst, d); if (d > 25) over++; }
  return { fps: s.length > 1 ? Math.round(((s.length - 1) * 1000) / (s[s.length - 1] - s[0])) : 0, worst: Math.round(worst), over25ms: over };
}, [a, b]);
const hatched = await page.evaluate(() => document.querySelectorAll('.wall-block.is-cloud .cloud-hatch canvas').length);
console.log(`CPU ${rate}배 · 빗금 구름 ${hatched}`);
console.log('  켜질 때(0~6초)', JSON.stringify(await span(0, 6000)));
console.log('  넓게(8~12초)', JSON.stringify(await span(8000, 12000)));
let z = 1;
for (let i = 0; i < 120 && z < 2.95; i++) { await page.waitForTimeout(1000); z = await page.evaluate(() => { const w = document.querySelector('.wall-world'); return w ? new DOMMatrix(getComputedStyle(w).transform).a : 1; }); }
if (z >= 2.95) {
  const t = await page.evaluate(() => performance.now() - window.__frames[0]);
  await page.waitForTimeout(5000);
  console.log('  확대 ×3(5초)', JSON.stringify(await span(t, t + 5000)));
} else console.log('  확대 장면을 못 잡음');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
console.log('  오류', errs.length ? errs.slice(0, 3) : '없음');
await close();
