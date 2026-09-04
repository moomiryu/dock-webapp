// 화면 캡처 — 실행 중인 dev 서버를 폰 크기 뷰포트로 열어 각 화면을 JPG로 뽑는다.
//
//   npm run dev          (다른 터미널에서 먼저)
//   node scripts/shoot-screens.mjs [baseUrl]
//
// mock 모드(?mock=1)로 돌기 때문에 마지막 전송이 Firestore에 닿지 않는다.
// 시스템에 설치된 Chrome 또는 Edge를 그대로 쓴다 (브라우저 내려받지 않음).
//
// 파일 번호는 플로우 문서(00 Splash ~ 06 Docking)를 따른다.
// 못 찍는 화면: 05 Processing (mock 전송이 즉시 끝나 한 프레임도 남지 않음).

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT = 'design/screens';

// 폰 한 대 크기. 2배 밀도로 찍어 발표 자료에서도 버틴다.
const VIEWPORT = { width: 390, height: 844 };
const SCALE = 2;

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const SAMPLE_TEXT = '오늘 못 한 말';

function findBrowser() {
  const hit = BROWSERS.find((p) => existsSync(p));
  if (!hit) throw new Error('Chrome도 Edge도 찾지 못했습니다.');
  return hit;
}

async function capture(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 92 });
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement;
    return el.scrollHeight - el.clientHeight;
  });
  console.log(`  ${name}.jpg${overflow > 4 ? `  ⚠ 뷰포트보다 ${overflow}px 넘침` : ''}`);
}

async function settle(page) {
  // 웹폰트(Adobe Fonts는 JS 로더라 늦게 온다) → splash가 걷힘 → 진입 모션
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForFunction(() => !document.querySelector('.splash'), { timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(900);
}

async function shoot(page, name) {
  await settle(page);
  await capture(page, name);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: findBrowser() });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    locale: 'ko-KR',
    reducedMotion: 'reduce' // 캡처 시점마다 모션 위상이 달라지지 않게
  });
  const page = await ctx.newPage();
  const url = (path) => `${BASE}${path}`;

  console.log(`캡처 → ${OUT}/  (${VIEWPORT.width}×${VIEWPORT.height} @${SCALE}x)\n`);

  // 00 Splash — 걷히기 전에 찍는다
  await page.goto(url('/?mock=1'), { waitUntil: 'commit' });
  await page.waitForTimeout(280);
  await capture(page, '00-splash');

  // 01 Intro
  await shoot(page, '01-home');

  // 01 프로젝트 정보 덮개
  await page.getByRole('button', { name: '프로젝트 정보' }).click();
  await shoot(page, '01-info');

  // 02 자형 — 고르기 전(빈 무대)과 고른 뒤
  await page.goto(url('/?mock=1'), { waitUntil: 'load' });
  await settle(page);
  await page.getByRole('button', { name: '시작하기', exact: true }).click();
  await shoot(page, '02-glyph-empty');
  await page.getByRole('button', { name: '당당한' }).click();
  await shoot(page, '02-glyph-picked');

  // 03 메시지 — 빈 상태와 채운 상태
  await page.locator('.primary-action').click();
  await shoot(page, '03-message-empty');
  await page.locator('.live-input').fill(SAMPLE_TEXT);
  await shoot(page, '03-message-filled');

  // 04 최종 미리보기
  await page.locator('.primary-action').click();
  await shoot(page, '04-preview');

  // 05 Processing은 mock에서 즉시 끝나 캡처되지 않는다 → 06으로
  await page.locator('.primary-action').click();
  await page.waitForTimeout(1200);
  await shoot(page, '06-docking');

  await browser.close();
  console.log('\n완료.');
}

main().catch((err) => {
  console.error('\n실패:', err.message);
  process.exit(1);
});
