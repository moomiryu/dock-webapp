// 앱이 짓는 다정한의 띠 구름 — 글 몇 개 × 크기. 윤곽(꼬리 · 떨어진 조각까지) · 글 상자 · 줄 · 벽 화소(한 변 = 0.372 × 1080)를
// cloud_shapes.json에. 결 견본(c1.py …)이 이것으로 그린다. 개발 서버(npm run dev)가 떠 있어야 한다
import { writeFileSync, mkdirSync } from 'node:fs';
const D = await import(new URL('../../lib/drive.mjs', import.meta.url).href);
const OUT = (process.env.HATCH_OUT || (await import('node:path')).join((await import('node:os')).tmpdir(), 'megafont-cloud-hatch')) + '/';   // 결과는 임시 폴더
mkdirSync(OUT, { recursive: true });
const ROWS = [
  ['괜찮아', 44], ['오늘은 조금 따뜻했다', 44], ['시험 끝나면 바다 보러 갈 거야', 36],
  ['천천히 가도 된다고 말해 주고 싶다', 52], ['기숙사 창문 밖 나무가 오늘따라 커 보였다 나도 그만큼 자랐으면 좋겠다', 36]
];
const { page, close } = await D.open({ size: { width: 1920, height: 1080 }, quiet: true });
await page.goto(`${page.__base}/?mock=1`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const out = await page.evaluate(async (ROWS) => {
  const C = await import('/src/lib/cloud.ts'), F = await import('/src/lib/fit.ts'), P = await import('/src/lib/palettes.ts');
  const side = 0.372 * 1080;
  return ROWS.map(([text, size]) => {
    const tone = { font: 'doran', tone: 1, wght: 400, slnt: 0, size, paletteIdx: 0, graphicIdx: -1, speed: 0.5, weight: 0.5, align: 'center' };
    const lines = C.linesFor(text, tone), cloud = C.cloudForTone(lines, tone), box = F.bubbleAt(lines, C.cloudShape(cloud), F.fillFromLegacySize(size));
    const ph = cloud.photo;
    return { text, size, lines, uPx: box.unit * side, w: cloud.w, h: cloud.h, textBox: cloud.text, optic: P.opticalFix.doran?.scale ?? 1,
      lh: C.PERSONAS.doran.lh, id: ph?.id, pts: ph?.pts, extra: ph?.extra ?? [], x0: ph?.x0, x1: ph?.x1, stroke: P.formFor({ ...tone }).stroke };
  });
}, ROWS);
writeFileSync(OUT + 'cloud_shapes.json', JSON.stringify(out));
for (const r of out) console.log(r.text.slice(0, 12), r.id, '줄', r.lines.length, '구름', Math.round(r.w * r.uPx), '×', Math.round(r.h * r.uPx), 'px · 꼬리까지', Math.round((r.x1 - r.x0) * r.uPx), '· 조각', r.extra.length);
await close();
