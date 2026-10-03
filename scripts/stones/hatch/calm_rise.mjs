// 벽 돌 최대 개수(STONE_MAX) — 차분한 돌 여덟이 쌓인 벽에 새 차분한 글이 도킹하면, 큰 돌이 쓸어 내고 돌아올 때 가장 오래된 돌이 빠지나.
// 저장소로 가는 요청을 모두 가로채 가짜로 돌려준다(글 목록 · 글 하나 · 발화 신호). 쓰는 요청은 모두 막는다 — 진짜 저장소를 건드리지 않는다
// (다른 세션의 calmcheck2.mjs와 같은 방법)
const D = await import(new URL('../../lib/drive.mjs', import.meta.url).href);
const HATCH = (process.env.HATCH_OUT || (await import('node:path')).join((await import('node:os')).tmpdir(), 'megafont-stone-hatch')) + '/';   // 결과는 임시 폴더
(await import('node:fs')).mkdirSync(HATCH, { recursive: true });
const OUT = HATCH + 'keep-';
const { page, close } = await D.open({ size: { width: 1920, height: 1080 }, scale: 0.5, quiet: true });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const now = Date.now();
const C = [['#CCC1BA', '#2B2B2B'], ['#1E3655', '#FFE600'], ['#134329', '#FFFFFF'], ['#801420', '#FFFFFF'], ['#07513C', '#FFFFFF'], ['#3E315A', '#FFFFFF'], ['#2B2B2B', '#FFFFFF'], ['#B5D0F2', '#1E3655']];
const T = ['괜찮아', '여기서 크게 말해본 적 없다', '오늘은 아무 말도 하고 싶지 않았다', '시험 끝나면 바다 보러 갈 거야', '사흘 뒤면 사라질 말이라서', '조용히 있고 싶다', '그냥 앉아 있고 싶었다', '기숙사 창문 밖 나무'];
const AL = ['hang-up', 'hang-mid', 'hang-down', 'hang-mid'];
const stone = (id, text, i, at) => ({ id, text, createdAt: at, tone: { font: 'chabun', tone: 1, wght: 400, slnt: 0, size: [36, 44, 52, 44][i % 4], paletteIdx: 0, graphicIdx: -1, align: AL[i % 4], backgroundColor: C[i % 8][0], textColor: C[i % 8][1], speed: 0.5, weight: 0.5 } });
const msgs = T.map((t, i) => stone('s' + i, t, i, now - (i + 2) * 90000));   // s0이 가장 최근, s7이 가장 오래됨
msgs.push({ id: 't1', text: '저는 과기대를 사랑하는데 총장님은 아니신가봐요', createdAt: now - 300000, tone: { font: 'ttoryeot', tone: 1, wght: 700, slnt: 0, size: 40, paletteIdx: 0, graphicIdx: -1, align: 'center', backgroundColor: '#F6E67B', textColor: '#000000', manner: 1 } });
const NEW = stone('e1', '오늘 처음으로 여기 와서 말해 본다', 1, now - 1000);

const dock = { startId: '', startMessage: '', startedAt: 0, endedAt: 0, plugged: false };
const str = (v) => ({ stringValue: v }), int = (v) => ({ integerValue: String(v) });
const toFs = (v) => typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
const docOf = (m) => ({ name: 'projects/p/databases/(default)/documents/messages/' + m.id, fields: { text: toFs(m.text), tone: toFs(m.tone), createdAt: { timestampValue: new Date(m.createdAt).toISOString() } } });
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
let writes = 0;
await page.route('https://firestore.googleapis.com/**', (route) => {
  const u = route.request().url(), m = route.request().method();
  if (u.includes('/documents/control/dock') && m === 'GET') return json(route, { fields: {
    plugged: { booleanValue: dock.plugged }, switchId: str('sw'), switchAt: int(dock.startedAt), piAt: int(Date.now()),
    waitSession: str(''), waitMessage: str(''), waitAt: int(0),
    startId: str(dock.startId), startSession: str('s'), startMessage: str(dock.startMessage), startedAt: int(dock.startedAt), endedAt: int(dock.endedAt) } });
  if (u.includes(':runQuery') && m === 'POST') return json(route, msgs.map((x) => ({ document: docOf(x) })));
  const one = u.match(/\/documents\/messages\/([^?]+)/);
  if (one && m === 'GET') { const x = [...msgs, NEW].find((q) => q.id === one[1]); return x ? json(route, docOf(x)) : json(route, {}, 404); }
  if (u.includes('/documents/messages') && m === 'GET') return json(route, { documents: msgs.map(docOf) });
  writes++; return route.abort();
});
await page.goto(page.__base + '/', { waitUntil: 'load' });
await page.evaluate(() => localStorage.removeItem('megafont.wall.seenStart'));
await page.goto(page.__base + '/wall', { waitUntil: 'load' });
await page.waitForTimeout(9000);
const stones = () => page.evaluate(() => [...document.querySelectorAll('.wall-block.is-stone')].map((el) => el.dataset.id).sort());
console.log('처음(돌 여덟 중 최근 넷이어야 s0~s3)', JSON.stringify(await stones()));
await page.screenshot({ path: `${OUT}0-before.png` });
// 새 글이 저장소에 들어오고(보내기) 곧바로 도킹
msgs.push(NEW);
Object.assign(dock, { startId: 'ev' + now, startMessage: 'e1', startedAt: Date.now(), plugged: true });
const t0 = Date.now();
for (const [i, at] of [[1, 2500], [2, 6000]]) { await page.waitForTimeout(Math.max(0, at - (Date.now() - t0))); await page.screenshot({ path: `${OUT}${i}-sweep.png` }); }
console.log('큰 돌이 머무는 동안', JSON.stringify(await stones()));
Object.assign(dock, { endedAt: Date.now(), plugged: false });
// 폰을 뺀 뒤 — 큰 돌이 나가고 돌들이 땅 밑에서 올라오는 동안을 이어 찍는다
const t1 = Date.now(); let k = 0; const times = [];
await page.waitForTimeout(5200);
while (Date.now() - t1 < 15500) { await page.screenshot({ path: `${OUT}rise-${String(k).padStart(3, '0')}.png`, clip: { x: 0, y: 200, width: 1920, height: 880 } }); times.push(Date.now() - t1); k++; }
require_fs: { const fs = await import('node:fs'); fs.writeFileSync(`${OUT}rise-times.json`, JSON.stringify(times)); }
console.log('장면', k, '오류', errs.length ? errs.slice(0, 3) : '없음');
await close();
