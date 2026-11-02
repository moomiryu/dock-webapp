// 메가폰트 웹앱 시연 — 16:9 오른쪽 반의 맥 창 안에서 손가락이 [처음이에요]부터 완료까지 실제로 몬다.
//   node rec.mjs [배율]          영상 프레임(frames/ + list.txt) — 배율 기본 1(1920×1080)
//   node rec.mjs [배율] stills   같은 흐름을 돌며 대표 컷 PNG(stills/)
// ?mock=1 — 글은 이 브라우저 안에만 남고 실제 벽에 닿지 않는다
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const S = Number(process.argv[2] ?? 1);
const STILLS = process.argv[3] === 'stills';
const APP = 'http://localhost:5173';
const TEXT = '열심히 일하고, 사랑하며 살자!';
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const ease = (t) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const ctx = await browser.newContext({ viewport: { width: 1920 * S, height: 1080 * S }, locale: 'ko-KR' });
// 무대(file://)가 개발 서버의 서체를 받으려면 '다른 주소에서 써도 된다'는 머리말이 있어야 한다 — 없으면 브라우저가 막고 기본 서체로 찍힌다
await ctx.route('http://localhost:5173/fonts/**', async (r) => { const res = await r.fetch(); await r.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } }); });

// 글꼴 미리 받기 — 2/5에서 네 서체가 한꺼번에 처음 불릴 때 바뀌어 보이지 않게. 끝나면 초안을 지운다
{
  const w = await ctx.newPage();
  await w.setViewportSize({ width: 390, height: 780 });
  await w.goto(`${APP}/?mock=1`);
  await w.locator('.home-info-btn').click({ timeout: 15000 });
  await w.locator('.write-input').fill(TEXT);
  await w.locator('.write-screen .primary-action').click();
  await w.waitForTimeout(2500);
  for (let i = 0; i < 4; i++) { await w.locator('.style-cards [role=radio]').nth(i).click(); await w.waitForTimeout(400); }
  await w.evaluate(() => document.fonts.ready);
  await w.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await w.close();
}

const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('페이지 오류:', String(e).slice(0, 160)));
await page.goto(`file:///${DIR.replace(/\\/g, '/')}stage.html?s=${S}&src=about:blank`);
await page.evaluate(() => document.fonts.ready);
const app = () => page.frames().find((f) => f.url().startsWith(APP));
let box;   // 창 안 화면의 왼쪽 위(무대 좌표) — 판이 옮겨 다니니 쓸 때마다 다시 잰다
const measure = async () => { box = await page.locator('#site').boundingBox().then((b) => ({ x: b.x / S, y: b.y / S })); };
// 판 · 부제목 · 자리 표시
const MOVE = 760;   // 판이 옮겨 가는 시간(--t-hold 700) + 여유
const layout = async (name, instant) => { await page.evaluate(([n, i]) => stage.layout(n, i), [name, !!instant]); if (!instant) await sleep(MOVE); await measure(); };
const cap = (mode, title = '', body = '') => page.evaluate(([m, t, b]) => stage.cap(m, t, b), [mode, title, body]);
const show = (id, on) => page.evaluate(([i, o]) => stage.show(i, o), [id, on]);

