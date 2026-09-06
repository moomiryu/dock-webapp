// 자형 네 칸이 정말 서로 다른 얼굴인가.
//
// 자형 선택은 이 앱의 내용 그 자체인데, 네 칸이 서로 안 벌어지면 화면은
// 멀쩡해 보여도 아무것도 고르게 하지 못한다. 그래서 무대만 잘라 나란히 찍는다.
// 웹폰트가 안 왔을 때 폴백으로 떨어지면 두 칸이 같은 얼굴이 되는데,
// 그건 눈으로만 잡힌다.
//
//   npm run dev
//   node scripts/shoot-faces.mjs [baseUrl]

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT = 'design/screens/faces';

const FACES = [
  { label: '다정한', file: 'doran', kind: '손글씨' },
  { label: '발랄한', file: 'deulseok', kind: '둥근고딕' },
  { label: '당당한', file: 'ttoryeot', kind: '고딕' },
  { label: '차분한', file: 'chabun', kind: '명조' }
];

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: BROWSERS.find((p) => existsSync(p)) });
const page = await (
  await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    locale: 'ko-KR',
    reducedMotion: 'reduce'
  })
).newPage();

await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => !document.querySelector('.splash'), { timeout: 12000 });
await page.getByRole('button', { name: /써봤어요/ }).click();

console.log(`자형 무대 → ${OUT}/\n`);

for (const f of FACES) {
  await page.getByRole('button', { name: f.label }).click();
  await page.waitForTimeout(600);

  // 실제로 어떤 서체가 그려졌는지는 계산된 값이 말해준다.
  // 라벨과 그림이 어긋나는 경우를 눈이 아니라 문자열로 잡는다.
  const used = await page.locator('.z-glyph').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, weight: cs.fontWeight };
  });

  await page.locator('.z-glyph-stage').screenshot({
    path: `${OUT}/${f.file}.jpg`,
    type: 'jpeg',
    quality: 94
  });
  console.log(`  ${f.label} (${f.kind})  →  ${used.family.split(',')[0]}`);
}

// 카드 네 칸이 같이 보이는 한 장도 남긴다 — 나란히 놓지 않으면
// 두 칸이 닮았다는 걸 알아채기 어렵다.
await page.locator('.style-cards').screenshot({
  path: `${OUT}/cards.jpg`,
  type: 'jpeg',
  quality: 94
});
console.log(`  cards.jpg`);

await browser.close();
