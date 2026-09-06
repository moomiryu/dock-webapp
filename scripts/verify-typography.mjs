import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const out='design/revision-2026-09-07'; mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
for(const width of [320,390,480]){
 const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:5173/?mock=1');
 await page.locator('.home-headline').waitFor();
 await page.screenshot({path:`${out}/home-${width}.png`});
 const check=async label=>{const r=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,fonts:document.fonts.check('400 16px "Lineal VF"'),family:getComputedStyle(document.querySelector('h1,h2') || document.querySelector('.z-frame')).fontFamily}));if(r.overflow)throw Error(label+' horizontal overflow');console.log(width,label,r);};
 await check('home');
 await page.getByRole('button',{name:'처음이에요',exact:true}).click();
 await page.locator('.info-track').waitFor();
 await check('tutorial');
 await page.screenshot({path:`${out}/tutorial-${width}.png`});
 for(let i=1;i<6;i++){await page.getByRole('button',{name:'아래로 스크롤하여 다음 설명 보기'}).click();await page.waitForTimeout(100); if(await page.locator('.info-head').innerText()!==`${i+1} / 6`)throw Error('scroll step '+i);}
 await page.screenshot({path:`${out}/tutorial-last-${width}.png`});
 await page.locator('.info-track').focus();await page.keyboard.press('Home');
 await page.getByRole('button',{name:'시작하기',exact:true}).click();
 await page.locator('.style-cards').waitFor();
 await check('glyph');
 if(!await page.locator('.z1 > .primary-action').isDisabled())throw Error('empty selection enabled');
 await page.screenshot({path:`${out}/glyph-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'다정한',exact:true}).click();
 await page.locator('.tone-choice .primary-action').click();
 await page.getByRole('button',{name:'세게',exact:true}).click();
 await page.getByRole('button',{name:'느긋하게',exact:true}).click();
 await page.getByRole('button',{name:'흘려',exact:true}).click();
 await page.screenshot({path:`${out}/glyph-picked-${width}.png`,fullPage:true});
 await page.locator('.z1 > .primary-action').click();
 await page.locator('.live-input').waitFor();
 await check('compose');
 await page.close();
}
await browser.close();