// ── 손가락 ──
async function point(sel, fx = .5, fy = .5, n = 0) {
  await measure();
  const r = await app().locator(sel).nth(n).evaluate((e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  return { x: box.x + r.x + r.w * fx, y: box.y + r.y + r.h * fy };
}
const touch = (p, phase) => page.evaluate(([x, y, ph]) => stage.touch(x, y, ph), [p.x, p.y, phase]);
async function tap(sel, o = {}) {
  const p = await point(sel, o.fx, o.fy, o.n);
  await touch(p, 'in');
  await page.mouse.move(p.x * S, p.y * S);
  await touch(p, 'down');
  await page.mouse.down();
  await sleep(o.hold ?? 110);
  await page.mouse.up();
  await touch(p, 'up');
}
// 누른 채 끌기 — from에서 (dx, dy)만큼
async function drag(p, dx, dy, ms = 700, holdEnd = 60) {
  await touch(p, 'in');
  await page.mouse.move(p.x * S, p.y * S);
  await touch(p, 'down');
  await page.mouse.down();
  await sleep(90);
  const t0 = Date.now();
  for (;;) {
    const e = ease(Math.min(1, (Date.now() - t0) / ms));
    const q = { x: p.x + dx * e, y: p.y + dy * e };
    await page.mouse.move(q.x * S, q.y * S);
    await touch(q, 'move');
    if (e >= 1) break;
    await sleep(14);
  }
  await sleep(holdEnd);
  await page.mouse.up();
  await touch({ x: p.x + dx, y: p.y + dy }, 'up');
}
// 한글 치기 — 아이폰 자판의 글쇠를 하나씩 누르고, 글은 자모가 모이는 단계까지(ㅇ → 여 → 열 …)
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
// ponytail: 겹받침 · 겹모음은 글쇠 하나로 친다 — 지금 문장엔 없다. 생기면 두 글쇠로 나눌 것
function keystrokes(text) {
  const out = []; let done = '';
  for (const ch of text) {
    const c = ch.charCodeAt(0) - 0xAC00;
    if (c >= 0 && c < 11172) {
      const jong = c % 28, base = ch.charCodeAt(0) - jong;
      out.push({ k: CHO[Math.floor(c / 588)], v: done + CHO[Math.floor(c / 588)] }, { k: JUNG[Math.floor((c % 588) / 28)], v: done + String.fromCharCode(base) });
      if (jong) out.push({ k: JONG[jong], v: done + ch });
    } else {
      if (ch !== ' ') out.push({ k: '123' });   // 문장 부호는 숫자 층에
      out.push({ k: ch, v: done + ch });
    }
    done += ch;
  }
  return out;
}
async function type(sel, text) {
  for (const { k, v } of keystrokes(text)) {
    await page.evaluate((k) => stage.key(k), k);
    if (v !== undefined) await app().locator(sel).evaluate((el, v) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
    await sleep(70 + Math.random() * 70);
  }
}
// 숨긴 개발용 단추 — 손가락 없이 누른다(도킹·뺌은 실제로는 폰을 꽂고 빼는 일이다)
const hiddenClick = (sel) => app().locator(sel).evaluate((e) => e.click());
let shotN = 0;
async function shot(name) { if (STILLS) await page.screenshot({ path: `${DIR}stills/${String(++shotN).padStart(2, '0')}-${name}.png` }); }

// ── 녹화 ──
const frames = [];
const FR = `${DIR}frames/`;
let cdp;
if (STILLS) { rmSync(`${DIR}stills`, { recursive: true, force: true }); mkdirSync(`${DIR}stills`); }
else {
  rmSync(FR, { recursive: true, force: true });
  mkdirSync(FR);
  cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 });
}
const T0 = Date.now();
const log = (s) => console.log(`${((Date.now() - T0) / 1000).toFixed(1)}s ${s}`);

// 00 홈 — 켜지는 장면부터
await sleep(800);
await page.evaluate((u) => { document.getElementById('site').src = u; }, `${APP}/?mock=1`);
while (!app()) await sleep(20);
await app().waitForLoadState('domcontentloaded');
await app().evaluate(() => { const s = document.createElement('style'); s.textContent = '.dock-test-link, .onwall-release { visibility: hidden !important; }'; document.head.append(s); });
// 폰에는 '올려 둠'이 없다 — (hover: hover) 규칙을 걷는다. 안 걷으면 창 안이 마지막 누른 자리를 기억해, 다음 화면에서 그 자리의 칸이
// (2/5 유머있는) 0.15초마다 밝아졌다 꺼져 연타처럼 보였다(11-03). 마우스를 창 밖으로 옮겨도 창 안 기억은 안 지워졌다
await app().evaluate(() => { for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch { continue; }   // 바깥 서체 묶음은 못 읽는다
  for (let i = rules.length - 1; i >= 0; i--) if (rules[i].conditionText?.includes('hover: hover')) sh.deleteRule(i); } });
