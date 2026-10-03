// 빗금이 글자를 덮나 — 폰 4/5에서 글 여덟 × 모양 셋. 글자 자리(DOM의 글자 하나하나의 네모 — 줄 네모는 기운 줄에서 모서리까지 셌다) 안에서 빗금으로 오려진 화소를 센다
const D = await import(new URL('../../lib/drive.mjs', import.meta.url).href);
const HATCH = (process.env.HATCH_OUT || (await import('node:path')).join((await import('node:os')).tmpdir(), 'megafont-stone-hatch')) + '/';   // 결과는 임시 폴더
(await import('node:fs')).mkdirSync(HATCH, { recursive: true });
const TEXTS = ['괜찮아', '조용히 오래 생각했다', '여기서 크게 말해본 적 없다', '오늘은 아무 말도 하고 싶지 않았다',
  '사흘 뒤면 사라질 말이라서 더 솔직하게 쓸 수 있었다', '아무도 모르게 혼자 웃었다', '천천히 가도 된다고 말해 주고 싶다',
  '말하지 못한 것들이 오래 남는다 그래서 여기에 적어 둔다 누군가 읽어 주기를'];
const SHAPES = ['올리기', '기본', '내리기'];
let total = 0, bad = 0;
const errs = [];
for (const text of TEXTS) {
  const { page, close } = await D.open({ size: 'phone', scale: 2, quiet: true });
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await D.toColor(page, text, '차분한');
  for (const sh of SHAPES) {
    await page.getByText(sh, { exact: true }).first().click();
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const out = [];
      for (const bub of document.querySelectorAll('.cloud-bubble')) {
        const cv = bub.querySelector('.stone-art canvas');
        if (!cv || !cv.width || bub.getBoundingClientRect().width < 50) continue;
        const cr = cv.getBoundingClientRect(), sx = cv.width / cr.width, sy = cv.height / cr.height;
        const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        const walker = document.createTreeWalker(bub, NodeFilter.SHOW_TEXT);
        let cut = 0, seen = 0, n;
        while ((n = walker.nextNode())) {
          if (!n.textContent.trim()) continue;
          const range = document.createRange(), T = n.textContent;
          const rects = [];
          for (let i = 0; i < T.length; i++) { if (!T[i].trim()) continue; range.setStart(n, i); range.setEnd(n, i + 1); rects.push(...range.getClientRects()); }
          for (const q of rects) {
            const x0 = Math.max(0, Math.floor((q.left - cr.left) * sx)), x1 = Math.min(cv.width, Math.ceil((q.right - cr.left) * sx));
            const y0 = Math.max(0, Math.floor((q.top - cr.top) * sy)), y1 = Math.min(cv.height, Math.ceil((q.bottom - cr.top) * sy));
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const a = data[(y * cv.width + x) * 4 + 3]; seen++; if (a > 0 && a < 250) cut++; }
          }
        }
        out.push({ cut, seen });
      }
      return out;
    });
    const main = r.sort((a, b) => b.seen - a.seen)[0] ?? { cut: -1, seen: 0 };
    total++; if (main.cut) bad++;
    console.log(text.slice(0, 12).padEnd(12, ' '), sh, '글자 자리 화소', main.seen, '빗금에 오려진 화소', main.cut);
  }
  await close();
}
console.log(`합계 ${total}칸 중 글자에 빗금이 닿은 칸 ${bad}`, '오류', errs.length ? errs.slice(0, 3) : '없음');
