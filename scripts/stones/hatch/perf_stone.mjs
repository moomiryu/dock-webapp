// 벽 — 돌 결을 계속 다시 셈하게 만들고(모든 돌이 매 프레임 각도가 바뀜) 4배 느린 흉내에서 초당 프레임을 잰다
const D = await import(new URL('../../lib/drive.mjs', import.meta.url).href);
const HATCH = (process.env.HATCH_OUT || (await import('node:path')).join((await import('node:os')).tmpdir(), 'megafont-stone-hatch')) + '/';   // 결과는 임시 폴더
(await import('node:fs')).mkdirSync(HATCH, { recursive: true });
const P = { stone: ['#CCC1BA', '#2B2B2B'], navy: ['#1E3655', '#FFE600'], crimson: ['#801420', '#FFFFFF'], mist: ['#B5D0F2', '#1E3655'], forest: ['#134329', '#FFFFFF'], ink: ['#2B2B2B', '#FFFFFF'] };
const texts = ['여기서 크게 말해본 적 없다', '오늘은 아무 말도 하고 싶지 않았다', '조용히 오래 생각했다', '그래도 내일은 올 거야', '사흘 뒤면 사라질 말이라서 더 솔직하게', '괜찮아', '아무도 모르게', '천천히 가도 된다'];
const cols = Object.keys(P);
const M = texts.map((text, i) => ({ id: `stone-perf-${i}`, text, createdAt: Date.now() - i * 60000,
  tone: { font: 'chabun', tone: 1, wght: 400, slnt: 0, size: [28, 44, 60][i % 3], paletteIdx: 0, graphicIdx: -1, speed: 0.5, weight: (i % 5) / 4,
    align: ['hang-up', 'hang-mid', 'hang-down'][i % 3], backgroundColor: P[cols[i % 6]][0], textColor: P[cols[i % 6]][1] } }));
const { page, context, close } = await D.open({ size: { width: 1920, height: 1080 }, quiet: true });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`${page.__base}/?mock=1`, { waitUntil: 'load' });
await page.evaluate((m) => localStorage.setItem('megafont.mock.messages.v1', JSON.stringify(m)), M);
await page.goto(`${page.__base}/wall?mock=1`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(9000);
const cdp = await context.newCDPSession(page);
const measure = (force) => page.evaluate(async (force) => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/components/StoneArt.tsx')); const mod = force ? await import(url) : null;
  const els = [...document.querySelectorAll('.wall-block.is-stone')];
  return await new Promise((ok) => {
    let n = 0, t0 = performance.now(), last = t0, worst = 0, slow = 0;
    const f = (t) => {
      n++; const dt = t - last; worst = Math.max(worst, dt); if (dt > 25) slow++; last = t;
      if (mod) els.forEach((el, i) => mod.stoneLean(el, Math.sin(t / 300 + i) * 0.5));
      if (t - t0 < 4000) requestAnimationFrame(f); else ok({ stones: els.length, fps: Math.round((n * 1000) / (t - t0)), worst: Math.round(worst), over25ms: slow });
    };
    requestAnimationFrame(f);
  });
}, force);
for (const rate of [1, 4]) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  console.log(`CPU ${rate}배 · 그냥`, JSON.stringify(await measure(false)));
  console.log(`CPU ${rate}배 · 모든 돌이 계속 기움`, JSON.stringify(await measure(true)));
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
// 한 번 셈하는 데 드는 시간(1배) — 돌마다 각도를 크게 바꿔 다시 셈
const one = await page.evaluate(async () => {
  const mod = await import('/src/components/StoneArt.tsx');
  const els = [...document.querySelectorAll('.wall-block.is-stone')];
  const t0 = performance.now();
  els.forEach((el, i) => mod.stoneLean(el, 1 + i));
  await new Promise((r) => setTimeout(r, 2000));
  return { stones: els.length };
});
console.log(JSON.stringify(one), '오류', errs.length ? errs.slice(0, 4) : '없음');
await close();
