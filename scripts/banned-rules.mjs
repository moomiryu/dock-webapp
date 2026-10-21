// 쓸 수 없는 표현 — src/lib/banned.ts의 목록을 firestore.rules에 옮겨 쓴다.
//
//   node scripts/banned-rules.mjs
//
// 폰(hasBannedWord)과 규칙(noBanned)이 **같은 목록 · 같은 순서**로 보게 하는 것이
// 이 스크립트의 일이다. 손으로 옮기면 둘 중 하나가 반드시 낡는다.
//
// 쓰기 전에 시험 문장을 돌린다 — 폰 판정과, 규칙과 똑같이 짠 판정(아래 rulesLike)
// 둘 다. 하나라도 틀리면 규칙 파일을 건드리지 않고 멈춘다.
//
// 규칙 파일을 고친 것만으로는 운영에 아무것도 걸리지 않는다. Firebase 콘솔
// 규칙 페이지에 붙여 넣고, 플레이그라운드로 멀쩡한 글 · 걸릴 글을 한 번씩
// 보내 본 뒤 게시한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { WORDS, SPACED, EXCEPTIONS, hasBannedWord } from '../src/lib/banned.ts';

const RULES = new URL('../firestore.rules', import.meta.url);
const BEGIN = '    // ── 쓸 수 없는 표현';
const END = '    // ── 쓸 수 없는 표현 끝 ──';

// 규칙은 NFC로 모으지 못한다. 낱자모(첫가끝 · 옛한글 확장)로 풀어 쓴 글은 통째로 거절한다
const JAMO = '[^ᄀ-ᇿꥠ-꥿ힰ-퟿]*';
const KEEP = '[^가-힣ㄱ-ㅎㅏ-ㅣa-z]';
const exc = `(${EXCEPTIONS.join('|')})`;
const words = `.*(${WORDS.join('|')}).*`;
const spaced = `.*(${SPACED.join('|')}).*`;

/** 규칙의 noBanned를 그대로 옮긴 것 — matches는 전체 일치, replace는 전부 바꾼다 */
const full = (s, re) => new RegExp(`^(?:${re})$`).test(s);
const all = (s, re, to) => s.replace(new RegExp(re, 'g'), to);
const rulesLike = (t) => {
  const low = t.toLowerCase();
  return full(t, JAMO)
    && !full(all(all(low, KEEP, ''), exc, ''), words)
    && !full(all(all(low, KEEP + '+', ' '), exc, ''), spaced);
};

// ── 시험 문장 ─────────────────────────────────────────────────────────
// 통과해야 하는 것: 1/5 힌트 예시, 차별 · 폭력에 반대하는 말, 띄어쓰기를 지우면
// 금지어가 생기는 함정. 2026-10-19에 디자이너와 고른 기준이 여기 박혀 있다.
const PASS = [
  '○○○ 교수님, 이번 학기 진짜 감사했어요.', '이번 축제에 실리카겔 오면 좋겠어요… 21년을 잊지 못해 (´╥ω╥`)',
  '인생은 패배할 가능성으로 가득 차 있다.\n그것이 삶의 묘미이다.', '원피스 앵무새설 소름이네ㄷㄷ',
  '장애인 이동권 보장하라', '성폭력 피해자와 연대합니다', '불법 촬영 범죄 반대', '스스로 생을 마감하는 일이 없도록',
  '일본군 성노예 피해자를 기억해요', '이완용은 매국노다', '남을 깔보지 마세요', '차별을 없애자',
  '의자 위에 앉아', '의자 살까 말까', '한강 간다 오늘', '반드시 바꾼다', '예시 발화 보기', '다시 바꿀게요',
  '시발점이 어디야', '시바견 귀여워', '새끼 고양이 키우고 싶다', '새까만 밤하늘', '같은 색끼리 모아', '5개년 계획',
  '하루 세끼 꼬박 챙겨 먹자', '게놈 분석 수업', '애널리스트가 꿈', '허리띠를 졸라매자', '벙어리장갑 끼고 왔어',
  '2018년의 나에게', '18세 이하 출입 금지래요', 'I wish it would rain', '오늘 도서관 24시간 열어주세요',
  '줴', '제제', '쥐쥐', '줴다',   // 10-21 '줴줴'는 두 번 쓸 때만
];
// 걸려야 하는 것: 변형 · 띄어 쓰기 · 갈래마다 하나 이상
const BLOCK = [
  '시발', '씨~발', '시.발', '시1발', 'ㅅㅂ', '개 새 끼', '병신', '지랄하네', '좆같네', '존나 싫어', '꺼져', 'tlqkf',
  '미친놈', '느금마', '김치녀', '한남충', '짱깨', '틀딱', '맘충', '좌좀', '수꼴', '문재앙', '전라디언', '애자',
  '자살하고 싶다', '강간', '몰카', '장애자', 'fuck you', 'f u c k', 'shit', '섹스',
  '줴줴', '줴줴이야', '줴 줴', '줴.줴', '줴이줴이', 'ㅈㅞㅈㅞ',
];
// 규칙만 걸러 내는 것 — 폰은 NFC로 모아 보내므로 이런 글이 오지 않는다
const JAMO_ONLY = ['시발'];

const bad = [];
for (const t of PASS) {
  if (hasBannedWord(t)) bad.push(`폰이 막음: ${t}`);
  if (!rulesLike(t)) bad.push(`규칙이 막음: ${t}`);
}
for (const t of BLOCK) {
  if (!hasBannedWord(t)) bad.push(`폰이 놓침: ${t}`);
  if (rulesLike(t)) bad.push(`규칙이 놓침: ${t}`);
}
for (const t of JAMO_ONLY) if (rulesLike(t)) bad.push(`규칙이 낱자모를 놓침: ${JSON.stringify(t)}`);
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }

// ── 규칙 파일에 쓰기 ──────────────────────────────────────────────────
const block = `${BEGIN} — scripts/banned-rules.mjs가 src/lib/banned.ts에서 옮겨 쓴다. 손으로 고치지 않는다 ──
    // 붙여 보기(한글 · 영문 밖을 다 지움)와 띄어 보기(기호를 띄어쓰기로)를 하고,
    // 둘 다 멀쩡한 말(예외)을 먼저 지운다. 까닭은 banned.ts 머리말.
    function noBanned(t) {
      let low = t.lower();
      let exc = '${exc}';
      return t.matches('${JAMO}')
        && !low.replace('${KEEP}', '').replace(exc, '').matches('${words}')
        && !low.replace('${KEEP}+', ' ').replace(exc, '').matches('${spaced}');
    }
${END}`;

const src = readFileSync(RULES, 'utf8');
const a = src.indexOf(BEGIN), b = src.indexOf(END);
if (a < 0 || b < 0) { console.error('firestore.rules에 표시 줄이 없다:', BEGIN.trim()); process.exit(1); }
// 윈도에서 꺼내면 CRLF다 — 파일이 쓰던 줄바꿈을 따른다
writeFileSync(RULES, src.slice(0, a) + block.replace(/\n/g, src.includes('\r\n') ? '\r\n' : '\n') + src.slice(b + END.length));
console.log(`시험 ${PASS.length + BLOCK.length + JAMO_ONLY.length}개 통과 · 규칙에 썼다 — 막는 말 ${WORDS.length} · 띄어 보는 말 ${SPACED.length} · 예외 ${EXCEPTIONS.length}`);
console.log(`정규식 크기: 막는 말 ${Buffer.byteLength(words)}B · 예외 ${Buffer.byteLength(exc)}B (규칙 하나 1만 B 안쪽이 안전선)`);
