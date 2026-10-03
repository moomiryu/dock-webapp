// 앱이 짓는 돌의 크기 — 글 길이 아홉 × 크기 막대 다섯 칸. 벽 1920×1080에서 px(한 변 = 0.372 × 1080). 결과는 stone_widths.json
import { writeFileSync } from 'node:fs';
const D = await import(new URL('../../lib/drive.mjs', import.meta.url).href);
const HATCH = (process.env.HATCH_OUT || (await import('node:path')).join((await import('node:os')).tmpdir(), 'megafont-stone-hatch')) + '/';   // 결과는 임시 폴더
(await import('node:fs')).mkdirSync(HATCH, { recursive: true });
const TEXTS = ['괜찮아', '조용히 오래 생각했다', '여기서 크게 말해본 적 없다', '시험 끝나면 바다 보러 갈 거야', '오늘은 아무 말도 하고 싶지 않았다',
  '사흘 뒤면 사라질 말이라서 더 솔직하게 쓸 수 있었다', '말하지 못한 것들이 오래 남는다 그래서 여기에 적어 둔다',
  '기숙사 창문 밖 나무가 오늘따라 커 보였다 나도 그만큼 자랐으면 좋겠다',
  '아무에게도 하지 못한 말을 여기 적는다 내일이면 조금 가벼워질까 싶어서 천천히 한 자씩 쓴다'];
const SIZES = [28, 36, 44, 52, 60];
const { page, close } = await D.open({ size: { width: 1920, height: 1080 }, quiet: true });
await page.goto(`${page.__base}/?mock=1`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const out = await page.evaluate(async ({ TEXTS, SIZES }) => {
  const C = await import('/src/lib/cloud.ts'), F = await import('/src/lib/fit.ts');
  const side = 0.372 * 1080, rows = [];
  for (const text of TEXTS) for (const size of SIZES) {
    const tone = { font: 'chabun', tone: 1, wght: 400, slnt: 0, size, paletteIdx: 0, graphicIdx: -1, speed: 0.5, weight: 0.5, align: 'hang-mid' };
    const lines = C.linesFor(text, tone), cloud = C.cloudForTone(lines, tone), box = F.bubbleAt(lines, C.cloudShape(cloud), F.fillFromLegacySize(size));
    rows.push({ text, size, lines, id: cloud.stone?.photo?.id, flip: cloud.stone?.photo?.flip, wpx: box.w * side, hpx: box.h * side, unit: box.unit * side,
      text_box: cloud.text, cw: cloud.w, ch: cloud.h, tx: cloud.stone?.photo ? { lines: cloud.stone.photo.lines, em: cloud.stone.photo.em } : null });
  }
  return rows;
}, { TEXTS, SIZES });
writeFileSync(HATCH + 'stone_widths.json', JSON.stringify(out, null, 1));
for (const s of SIZES) {
  const r = out.filter((x) => x.size === s), ws = r.map((x) => Math.round(x.wpx));
  console.log(`크기 ${s}: 폭 ${Math.min(...ws)}~${Math.max(...ws)}px (가운데 ${ws.sort((a, b) => a - b)[Math.floor(ws.length / 2)]})`);
}
await close();