// 창 안 문서도 서체를 미리 — 위 미리 받기는 다른 탭이라, 2/5가 들어오는 0.3초 동안 유머있는이 기본 굵은 서체로 찍혔다(11-03).
// Pretendard는 조각이 많고 이미 쓰는 중이라 뺀다
await app().evaluate(async () => { const all = []; document.fonts.forEach((f) => { if (!/Pretendard/.test(f.family)) all.push(f.load().catch(() => {})); }); await Promise.all(all); });
await measure();
log('홈');
await layout('group', true);
cap('G', 'Home', '메가폰트의 홈 화면입니다.\n처음이라면 [처음이에요]를 눌러 시작합니다.');
await app().waitForFunction(() => !document.querySelector('.home-boot'), null, { timeout: 15000 }).catch(() => {});
await sleep(2600);
await shot('home');

// 튜토리얼 세 장
await tap('.home-cta');
log('튜토리얼');
cap('G', 'Tutorial', '쓰기, 꽂기, 발화하기. 세 단계를 먼저 살펴봅니다.');
await sleep(4200); await shot('guide-1');
await tap('.primary-action'); await sleep(3400); await shot('guide-2');
await tap('.primary-action'); await sleep(4200); await shot('guide-3');
await tap('.primary-action');
// 가이드가 끝나면 판이 오른쪽 반으로 — 왼쪽은 영상 자리
cap('L', 'Step 1. Write', '하고 싶은 말을 최대 60자까지 씁니다.');
await sleep(300);
await layout('right');
await show('slot-write', true);

// 1/5 한 줄
log('1/5 쓰기');
await sleep(900);
await tap('.write-input', { fy: .45 });
await page.evaluate(() => stage.kb(true));
await sleep(700);
await type('.write-input', TEXT);
await sleep(1400); await shot('write');
await tap('.write-screen .primary-action');
await page.evaluate(() => stage.kb(false));

// 2/5 성격 — 차분한을 눌러 보고 다정한으로
log('2/5 성격');
cap('L', 'Step 2. Voice', '발화의 성격을 고릅니다.\n당당한 · 차분한 · 다정한 · 유머있는 중 하나.');
await sleep(2200);
await tap('.style-cards [role=radio]', { n: 1 }); await sleep(1300);
await tap('.style-cards [role=radio]', { n: 2 }); await sleep(1600); await shot('voice');
await tap('.tone-choice .primary-action');

// 3/5 조율 — 밀어 올리고, 크기 · 속도 · 무게를 옮기고, 눌러서 기본과 비교
log('3/5 조율');
cap('L', 'Step 3. Tune', '크기와 속도, 무게를 조절해 발화를\n세밀하게 다듬습니다.');
await sleep(3000); await shot('tone-intro');
await drag(await point('.tone-intro', .5, .78), 0, -260, 520);
await sleep(1800);
await tap('.tone-work [role=slider]', { n: 0, fx: 4.5 / 5 }); await sleep(1500);   // 크기 → 크게
await tap('.tone-work [role=slider]', { n: 2, fx: 3.5 / 5 }); await sleep(1600); await shot('tone-work');   // 무게 → 조금 무겁게
await tap('.tone-face', { hold: 1500 }); await sleep(1300);   // 누르는 동안 기본과 비교
await tap('.tone-work .primary-action');

