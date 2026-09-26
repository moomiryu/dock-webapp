import type { Pair } from './lang';

export interface Palette {
  bg: string;
  text: string;
  graphic: string;
}

export const palettes: Palette[] = [
  { bg: '#FCE7F3', text: '#FF1493', graphic: '#8B9A1B' },
  { bg: '#1A1A2E', text: '#F39C12', graphic: '#E74C3C' },
  { bg: '#F5F5DC', text: '#0B3D3B', graphic: '#FF6347' },
  { bg: '#0A0A0A', text: '#FFD93D', graphic: '#00CED1' },
  { bg: '#FFF0F5', text: '#8B008B', graphic: '#FF6B9D' },
  { bg: '#E8F8F5', text: '#0E6251', graphic: '#7D6608' },
  { bg: '#2C3E50', text: '#ECF0F1', graphic: '#E67E22' },
  { bg: '#F8F4E3', text: '#264653', graphic: '#E76F51' },
  { bg: '#1F1F1F', text: '#FF6EC7', graphic: '#7FDBDA' },
  { bg: '#FFFAE3', text: '#D9381E', graphic: '#1B4965' }
];

// 자형 4종 → 실제 서체. 키는 Firestore 호환을 위해 옛 이름 그대로 둔다.
//
// 2026-09-20: **네 칸의 서체가 전부 갈렸다.** 함께 '발랄한'이 '유머있는'이
// 되었다(tone.ts). 키는 안 바꾼다 — 사흘치 글이 벽에 떠 있는 동안 키를
// 바꾸면 그 글들이 서체를 잃는다.
//
//   ttoryeot 당당한   → dunkel-sans-variable          (Adobe 킷 qgd6cda)
//   chabun   차분한   → source-han-serif-kr-variable  (Adobe 킷 qgd6cda)
//   doran    다정한   → 마포 다카포                    (우리 파일)
//   deulseok 유머있는 → Handjet 2.004                  (우리 파일)
//
// 네 서체가 가진 축은 제각각이다 (파일의 fvar를 직접 읽어 확인했다):
//   당당한   wdth 700~1000 · GLAT 0~1000   ← 무게 축이 없다
//   차분한   wght 250~900                  ← 그것뿐
//   유머있는 wght 100~900 · ELSH 0~16 · ELGR 1~2
//   다정한   없음                          ← 굵기 한 벌
// 지금 조율 화면은 넷에게 같은 세 축(크기·빠르기·무게)을 묻는다. 안내서가
// 정한 성격별 축으로 가는 일은 다음 묶음이다.
//
// 폴백 차례에 뜻이 있다. 킷은 **도메인 잠금**이 걸려 있어서 새 도메인에
// 올리면 당당한·차분한 둘이 한꺼번에 사라질 수 있다. 차분한은 본명조가
// 받아 주고(index.html의 CDN), 당당한은 UI 얼굴로 떨어진다.
export const fontMap: Record<string, string> = {
  ttoryeot: '"dunkel-sans-variable", "Pretendard Variable", sans-serif',
  chabun: '"source-han-serif-kr-variable", "Noto Serif KR Variable", serif',
  doran: '"Mapo Dacapo", "Pretendard Variable", sans-serif',
  deulseok: '"Handjet", "Pretendard Variable", sans-serif',
  // 옛 Firestore 문서가 아직 벽에 있다. 없어진 서체를 가리키게 두면 그 글만
  // UI 얼굴로 떨어지므로, 제일 가까운 새 칸으로 보낸다.
  botong: '"Pretendard Variable", sans-serif',
  gothic: '"dunkel-sans-variable", "Pretendard Variable", sans-serif',
  mono: '"Pretendard Variable", sans-serif',
  myeongjo: '"source-han-serif-kr-variable", "Noto Serif KR Variable", serif',
  song: '"Handjet", "Pretendard Variable", sans-serif'
};

