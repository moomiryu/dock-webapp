// 구름 빗금이 글자를 덮나 — 폰 4/5에서 글 여덟 × 모양 셋(가운데 · 아치 · 미소). 글자 하나하나의 네모 안에서 빗금(검은 줄) 화소를 센다(0이어야).
// 개발 서버가 떠 있어야 한다
const D = await import(new URL('../../lib/drive.mjs', import.meta.url).href);
const TEXTS = ['괜찮아', '오늘은 조금 따뜻했다', '시험 끝나면 바다 보러 갈 거야', '천천히 가도 된다고 말해 주고 싶다', '고마웠다고 말하고 싶었어',
  '사흘 뒤면 사라질 말이라서 더 솔직하게 쓸 수 있었다', '기숙사 창문 밖 나무가 오늘따라 커 보였다 나도 그만큼 자랐으면 좋겠다',
  '말하지 못한 것들이 오래 남는다 그래서 여기에 적어 둔다 누군가 읽어 주기를'];
const SHAPES = ['가운데', '아치', '미소'];
let total = 0, bad = 0, cells = 0, hatched = 0;
const errs = [];
for (const text of TEXTS) {
  const { page, close } = await D.open({ size: 'phone', scale: 2, quiet: true });
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await D.toColor(page, text, '다정한');
  for (const sh of SHAPES) {
    await page.getByText(sh, { exact: true }).first().click();
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const cv = document.querySelector('.cloud-bubble .cloud-hatch canvas');
      if (!cv || !cv.width) return null;
      const cr = cv.getBoundingClientRect(), sx = cv.width / cr.width, sy = cv.height / cr.height;
      const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const dark = (i) => data[i + 3] > 200 && data[i] + data[i + 1] + data[i + 2] < 150;
      let all = 0;
      for (let i = 0; i < data.length; i += 4) if (dark(i)) all++;
      const bub = cv.closest('.cloud-bubble'), walker = document.createTreeWalker(bub, NodeFilter.SHOW_TEXT);
      let cut = 0, seen = 0, n;
      while ((n = walker.nextNode())) {
        if (!n.textContent.trim() || n.parentElement.closest('.cloud-hatch')) continue;
        const range = document.createRange(), T = n.textContent;
        for (let i = 0; i < T.length; i++) {
          if (!T[i].trim()) continue;
          range.setStart(n, i); range.setEnd(n, i + 1);
          for (const q of range.getClientRects()) {
            const x0 = Math.max(0, Math.floor((q.left - cr.left) * sx)), x1 = Math.min(cv.width, Math.ceil((q.right - cr.left) * sx));
            const y0 = Math.max(0, Math.floor((q.top - cr.top) * sy)), y1 = Math.min(cv.height, Math.ceil((q.bottom - cr.top) * sy));
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { seen++; if (dark((y * cv.width + x) * 4)) cut++; }
          }
        }
      }
      return { cut, seen, all };
    });
    cells++;
    if (!r) { console.log(text.slice(0, 10), sh, '그림판 없음'); continue; }
    total += r.seen; bad += r.cut; if (r.all) hatched++;
    if (r.cut) console.log('  덮임', text.slice(0, 10), sh, r.cut, '/', r.seen);
  }
  await close();
}
console.log(`글 ${TEXTS.length} × 모양 ${SHAPES.length}: 빗금이 있는 구름 ${hatched}/${cells} · 글자 네모 화소 ${total} 중 빗금 ${bad}`, '| 오류', errs.length ? errs.slice(0, 3) : '없음');
