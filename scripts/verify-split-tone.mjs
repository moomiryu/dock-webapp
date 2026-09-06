import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = 'design/split-tone'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath });
try {
 for (const viewport of [{width:320,height:640},{width:390,height:844},{width:480,height:844}]) {
  const page = await browser.newPage({ viewport, reducedMotion:'reduce' });
  const next = () => page.locator('.z-frame > .primary-action').click();
  const check = async (stage, step) => {
   assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),String(step));
   assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuemax'),'5');
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
   await page.screenshot({ path:`${out}/${stage}-${viewport.width}.png`, fullPage:true });
  };
  await page.goto(`${base}/?mock=1`);
  await page.locator('.home-headline span').waitFor();
  await page.evaluate(() => document.fonts.load('900 100px "Lineal VF"'));
  await page.waitForTimeout(200);
  const titleBounds = await page.locator('.home-headline span').evaluate(el => ({
    width: el.getBoundingClientRect().width, available: el.parentElement.clientWidth
  }));
  assert(titleBounds.width <= titleBounds.available, JSON.stringify(titleBounds));
  assert.equal(await page.locator('.home-headline span').evaluate(el=>getComputedStyle(el).fontVariationSettings),'"wght" 1150');
  await page.getByRole('button',{name:'써봤어요',exact:true}).click();
  assert.equal(await page.locator('.z-axes').count(),0);
  assert.equal(await page.locator('.z-glyph').count(),0);
  assert.equal(await page.locator('.primary-action').isDisabled(),true);
  await page.getByRole('button',{name:'당당한',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('.style-card.on') && !document.querySelector('.primary-action').disabled);
  await check('choose',1);
  await next();
  assert.equal(await page.locator('.style-cards').count(),0);
  await check('adjust',2);
  // Defaults can proceed without requiring any adjustment.
  await next(); await page.locator('.live-input').fill('한 번 고른 말투를 기억해요');
  await next();
  await page.getByRole('radio', {name:'분홍 색 조합', exact:true}).check();
  await page.getByRole('button', {name:'한 줄 다시 쓰기',exact:true}).click();
  await page.getByRole('button',{name:'말투 다듬기로',exact:true}).click();
  await page.getByRole('button',{name:'세게',exact:true}).click();
  await page.getByRole('button',{name:'느긋하게',exact:true}).click();
  await page.getByRole('button',{name:'흘려',exact:true}).click();
  await page.getByRole('button',{name:'바꾸기',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'당당한',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'차분한',exact:true}).click(); await next();
  for (const name of ['세게','느긋하게','흘려']) assert.equal(await page.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
  const fits = await page.locator('.z-glyph').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right;});
  assert.equal(fits,true);
  await next();
  assert.equal(await page.locator('.live-input').inputValue(),'한 번 고른 말투를 기억해요');

  await check('compose',3); await next();
  assert.equal(await page.getByRole('radio', {name:'분홍 색 조합',exact:true}).isChecked(),true);
  await check('color',4);
  await page.getByRole('radio', {name:'분홍 색 조합',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.color-preview .voice-bubble')).backgroundColor === 'rgb(228, 0, 43)');
  await next(); await check('preview',5);
  await page.getByRole('button',{name:'색 다시 고르기',exact:true}).click();
  assert.equal(await page.getByRole('radio',{name:'적기 색 조합',exact:true}).isChecked(),true);
  await next();
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('megafont.draft.v1')));
  assert.equal(draft.tone.font,'chabun');assert.equal(draft.tone.wght,700);assert.equal(draft.tone.tone,1.3);assert.equal(draft.tone.slnt,-24);
  await page.close(); console.log(`PASS ${viewport.width}: split, defaults, back navigation, tone/text/colour persistence, preview`);
 }
} finally { await browser.close(); }