/**
 * 광학 보정 — 같은 font-size에서도 서체마다 크기가 다르게 보인다.
 * 네 칸을 나란히 놓는 02에서도, 한 칸을 크게 보여 주는 03·04·05에서도
 * 그 차이는 서체의 성격이 아니라 **잘못 조판한 것**으로 읽힌다.
 *
 * 값의 출처는 작가의 '타입 안내'(2026-09-20)다. 거기 적힌 시각보정 크기가
 *     당당한 30 · 차분한 22 · 다정한 23 · 유머있는 28
 * 이다. 당당한의 30에는 **세로 75% 눌림이 함께 걸려 있어서** 실제로 보이는
 * 높이는 22.5다. 그 눌림은 우리 화면에서 빠르기 축이 들고 있으므로, 크기
 * 표에는 눌림을 뺀 22.5를 넣는다. 그래서 네 값은 22.5 · 22 · 23 · 28이고,
 * 평균(23.875)으로 나눈 것이 아래 scale이다.
 *
 * 재서도 확인했다. 표본 34자를 글자마다 찍어 잉크 높이를 평균 내면
 *   당당한 0.909 · 차분한 0.911 · 다정한 0.985 · 유머있는 0.669
 * 이라, **당당한과 차분한이 같다는 것**과 **유머있는이 훨씬 작다는 것**은
 * 잰 값과 안내서가 같은 말을 한다(안내서 1.27배, 실측 1.36배).
 * 다정한만 갈린다 — 잰 값은 '작게'(0.925)라는데 안내서는 '크게'(1.045)다.
 * 마포 다카포는 획이 길게 뻗어 잉크는 높은데 몸통은 작아 보이는 얼굴이라,
 * 자로 재면 크고 눈으로 보면 작다. **눈 쪽을 따른다.**
 *
 * shift — 잉크의 한가운데가 줄 상자 한가운데에서 벗어난 만큼. 이건 안내서에
 * 없는 값이라 잰 것을 쓴다(표본 34자, 100px 기준, 아래로 +). 글자 크기를
 * 따라가야 하므로 em으로 적는다.
 *
 * 여기 없는 키는 보정하지 않는다.
 */
/* 2026-09-25: scale을 사용자가 정한 **크기감 비율**로 바꿨다 — 둥켈을 1로
   두고 핸드젯 0.93 · 본명조 0.73 · 다카포 0.77. 위 설명의 22.5·22·23·28과
   평균 나누기는 그 전 값(0.942 · 0.921 · 0.963 · 1.173)의 내력이다. 2/5 이름,
   3/5 견본, 4/5, 벽이 모두 이 값을 곱한다. shift는 그대로다. */
export const opticalFix: Record<string, { scale?: number; shift?: number }> = {
  ttoryeot: { scale: 1, shift: 0.0172 },       // 당당한   둥켈산스
  chabun: { scale: 0.73, shift: 0.0227 },      // 차분한   본명조
  doran: { scale: 0.77, shift: -0.0187 },      // 다정한   다카포
  deulseok: { scale: 0.93, shift: -0.0211 }    // 유머있는 핸드젯
};
/**
 * 획 보정 — 무게 축이 없는 서체에 획을 덧대 대신 답하게 한다.
 *
 * 2026-09-20에 이 표의 임자가 바뀌었다. 옛 '발랄한'(OG 르네상스 비밀)이
 * 나가고 **당당한과 다정한 둘**이 들어왔다. 파일의 fvar를 직접 읽어 보면:
 *
 *   당당한   Dunkelsans        wdth · GLAT 뿐    ← 무게 축이 없다
 *   차분한   Source Han Serif  wght 250~900
 *   다정한   마포 다카포        축이 아예 없다
 *   유머있는 Handjet           wght 100~900
 *
 * 유머있는은 이제 제 축으로 움직이므로 이 표에서 뺐다.
 *
 * 브라우저의 합성 굵기는 껐다(global.css의 font-synthesis-weight). 켜 두면
 * 600·700에서만 갑자기 뛰어서 다섯 칸이 '셋+둘'로 갈라지고, 무엇보다
 * **당당한의 속공간이 통째로 메워졌다** — 원래 잉크가 0.736으로 이미 꽉 찬
 * 얼굴이라 거기에 가짜 굵기를 얹으면 검은 덩어리가 된다.
 *
 * 값은 한 장에 나란히 놓고 골랐다(tuning-grid, 46px, '발화'):
 *   다정한  0 · 0.02 · 0.04 · 0.06 · 0.08em을 놓고 보니 **0.08에서 ㅂ의
 *           속공간이 닫힌다.** 0.06을 꼭대기로 두고 고르게 나눈다.
 *   당당한  0 · 0.008 · 0.016 · 0.024 · 0.032em. **0.016부터 이미 덩어리가
 *           된다.** 0.008이 마지막으로 골격이 버티는 자리다.
 *
 * 당당한의 사다리가 이렇게 짧은 것은 보정이 모자라서가 아니라 **이 서체에
 * 무게 축이 없어야 맞기 때문**이다. 안내서도 당당한에는 무게 대신
 * 말투(GLAT)를 두었다. 성격별 축으로 가는 일이 끝나면 이 줄은 없어진다.
 */
