// 접근성 감사 — 폰 앱 화면마다 axe-core를 던져 넣고 위반을 센다.
//
// 활자·간격·버튼 크기를 손댈 때마다 돌린다. 흑백 UI는 대비가 문제될 일이
// 거의 없지만 12px 회색 캡션과 32px 버튼이 늘 아슬아슬하다.
//
//   npm run dev
//   node scripts/audit-a11y.mjs [baseUrl]

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const AXE = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const browser = await chromium.launch({ executablePath: BROWSERS.find((p) => existsSync(p)) });
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
).newPage();

async function settle() {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.querySelector('.splash'), { timeout: 12000 }).catch(() => {});
  // 빨강이 캐릭터 자리로 내려앉는 900ms까지 기다린다
  await page.waitForFunction(() => !document.querySelector('.splash-veil'), { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
}

let total = 0;
/** 대비를 재지 못한 자리의 합 — 위반이 아니라 사각지대다 */
let dark = 0;

async function audit(name) {
  // 색·너비 전이가 끝난 뒤에 잰다. 전이 도중에 재면 없는 대비 위반이 잡힌다.
  await page.waitForTimeout(500);
  await page.addScriptTag({ url: AXE });
  const res = await page.evaluate(async () =>
    // WCAG 2.0/2.1 A·AA만 본다. best-practice는 의견이라 세지 않는다.
    // @ts-ignore
    await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
  );
  const v = res.violations;
  total += v.length;
  /* 대비를 **재지 못한** 자리. 위반이 아니라 사각지대다.
     axe는 바닥의 더운 기운(::after) 같은 가상 요소가 글자 위에 걸리면
     "배경을 알 수 없다"며 판정 불가로 넘긴다. 세지 않으니 화면은 통과로
     찍히는데, 실제로 그 자리에서 흰 종이 위의 흰 글자가 몇 달 살아 있었다
     (.compose-count.is-full, 2026-09-21에 눈으로 찾았다).

     못 잡는 것은 어쩔 수 없지만 **못 봤다는 사실은 보여야 한다.** 세지는
     않고 적기만 한다 — 여기 뜬 자리는 사람이 값을 재서 확인한다. */
  const blind = res.incomplete.filter((x) => x.id === 'color-contrast');
  console.log(`  ${v.length ? '✗' : '✓'} ${name}${v.length ? ` — ${v.length}건` : ''}`
    + (blind.length ? `   ⚠ 대비 판정 불가 ${blind.reduce((n, x) => n + x.nodes.length, 0)}곳` : ''));
  for (const item of v) {
    console.log(`      [${item.impact}] ${item.id}: ${item.help}`);
    for (const n of item.nodes.slice(0, 2)) console.log(`         ${n.target.join(' ')}`);
  }
  dark += blind.reduce((n, x) => n + x.nodes.length, 0);
}

console.log(`\n접근성 감사 → ${BASE}\n`);

await page.goto(`${BASE}/?mock=1`, { waitUntil: 'load' });
await settle();
await audit('01 홈');

await page.getByRole('button', { name: '처음이에요' }).click();
await page.waitForTimeout(500);
await audit('01 소개');
await page.getByRole('button', { name: '처음으로', exact: true }).click();
await page.waitForTimeout(400);

// 2026-09-19에 순서가 뒤집혔다 — 글이 먼저다.
await page.getByRole('button', { name: /써봤어요/ }).click();
await page.waitForTimeout(400);
await audit('01 한 줄 (빈 상태)');
await page.locator('.write-input').fill('여기서 크게 말해본 적 없다');
await page.waitForTimeout(300);
await audit('01 한 줄 (채운 뒤)');

// 60자를 채운 상태도 본다. 그 자리에만 걸리는 규칙이 있어서다
// (.compose-count.is-full). 2026-09-21까지 이 화면이 목록에 없었고,
// 그동안 그 규칙은 흰 종이 위에 흰 글자였다 — 검사는 통과하고 있었다.
await page.locator('.write-input').fill('가'.repeat(60));
await page.waitForTimeout(300);
await audit('01 한 줄 (60자)');
await page.locator('.write-input').fill('여기서 크게 말해본 적 없다');
await page.waitForTimeout(300);

await page.locator('.write-screen .primary-action').click();
await page.waitForTimeout(400);
await audit('02 성격 (빈 상태)');
await page.getByRole('radio', { name: '당당한' }).click();
await audit('02 성격 (고른 뒤)');

await page.locator('.tone-choice .primary-action').click();
await page.waitForTimeout(400);
await audit('03 조율 (설명)');
await page.locator('.tone-intro').click();
await page.waitForTimeout(700);
await audit('03 조율 (조작)');

await page.locator('.tone-work .primary-action').click();
await page.waitForTimeout(600);
await audit('04 색');
await page.locator('.color-choice .primary-action').click();
await audit('05 벽에서 보기');

await page.locator('.primary-action').click();
await page.waitForSelector('.dock-guide', { timeout: 15000 });
await audit('06 도킹');

await page.getByRole('button', { name: '꽂았어요' }).click();
await page.waitForTimeout(400);
await audit('07 벽에 떠 있음');

await page.getByRole('button', { name: '폰을 뺐어요' }).click();
await page.waitForSelector('.done', { timeout: 10000 });
await audit('08 완료');

await browser.close();
console.log(total ? `\n총 ${total}건 위반` : '\n위반 없음');
if (dark) {
  console.log(`대비를 **재지 못한** 자리 ${dark}곳. 바닥의 더운 기운(::after)이 글자 위에 걸려`);
  console.log('axe가 배경을 못 읽는다 — 위반이 아니라 검사가 못 본 자리다. 그 자리의 색은 사람이 잰다.');
}
process.exit(total ? 1 : 0);
