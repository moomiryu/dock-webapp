// 무대 화면에서 서체가 실제로 불러와졌는지
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
const DIR = fileURLToPath(new URL('.', import.meta.url)).replaceAll('\\', '/');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const ctx = await b.newContext();
// 무대(file://)가 개발 서버의 서체를 받으려면 '다른 주소에서 써도 된다'는 머리말이 있어야 한다 — 없으면 브라우저가 막고 기본 서체로 찍힌다
await ctx.route('http://localhost:5173/fonts/**', async (r) => { const res = await r.fetch(); await r.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } }); });
const p = await ctx.newPage();
p.on('console', (m) => m.type() === 'error' && console.log('오류:', m.text().slice(0, 140)));
await p.goto(`file:///${DIR}stage.html?src=about:blank`);
await p.evaluate(() => { stage.cap('L', 'Step 1. Write', '하고 싶은 말을 60자까지 씁니다.'); document.getElementById('credits').classList.add('on'); });
await p.waitForTimeout(2500);
console.log(await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status !== 'unloaded').map((f) => `${f.family} ${f.weight} ${f.status}`).join('\n'); }));
await b.close();
