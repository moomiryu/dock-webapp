// 폰 ↔ 벽 왕복 검증.
//
//   1. 폰이 한 줄을 쓰고 꽂는다        → 벽이 *그* 글을 크게 띄우는가
//   2. 폰에서 '폰을 뺐어요'를 누른다    → 벽의 강조가 거기서 끝나는가
//   3. 그 뒤 풍경에 합류하는가
//
// 이 왕복은 두 화면과 Firestore 문서 하나(control/display)를 동시에 건드려서
// 한쪽만 봐서는 깨진 걸 알 수 없다. 실제로 두 페이지를 띄워 확인한다.
//
//   npm run dev                       (다른 터미널에서 먼저)
//   node scripts/e2e-dock.mjs [baseUrl]
//
// 진짜 Firestore에 쓰므로 끝나고 테스트 글을 지운다 — 안 지우면 사흘 동안
// 벽에 떠 있는다.

import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5173';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const FS = `https://firestore.googleapis.com/v1/projects/${env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const KEY = env.VITE_FIREBASE_API_KEY;

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const STAMP = `왕복확인 ${Date.now().toString().slice(-6)}`;
const bare = (s) => s.replace(/\s/g, '');
let failed = 0;

function check(ok, label) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed++;
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.querySelector('.splash'), { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({ executablePath: BROWSERS.find((p) => existsSync(p)) });

const wall = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await wall.goto(`${BASE}/wall`, { waitUntil: 'load' });
await wall.waitForTimeout(3000);

const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await phone.goto(`${BASE}/`, { waitUntil: 'load' });
await settle(phone);

console.log(`\n한 줄: ${STAMP}\n`);

await phone.getByRole('button', { name: /써봤어요/ }).click();
await phone.getByRole('button', { name: '당당한' }).click();
await phone.locator('.primary-action').click();
await phone.locator('.tone-adjust .primary-action').click(); // 다듬기 → 한 줄

await phone.locator('.live-input').fill(STAMP);
await phone.locator('.primary-action').click(); // 다음 · 색
await phone.locator('.color-choice .primary-action').click();
await phone.waitForTimeout(700);
await phone.locator('.primary-action').click(); // 발화하기
await phone.waitForSelector('.dock-guide', { timeout: 20000 });
await phone.getByRole('button', { name: '꽂았어요' }).click();

// ── 1. 벽이 그 글을 띄우는가 ──────────────────────────────
// '아무 글'이 아니라 방금 쓴 그 글이어야 한다. 신호는 몇 초면 닿는데
// 목록은 60초마다 갱신되므로, id를 실어 보내지 않으면 앞사람 글이 뜬다.
let shown = false;
for (let i = 0; i < 20; i++) {
  await wall.waitForTimeout(700);
  const t = await wall.locator('.wall-show').innerText().catch(() => '');
  if (bare(t).includes(bare(STAMP))) {
    shown = true;
    console.log(`  (${((i + 1) * 0.7).toFixed(1)}초 만에 떴다)`);
    break;
  }
}
check(shown, '꽂으면 벽에 그 글이 크게 뜬다');

// ── 2. 폰을 빼면 강조가 끝나는가 ──────────────────────────
// 끝내는 것은 타이머가 아니라 사람이다. EMPHASIS_MS(30초)는 아무도 빼지
// 않았을 때의 상한일 뿐이고, 여기서는 그보다 훨씬 빨리 접혀야 한다.
await phone.getByRole('button', { name: '폰을 뺐어요' }).click();

let closed = false;
for (let i = 0; i < 14; i++) {
  await wall.waitForTimeout(700);
  if ((await wall.locator('.wall-show').count()) === 0) {
    closed = true;
    console.log(`  (${((i + 1) * 0.7).toFixed(1)}초 만에 접혔다)`);
    break;
  }
}
check(closed, '빼면 큰 목소리가 거기서 끝난다');

// ── 3. 뺀 사람의 08은 화면 전체를 쓴다 ────────────────────
await phone.waitForSelector('.done-after', { timeout: 10000 });
check((await phone.locator('.dock-buried').count()) === 0, '뺀 사람의 08은 화면 전체를 쓴다');

// ── 4. 풍경에 합류했는가 ──────────────────────────────────
// 목록 폴링이 60초라 여기서만 오래 기다린다. 강조는 신호로 즉시 오지만
// 풍경은 다음 폴링을 기다려야 한다 — 그 둘이 다른 경로라는 게 요점이다.
console.log('  (풍경 합류는 목록 폴링 60초를 기다린다…)');
let inCrowd = false;
for (let i = 0; i < 60; i++) {
  await wall.waitForTimeout(1500);
  const t = await wall.locator('.wall').innerText().catch(() => '');
  if (bare(t).includes(bare(STAMP))) {
    inCrowd = true;
    break;
  }
}
check(inCrowd, '그 뒤 다른 말들 사이로 들어간다');

await browser.close();

// ── 뒷정리 — 테스트 글을 사흘씩 벽에 둘 이유는 없다 ────────
const list = await (await fetch(`${FS}/messages?key=${KEY}&pageSize=200`)).json();
const mine = (list.documents ?? []).filter((d) => d.fields?.text?.stringValue === STAMP);
for (const d of mine) {
  const id = d.name.split('/').pop();
  const res = await fetch(`${FS}/messages/${id}?key=${KEY}`, { method: 'DELETE' });
  console.log(`\n테스트 글 삭제: ${res.ok ? '완료' : `실패 (${res.status})`} · ${id}`);
}
if (!mine.length) console.log('\n⚠ 지울 글을 못 찾았다 — 수동 확인 필요');

console.log(failed ? `\n${failed}개 실패` : '\n전부 통과');
process.exit(failed ? 1 : 0);