const STROKE_LADDER: Record<string, Record<number, number>> = {
  doran: { 300: 0, 400: 0.015, 500: 0.03, 600: 0.045, 700: 0.06 },
  ttoryeot: { 300: 0, 400: 0.002, 500: 0.004, 600: 0.006, 700: 0.008 }
};

/**
 * 그 서체를 그 무게로 찍을 때 덧댈 획. 보정이 없는 서체는 '0'이라
 * -webkit-text-stroke가 아무 일도 하지 않는다.
 *
 * 저장된 무게가 눈금에 정확히 없을 수 있다(옛 메시지) — 제일 가까운 칸으로 읽는다.
 */
export function opticalStroke(font: string, wght: number): string {
  const ladder = STROKE_LADDER[font];
  if (!ladder) return '0';
  const stops = Object.keys(ladder).map(Number);
  const at = stops.reduce((best, s) => (Math.abs(s - wght) < Math.abs(best - wght) ? s : best), stops[0]);
  return ladder[at] + 'em';
}

export const graphics: string[] = [
  // sphere with rotating grid
  '<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice"><g style="animation:mfRot 14s linear infinite;transform-origin:190px 130px"><ellipse cx="190" cy="130" rx="170" ry="115" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="7,5"/><ellipse cx="190" cy="130" rx="130" ry="115" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="7,5"/><ellipse cx="190" cy="130" rx="70" ry="115" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="7,5"/><ellipse cx="190" cy="130" rx="170" ry="75" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="7,5"/><ellipse cx="190" cy="130" rx="170" ry="35" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="7,5"/></g></svg>',
  // pulsing polka dots
  '<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice"><defs><pattern id="dp" x="0" y="0" width="55" height="55" patternUnits="userSpaceOnUse"><circle cx="27" cy="27" r="17" fill="currentColor" style="animation:mfPulse 3.2s ease-in-out infinite"/></pattern></defs><rect width="380" height="260" fill="url(#dp)"/></svg>',
  // scrolling grid
  '<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice"><g stroke="currentColor" stroke-width="1.8" fill="none" stroke-dasharray="5,5">' +
    Array.from({ length: 11 }, (_, i) => `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="260" style="animation:mfDash ${(3.5 + i * 0.18).toFixed(2)}s linear infinite"/>`).join('') +
    Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${i * 40}" x2="380" y2="${i * 40}"/>`).join('') +
    '</g></svg>',
  // concentric expansion
  '<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice">' +
    [25, 55, 85, 115, 145, 175]
      .map((r, i) => `<circle cx="190" cy="130" r="${r}" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:mfExp 4.5s ease-in-out ${(i * 0.45).toFixed(2)}s infinite;transform-origin:190px 130px"/>`)
      .join('') +
    '</svg>',
  // sliding waves
  '<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="currentColor" stroke-width="2.5">' +
    [40, 80, 120, 160, 200, 240]
      .map((y, i) => `<path d="M -50 ${y} Q 45 ${y - 22},140 ${y} T 330 ${y} T 520 ${y}" style="animation:mfSlide ${(6 + i * 0.4).toFixed(2)}s linear infinite"/>`)
      .join('') +
    '</g></svg>'
];

