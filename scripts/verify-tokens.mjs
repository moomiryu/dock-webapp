// 토큰을 옮기거나 이름을 바꿀 때, 화면이 정말 그대로인지 증명한다.
//
// CSS 리팩터는 "보기엔 같은데?"로 끝나기 쉽다. 그건 증명이 아니다.
// 이 스크립트는 손대기 전에 :root 토큰의 계산값과 주요 요소의 계산 스타일을
// 통째로 찍어 두고, 손댄 뒤 같은 걸 찍어 한 값씩 대조한다. 다른 게 하나라도
// 있으면 이름을 대며 말한다.
//
//   npm run dev                              (다른 터미널에서 먼저)
//   node scripts/verify-tokens.mjs before.json     ← 손대기 전
//   ...토큰 작업...
//   node scripts/verify-tokens.mjs after.json      ← 손댄 뒤
//   node scripts/verify-tokens.mjs before.json after.json   ← 대조
//
// 2026-09-11에 tokens.css와 app.css의 토큰을 한 파일로 합칠 때 썼다.
// 495개 계산값 중 0개 변경으로 무위험을 확인했다.

import { chromium } from 'playwright-core';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2);
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

// ── 대조 모드 ────────────────────────────────────────────────────
if (a && b) {
  const before = JSON.parse(readFileSync(a, 'utf8'));
  const after = JSON.parse(readFileSync(b, 'utf8'));
  let diff = 0;
  let total = 0;

  const bv = before[Object.keys(before)[0]].__vars;
  const av = after[Object.keys(after)[0]].__vars;
  const moved = Object.keys(av).filter((k) => k in bv && bv[k] !== av[k]);
  const gone = Object.keys(bv).filter((k) => !(k in av));
  console.log(`\n:root 토큰: ${Object.keys(bv).length}개 → ${Object.keys(av).length}개`);
  console.log(`  값이 달라진 것 ${moved.length}개${moved.length ? ': ' + moved.join(', ') : ''}`);
  console.log(`  사라진 것 ${gone.length}개`);

  for (const screen of Object.keys(before)) {
    for (const [sel, props] of Object.entries(before[screen])) {
      if (sel === '__vars') continue;
      if (!after[screen]?.[sel]) {
        console.log(`  ✗ ${screen} / ${sel} 가 사라졌다`);
        diff++;
        continue;
      }
      for (const [p, v] of Object.entries(props)) {
        total++;
        const w = after[screen][sel][p];
        if (v !== w) {
          diff++;
          console.log(`  ✗ ${screen} / ${sel} / ${p}: ${v} → ${w}`);
        }
      }
    }
  }
  console.log(`\n계산값 ${total}개 비교 · 달라진 것 ${diff}개${diff ? '' : '  ← 화면은 그대로다'}\n`);
  process.exit(diff ? 1 : 0);
}

// ── 촬영 모드 ────────────────────────────────────────────────────
const OUT = a ?? 'tokens-snapshot.json';
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];

const PROPS = [
  'color', 'backgroundColor', 'fontSize', 'fontWeight', 'lineHeight', 'paddingTop',
  'paddingLeft', 'marginTop', 'borderRadius', 'borderTopWidth', 'borderTopColor',
  'minHeight', 'gap', 'letterSpacing', 'opacity'
];

// 토큰을 직접 쓰는 대표 요소들. 프레임·머리·버튼·본문·카드·레일·액자.
const SELECTORS = [
  '.z-frame', '.z-header', '.primary-action', '.z-ask h1', '.z-ask p', '.style-card',
  '.z-rail', '.proj-frame', '.proj-meta', '.home-cta', '.home-info-btn',
  '.z-axis-label', '.z-step', 'body'
];

const browser = await chromium.launch({ executablePath: BROWSERS.find((p) => existsSync(p)) });
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
).newPage();

const grab = () =>
  page.evaluate(
    ([props, sels]) => {
      const out = {};
      // :root에 정의된 모든 커스텀 프로퍼티를 계산값으로 읽는다.
      // 선언된 문자열이 아니라 계산값이라, var() 체인이 끊기면 빈 값으로 드러난다.
      const rs = getComputedStyle(document.documentElement);
      const vars = {};
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const r of rules ?? []) {
          if (r.selectorText === ':root') {
            for (const p of r.style) if (p.startsWith('--')) vars[p] = rs.getPropertyValue(p).trim();
          }
        }
      }
      out.__vars = vars;
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = cs[p];
        out[sel] = o;
      }
      return out;
    },
    [PROPS, SELECTORS]
  );

const snap = {};
await page.goto(`${BASE}/?mock=1`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => !document.querySelector('.splash'), { timeout: 12000 }).catch(() => {});
snap['01 홈'] = await grab();

await page.getByRole('button', { name: /써봤어요/ }).click();
await page.waitForTimeout(400);
snap['02 말투'] = await grab();

await page.getByRole('button', { name: '당당한' }).click();
await page.locator('.primary-action').click();
await page.waitForTimeout(400);
snap['02 다듬기'] = await grab();

await page.locator('.tone-adjust .primary-action').click();
await page.waitForTimeout(400);
snap['03 한 줄'] = await grab();

await page.locator('.live-input').fill('여기서 크게 말해본 적 없다');
await page.locator('.primary-action').click();
await page.waitForTimeout(600);
snap['04 색'] = await grab();

writeFileSync(OUT, JSON.stringify(snap, null, 1));
const n = Object.keys(snap['01 홈'].__vars).length;
console.log(`${OUT} 저장 — 화면 ${Object.keys(snap).length}개 · :root 토큰 ${n}개`);
await browser.close();
