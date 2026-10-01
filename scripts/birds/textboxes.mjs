// 작업 폴더(BIRD_WORK 또는 OS 임시 폴더의 megafont-birds)에서 돌린다 — textboxes.json · grid-*.json을 거기서 읽고 쓴다
// 앱 모듈로 글 상자(u)와 지금 기하 새 · 박쥐의 크기(u)를 받는다 — 사진 새에 글을 넣어 볼 기준
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const ROOT = 'C:/dev/megafont-webapp';
const { open } = await import(pathToFileURL(resolve(ROOT, 'scripts/lib/drive.mjs')).href);
const { page, close } = await open({ size: { width: 800, height: 600 }, quiet: true });
await page.goto(`${page.__base}/?mock=1`, { waitUntil: 'load' });
const TEXTS = [
  '안녕',
  '오늘도 수고했어',
  '여기서 크게 말해본 적 없다',
  '배고프다 밥 먹으러 갈 사람 여기 붙어라',
  '내일 시험인데 아직 한 장도 못 봤다 진짜 큰일이다 누가 좀 살려줘',
  '도서관 삼층 창가 자리에 앉으면 오후 네시쯤 햇빛이 책상 위로 길게 들어온다',
  '사흘 뒤면 사라질 말이라서 오히려 편하게 쓸 수 있다 아무도 기억 못 할 테니까 그래도 누군가 읽어 주면 좋겠다',
];
const out = await page.evaluate(async (TEXTS) => {
  const { cloudForTone, PAD } = await import('/src/lib/cloud.ts');
  const { foldLines } = await import('/src/lib/fit.ts');
  return TEXTS.map((t) => {
    const lines = foldLines(t);
    const r = { text: t, lines };
    for (const manner of [0, 1]) {
      const c = cloudForTone(lines, { font: 'deulseok', speed: 0.5, weight: 0.5, manner });
      r[manner ? 'bat' : 'bird'] = { tw: c.text.w, th: c.text.h, w: c.w, h: c.h };
    }
    r.PAD = PAD;
    return r;
  });
}, TEXTS);
writeFileSync('textboxes.json', JSON.stringify(out, null, 1));
for (const r of out) console.log(r.lines.length, '줄', r.text.length, '자', 'tw', r.bird.tw.toFixed(2), 'th', r.bird.th.toFixed(2), '| 기하 새', r.bird.w.toFixed(1), 'x', r.bird.h.toFixed(1), '| 박쥐', r.bat.w.toFixed(1), 'x', r.bat.h.toFixed(1));
await close();