/**
 * 서체마다 가진 축이 다르다 — 그래서 **묻는 것도 달라야 한다.**
 *
 * 2026-09-20까지는 넷에게 똑같이 크기·빠르기·무게 셋을 물었다. 그런데
 * 당당한(둥켈)과 다정한(다카포)은 무게 축이 아예 없다. 없는 축의 손잡이를
 * 밀면 아무 일도 안 일어나는데, 손잡이는 움직인다 — **거짓말하는 조작**이다.
 *
 * 작가의 '타입 안내'(2026-09-20)가 그 자리를 다시 짰다. 무게가 없는 얼굴
 * 둘에게는 무게 대신 **말투**를 묻는다. 굵기가 아니라 글자의 생김새 자체를
 * 바꾸는 축이 그 둘에는 있다:
 *
 *   당당한   GLAT 0 ↔ 1000    예리한 ↔ 온화한
 *            둥켈의 Glatt 축이다. 모서리가 날카롭게 서 있다가 둥글게 눕는다.
 *   유머있는 ELSH 0.8 ↔ 12    시니컬한 ↔ 귀여운
 *            ELGR 1 ↔ 1.75    핸드젯은 점으로 글자를 짜는 얼굴이라, 점의
 *            모양(ELement SHape)과 격자(ELement GRid)가 말투를 만든다.
 *
 * 값이 둘뿐이라 손잡이가 아니라 **버튼 둘**이다. 안내서도 그렇게 그려 놨다.
 *
 * 차분한(본명조)은 wght 250~900을 제대로 갖고 있으므로 무게를 그대로 묻는다.
 * 다정한(다카포)은 축이 없어 획(-webkit-text-stroke)으로 대신 답한다 —
 * 그건 opticalStroke가 이미 하고 있다.
 */
/* 이름은 두 언어로 든다(2026-09-26, 영문판). 쓰는 곳이 지금 언어를 고른다 */
export const MANNER: Record<string, { labels: Pair<[string, string]>; axes: [string, string] }> = {
  // 차례는 안내서가 적어 둔 차례다 — 온화한이 먼저, 예리한이 나중.
  ttoryeot: { labels: { ko: ['온화한', '예리한'], en: ['Gentle', 'Sharp'] }, axes: ['"GLAT" 1000', '"GLAT" 0'] },
  deulseok: {
    // 시니컬한의 ELSH는 **8.8**이다. 0.8로 적혀 있었다(2026-09-20에 안내서와
    // 대조해 고쳤다) — 0.8이면 획이 거의 사라져 글자가 점선으로 흩어진다.
    labels: { ko: ['귀여운', '시니컬한'], en: ['Cute', 'Cynical'] },
    axes: ['"ELSH" 12, "ELGR" 1.75', '"ELSH" 0.8, "ELGR" 1']   // 시니컬한 ELSH 8.8 → 0.8 (2026-09-25 표)
  }
};

/** 이 서체가 무게 축을 실제로 갖고 있는가 — 없으면 말투를 묻는다 */
export const hasWeightAxis = (font: string) => !(font in MANNER);

/**
 * 이 서체에 넘길 font-variation-settings 한 줄.
 *
 * 한곳에서만 만든다. 전에는 화면마다 `'"wght" ' + weight`를 따로 적고
 * 있었는데, 그러면 축이 서체마다 다르다는 사실이 네 군데에 흩어진다.
 */
export function variationFor(font: string, wght: number, manner = 0): string {
  const m = MANNER[font];
  if (m) return m.axes[manner ? 1 : 0];
  return `"wght" ${wght}`;
}