// 4/5 담기 — 판이 왼쪽 반으로 건너가고 오른쪽에 설명 글. 밀어 올리고, 색을 넘겨 보고, 모양을 고른다
log('4/5 담기');
cap('');
await show('slot-write', false);
await layout('left');
cap('R', 'Step 4. Shape', '색과 모양을 골라 발화의 분위기를 정합니다.');
await sleep(2600); await shot('color-intro');
await drag(await point('.color-intro', .5, .78), 0, -260, 520);
await sleep(1800);
const roll = await point('.color-roll-window');
await drag(roll, 0, -34, 380); await sleep(1300);
await drag(roll, 0, -34, 380); await sleep(1300);
await tap('.color-choice [role=radio]', { n: 1 }); await sleep(1700);   // 미소
await tap('.color-choice [role=radio]', { n: 2 }); await sleep(1700);   // 단호
await tap('.color-choice [role=radio]', { n: 1 }); await sleep(2000); await shot('color-work');
await tap('.color-choice .primary-action');

// 5/5 미리보기
log('5/5 미리보기');
cap('R', 'Step 5. Preview', '미리보기로 벽에 나타날 모습을 확인합니다.');
await sleep(5000); await shot('preview');
await tap('.primary-action');

// 06 도킹 → 07 발화 중 → 08 완료
log('도킹');
cap('');
await layout('right');
await show('slot-dock', true);
cap('L', 'Docking', '폰을 메가폰트 앞쪽 홈에 세로로 꽂습니다.');
await sleep(3000); await shot('dock');
await hiddenClick('.dock-test-link');
log('발화 중');
cap('L', 'On Air', '꽂는 순간, 벽에 말이 떠오릅니다.\n발화는 최대 30초 동안 이어집니다.');
await sleep(5000); await shot('onwall');
// 5초 뒤 판이 오른쪽으로 밀려 퇴장 — 판이 다 빠진 뒤 34초가 전면 영상 자리(C0252 1:22–1:56, 사람이 떠날 때까지 — 11-03)
cap('');
await show('slot-dock', false);
await layout('out');
await show('slot-full', true);
await sleep(34000 - 1500);
// 판이 돌아오기 1.5초 전에 끝내 완료 화면이 들어오는 모습이 보이게 — 자리가 34초로 늘어 앱이 30초(EMPHASIS_MS)에 먼저 스스로 끝내면 단추가 없다
await app().evaluate(() => document.querySelector('.onwall-release')?.click());
await sleep(1500);
// 완료 — 가운데에서 등장
log('완료');
await show('slot-full', false);
await layout('hidden group', true);
await layout('group');
cap('G', 'Done', '말은 사흘 동안 벽에 머물다 사라집니다.');
await sleep(2800); await shot('done');
for (let i = 0; i < 3; i++) {   // 천천히 내려 보기
  const p = { x: box.x + 230, y: box.y + 620 };
  await touch(p, 'in'); await touch(p, 'down');
  const t0 = Date.now();
  for (let k = 0; k < 30; k++) {
    await page.mouse.move(p.x * S, p.y * S);
    await page.mouse.wheel(0, 10);
    await touch({ x: p.x, y: p.y - (k + 1) * 8 }, 'move');
    await sleep(Math.max(0, t0 + (k + 1) * 22 - Date.now()));
  }
  await touch({ x: p.x, y: p.y - 240 }, 'up');
  await sleep(1300);
}
await shot('done-bottom');
await sleep(1800);
// 크레딧
log('크레딧');
cap('');
await show('credits', true);
await sleep(700 + 4000); await shot('credits');
log('끝');

if (cdp) {
  await cdp.send('Page.stopScreencast');
  const end = Date.now() / 1000;
  let list = '';
  frames.forEach((f, i) => {
    const name = `f${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(FR + name, Buffer.from(f.data, 'base64'));
    list += `file '${name}'\nduration ${((frames[i + 1]?.t ?? end) - f.t).toFixed(4)}\n`;
  });
  list += `file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
  writeFileSync(FR + 'list.txt', list);
  const span = end - frames[0].t;
  console.log(`프레임 ${frames.length}장 / ${span.toFixed(1)}초 = 평균 ${(frames.length / span).toFixed(1)}fps`);
}
await browser.close();
