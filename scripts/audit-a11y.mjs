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
  await page.waitForTimeout(400);
}

let total = 0;

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
  console.log(`  ${v.length ? '✗' : '✓'} ${name}${v.length ? ` — ${v.length}건` : ''}`);
  for (const item of v) {
    console.log(`      [${item.impact}] ${item.id}: ${item.help}`);
    for (const n of item.nodes.slice(0, 2)) console.log(`         ${n.target.join(' ')}`);
  }
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

await page.getByRole('button', { name: /써봤어요/ }).click();
await audit('02 말투 (빈 상태)');
await page.getByRole('button', { name: '당당한' }).click();
await audit('02 말투 (고른 뒤)');

await page.locator('.primary-action').click();
await audit('03 한 줄 (빈 상태)');
await page.locator('.live-input').fill('여기서 크게 말해본 적 없다');
await audit('03 한 줄 (채운 뒤)');

await page.locator('.primary-action').click();
await page.waitForTimeout(600);
await audit('04 벽에서 보기');

await page.locator('.primary-action').click();
await page.waitForSelector('.dock-guide', { timeout: 15000 });
await audit('06 도킹');

await page.getByRole('button', { name: '꽂았어요' }).click();
await page.waitForTimeout(400);
await audit('07 벽에 떠 있음');

await page.getByRole('button', { name: '폰을 뺐어요' }).click();
await page.waitForSelector('.done-after', { timeout: 10000 });
await audit('08 완료');

await browser.close();
console.log(total ? `\n총 ${total}건 위반` : '\n위반 없음');
process.exit(total ? 1 : 0);