/* ─── 목소리의 모양 — 서체별 표 (2026-09-25) ──────────────────────────────
   3/5의 막대 셋(크기 · 속도 · 무게/말투)이 정한 자리에서 글자의 모양을
   계산한다. **표는 여기 하나다** — 3/5 견본, 4/5, 미리보기, 벽이 모두 이
   함수를 거친다. 값은 사용자가 정했다(작업 지침 8번).

     성격 · 서체              속도 왼쪽            가운데              오른쪽
     당당한 · 둥켈산스        진중한 폭1000 세로75% 보통 폭700 세로75%  거침없는 폭700 세로100%
     유머있는 · 핸드젯(840)   능청능청 가로121%     보통                 재잘재잘 가로88%
                              세로75%
     차분한 · 본명조(자간-25) 느긋한 세로86%       보통                 날렵한 가로88%
     다정한 · 다카포          느긋한 가로138%      보통                 날렵한 가로84%

     무게  차분한 wght 250 · 445 · 900   다정한 획 0 · 0.1pt · 0.2pt(12pt 기준)
     말투  당당한 GLAT 1000 · 0          유머있는 ELSH 12/ELGR 1.75 · 0.8/1

   기울기는 속도 가운데에서 0, 오른쪽 끝에서 18도 — 그 사이를 이어서 기운다
   (12~18도로 세기를 조절, 사용자 결정). 모든 값은 세 지점 사이를 곧게 잇는다.
   장평·세로·기울기는 서체의 축이 아니라 브라우저 변형이다(scale · oblique). */
export const SLANT_MAX = 18;
type Three = [number, number, number];
const SPEED: Record<string, { sx: Three; sy: Three; wdth?: Three }> = {
  ttoryeot: { sx: [1, 1, 1], sy: [0.75, 0.75, 1], wdth: [1000, 700, 700] },
  deulseok: { sx: [1.21, 1, 0.88], sy: [0.75, 1, 1] },
  chabun: { sx: [1, 1, 0.88], sy: [0.86, 1, 1] },
  doran: { sx: [1.38, 1, 0.84], sy: [1, 1, 1] }
};
const CHABUN_WGHT: Three = [250, 445, 900];
/** 다카포 획 덧대기 — 12pt에서 0 · 0.1 · 0.2pt, 글자 크기에 비례하므로 em으로 */
const DORAN_STROKE: Three = [0, 0.1 / 12, 0.2 / 12];
/** 핸드젯은 두께 840에 고정 */
const HANDJET_WGHT = 840;
/** 차분한은 늘 자간 -25 */
const CHABUN_TRACK = '-0.025em';

/** 세 지점(0 · 0.5 · 1) 사이를 곧게 잇는다 */
export const along = (t: number, [l, m, r]: Three) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? l + (m - l) * (x / 0.5) : m + (r - m) * ((x - 0.5) / 0.5);
};
/** 크기 막대 — 옛 척도 28..60을 그대로 쓴다(가운데 44 = 보통) */
export const SIZE_RANGE: Three = [28, 44, 60];
export const sizeAt = (t: number) => along(t, SIZE_RANGE);
export const sizePos = (size: number) => Math.min(1, Math.max(0, (size - 28) / 32));

/**
 * 막대마다 다섯 칸의 말(2026-09-25, 작업 지침 13번). 막대는 다섯 칸이고
 * 손을 떼면 가장 가까운 칸에 붙는다. 칸의 값은 세 지점 표를 0 · ¼ · ½ · ¾ · 1
 * 자리에서 읽은 것이다 — 사이 칸은 이웃한 두 값의 딱 중간이 된다.
 */
type Five = [string, string, string, string, string];
export const STOPS = 5;
/* 칸 말은 두 언어로 든다(2026-09-26, 영문판 — 영어 말은 사용자가 정했다).
   쓰는 곳(PhaseTone)이 pick으로 지금 언어를 고른다. */
