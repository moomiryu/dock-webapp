// 앱을 브라우저로 몰고 다니는 공용 장치.
//
// 이 파일이 생기기 전까지, 화면을 한 번 들여다볼 때마다 같은 상용구를 손으로
// 다시 썼다. 세어 보니 브라우저 띄우기 41번, 390×844 뷰포트 38번, splash
// 대기 28번, '써봤어요 → 당당한 → …' 클릭 경로 19번이었다.
//
// 클릭 경로는 절차가 아니라 *이 프로젝트의 사실*이다. 화면 이름과 버튼 글자가
// 바뀌면 여기 한 곳만 고치면 된다 — 실제로 버튼 어휘를 통째로 갈아엎은 적이
// 있고(다음 → 다 썼어요), 그때 흩어진 탐침들을 전부 고쳐야 했다.
//
//   import { open, toCompose } from './lib/drive.mjs';
//   const { page, close } = await open();
//   await toCompose(page, '여기서 크게 말해본 적 없다');
//   await page.screenshot({ path: '...' });
//   await close();

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

/** 시스템에 깔린 브라우저를 그대로 쓴다 — 따로 내려받지 않는다. */
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];

/** 실제 기기 크기. 벽은 2.4×1.5m = 16:10. */
export const PHONE = { width: 390, height: 844 };
export const WALL = { width: 1280, height: 800 };
/** 한글 자판이 올라왔을 때 남는 높이. 여기서 버튼이 잘린 적이 있다. */
export const KEYBOARD = { width: 390, height: 380 };

/**
 * 브라우저를 띄우고 페이지를 연다.
 *
 * @param {object} o
 * @param {'phone'|'wall'|'keyboard'|{width,height}} [o.size]  기본 phone
 * @param {number}  [o.scale]    deviceScaleFactor. 확대해 볼 때만 2~3
 * @param {boolean} [o.reduced]  모션 끔. 캐릭터가 멈춰야 찍히는 것들이 있다
 * @param {boolean} [o.live]     프로덕션(megafont.vercel.app)을 본다
 * @param {boolean} [o.real]     ?mock=1 없이 -- 실제 Firestore에 쓴다. 조심
 * @param {boolean} [o.quiet]    콘솔 오류를 흘리지 않는다
 */
export async function open(o = {}) {
  const named = { phone: PHONE, wall: WALL, keyboard: KEYBOARD };
  const viewport = typeof o.size === 'string' ? named[o.size] : o.size ?? PHONE;
  const browser = await chromium.launch({ executablePath: BROWSERS.find((p) => existsSync(p)) });
  const context = await browser.newContext({
    viewport,
    locale: 'ko-KR',
    deviceScaleFactor: o.scale ?? 1,
    ...(o.reduced ? { reducedMotion: 'reduce' } : null)
  });
  const page = await context.newPage();
  if (!o.quiet) {
    page.on('pageerror', (e) => console.log('  페이지 오류:', String(e).slice(0, 160)));
    page.on('console', (m) => {
      if (m.type() === 'error') console.log('  콘솔 오류:', m.text().slice(0, 160));
    });
  }
  page.__base = o.live ? 'https://megafont.vercel.app' : (process.env.BASE_URL ?? 'http://localhost:5173');
  page.__mock = o.real ? '' : '?mock=1';
  return { browser, context, page, close: () => browser.close() };
}

/** 화면이 자리를 잡을 때까지. 웹폰트와 splash 둘 다 기다린다. */
export async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForFunction(() => !document.querySelector('.splash'), { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(300);
}

/** 01 홈 */
export async function toHome(page) {
  await page.goto(`${page.__base}/${page.__mock}`, { waitUntil: 'load' });
  await settle(page);
}

/** 02 말투 — 자형 고르는 화면. font를 주면 골라 둔 상태까지 간다. */
export async function toVoice(page, font = null) {
  await toHome(page);
  await page.getByRole('button', { name: /써봤어요/ }).click();
  await page.waitForTimeout(300);
  if (font) await page.getByRole('button', { name: font }).click();
}

/** 02 말하는 법 — 목소리·속도·말끝 조절 */
export async function toShape(page, font = '당당한') {
  await toVoice(page, font);
  await page.locator('.primary-action').click();
  await page.waitForTimeout(300);
}

/** 03 한 줄 — text를 주면 채워 넣는다 */
export async function toCompose(page, text = null, font = '당당한') {
  await toShape(page, font);
  await page.locator('.tone-adjust .primary-action').click();
  await page.waitForTimeout(300);
  if (text !== null) {
    await page.locator('.live-input').fill(text);
    await page.waitForTimeout(300);
  }
}

/** 04 색 */
export async function toColor(page, text = '여기서 크게 말해본 적 없다', font = '당당한') {
  await toCompose(page, text, font);
  await page.locator('.primary-action').click();
  await page.waitForTimeout(400);
}

/** 05 벽에서 보기 — 시뮬레이션이 한 바퀴 돌 때까지 기다린다 */
export async function toPreview(page, text, font) {
  await toColor(page, text, font);
  await page.locator('.color-choice .primary-action').click();
  await page.waitForTimeout(3000);
}

/** 06 도킹 안내 */
export async function toDock(page, text, font) {
  await toPreview(page, text, font);
  await page.locator('.primary-action').click();
  await page.waitForSelector('.dock-guide', { timeout: 20000 });
}

/** /wall — 벽 출력. 풍경이 자리 잡을 때까지 기다린다. */
export async function toWall(page) {
  await page.goto(`${page.__base}/wall${page.__mock}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(3000);
}

/**
 * 같은 자리를 두 시점에 찍어 파일 둘로 남긴다.
 *
 * 움직이는 것을 눈으로 판정하지 않기 위한 장치다 — 파동의 세기(0.05 / 0.12 /
 * 0.22)를 이걸로 골랐다. 두 장의 차이를 세는 것은 PIL이 한다:
 *
 *   from PIL import Image, ImageChops
 *   d = ImageChops.difference(Image.open(a).convert('L'), Image.open(b).convert('L'))
 *   moved = sum(d.histogram()[31:])      # 31 = 잡음 문턱
 *
 * 자리가 고정된 것만 잴 수 있다. 화면을 가로질러 흘러가는 것(.wall-block)에
 * 쓰면 흔들림이 아니라 이동량을 재게 된다 -- 제자리에서 형태만 변하는 것
 * (.wall-show의 강조 한 줄, 캐릭터)에 쓴다.
 *
 * @returns {Promise<[string,string]>} 두 png 경로
 */
export async function shootPair(page, selector, dir, name, gapMs = 1500) {
  const a = `${dir}/${name}-a.png`;
  const b = `${dir}/${name}-b.png`;
  // element screenshot을 쓰면 안 된다. 그건 요소가 멈출 때까지 기다리는데,
  // 여기서 재려는 것이 바로 '안 멈추는 것'이라 영원히 기다리다 timeout 난다
  // ("element is not stable"). 그래서 자리를 한 번 재 두고, 그 자리를
  // 페이지에서 두 번 오려낸다 -- 오려내기는 기다리지 않는다.
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} 를 찾지 못했다`);
  const clip = {
    x: Math.max(0, Math.floor(box.x)),
    y: Math.max(0, Math.floor(box.y)),
    width: Math.ceil(box.width),
    height: Math.ceil(box.height)
  };
  await page.screenshot({ path: a, clip });
  await page.waitForTimeout(gapMs);
  await page.screenshot({ path: b, clip });
  return [a, b];
}