export const SIZE_WORDS: Pair<Five> = {
  ko: ['매우 작게', '작게', '보통', '크게', '매우 크게'],
  en: ['Very small', 'Small', 'Regular', 'Large', 'Very large']
};
export const WEIGHT_WORDS: Pair<Five> = {
  ko: ['매우 가볍게', '가볍게', '보통', '무겁게', '매우 무겁게'],
  en: ['Very light', 'Light', 'Regular', 'Heavy', 'Very heavy']
};
const LEISURE: Pair<Five> = {
  ko: ['매우 느긋한', '느긋한', '보통', '날렵한', '매우 날렵한'],
  en: ['Very leisurely', 'Leisurely', 'Regular', 'Nimble', 'Very nimble']
};
export const SPEED_WORDS: Record<string, Pair<Five>> = {
  ttoryeot: {
    ko: ['매우 진중한', '진중한', '보통', '거침없는', '매우 거침없는'],
    en: ['Very deliberate', 'Deliberate', 'Regular', 'Unstoppable', 'Very unstoppable']
  },
  deulseok: {
    ko: ['한껏 능청능청', '능청능청', '보통', '재잘재잘', '한껏 재잘재잘'],
    en: ['Extra deadpan', 'Deadpan', 'Regular', 'Chatty', 'Extra chatty']
  },
  chabun: LEISURE,
  doran: LEISURE
};
/** 막대 자리에서 가장 가까운 칸(0~4) */
export const stopAt = (t: number) => Math.round(Math.min(1, Math.max(0, t)) * (STOPS - 1));
/** 가장 가까운 칸의 자리(0 · .25 · .5 · .75 · 1) */
export const snap = (t: number) => stopAt(t) / (STOPS - 1);
export const wordAt = (t: number, words: Five) => words[stopAt(t)];

export interface Form {
  scaleX: number;
  scaleY: number;
  /** 도(°), 양수 */
  slant: number;
  variation: string;
  /** 획 덧대기(em 문자열) */
  stroke: string;
  letterSpacing: string;
  weight: number;
  /** 둥켈산스의 폭 축(700~1000). 구름이 글자폭을 셀 때 쓴다. 다른 서체는 없음 */
  wdth?: number;
}

type FormInput = { font: string; tone?: number; slnt?: number; wght?: number; manner?: number; speed?: number; weight?: number };

/**
 * 한 글의 모양. speed가 있으면 새 표로, 없으면(옛 글) 옛 칸 그대로 그린다.
 */
export function formFor(t: FormInput): Form {
  const font = t.font;
  const track = font === 'chabun' ? CHABUN_TRACK : '0';
  if (t.speed === undefined || t.speed === null || !SPEED[font]) {
    const wght = t.wght ?? 400;
    return {
      scaleX: t.tone ?? 1, scaleY: 1, slant: Math.abs(t.slnt ?? 0),
      variation: variationFor(font, wght, t.manner ?? 0),
      stroke: opticalStroke(font, wght), letterSpacing: track, weight: wght
    };
  }
  const s = t.speed;
  const w = t.weight ?? 0.5;
  const row = SPEED[font];
  const slant = s <= 0.5 ? 0 : ((s - 0.5) / 0.5) * SLANT_MAX;
  let variation = '';
  let stroke = '0';
  let weight = 400;
  let wdth: number | undefined;
  if (font === 'ttoryeot') {
    wdth = Math.round(along(s, row.wdth!));
    variation = `"wdth" ${wdth}, ${MANNER.ttoryeot.axes[t.manner ? 1 : 0]}`;
  } else if (font === 'deulseok') {
    weight = HANDJET_WGHT;
    variation = `"wght" ${HANDJET_WGHT}, ${MANNER.deulseok.axes[t.manner ? 1 : 0]}`;
  } else if (font === 'chabun') {
    weight = Math.round(along(w, CHABUN_WGHT));
    variation = `"wght" ${weight}`;
  } else if (font === 'doran') {
    stroke = along(w, DORAN_STROKE).toFixed(4) + 'em';
  }
  return {
    scaleX: along(s, row.sx), scaleY: along(s, row.sy), slant,
    variation, stroke, letterSpacing: track, weight, wdth
  };
}

/**
 * 새 표를 모르는 곳을 위한 옛 칸 — 표가 계산한 모양을 옛 칸(tone · slnt · wght)
 * 으로도 적어 둔다. 세로 비율과 둥켈의 폭 축은 옛 칸에 자리가 없어 빠진다.
 */
export function legacyFields(t: FormInput) {
  const f = formFor(t);
  return { tone: +f.scaleX.toFixed(3), slnt: -+f.slant.toFixed(2), wght: f.weight };
}
