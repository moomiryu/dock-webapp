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
//   ttoryeot 당당한   → dunkel-sans-variable          (Adobe 킷 qgd6cda — 2026-10-06 되돌림)
//   chabun   차분한   → source-han-serif-kr-variable  (Adobe 킷 qgd6cda)
//   doran    다정한   → 마포 다카포                    (우리 파일)
//   deulseok 유머있는 → Handjet 2.004                  (우리 파일)
//
// 2026-10-01: 당당한이 둥켈산스에서 **산돌 아침 Medium**으로 갈렸다(디자이너).
// 둥켈은 면 채움이 0.60이라 벽에서 다른 셋(0.10~0.18)을 덮었다. 아침 Medium은
// 0.23 — 당당함은 남고 덮지는 않는다. 킷에는 300 · 500 · 700이 다 있다.
// 2026-10-04: 다시 **이사만루 Medium**으로 갈렸다(디자이너 — SM견출고딕의 '꽉 찬 네모꼴과 각'.
// 견출은 웹 사용권을 얻을 길이 없어, 웹 사용권과 한글 11172자를 다 갖춘 후보 다섯 가운데서 골랐다).
// 농도 0.42(아침 0.23 · 둥켈 0.60), 네모 채움 0.91(아침 0.88).
// 2026-10-04 같은 날 **Kim jung chul Gothic**으로 다시 갈렸다(디자이너 — Adobe 킷에 더해 두었다).
// Light · Regular · Bold 세 벌. 농도 0.17 · 0.23 · 0.37, 네모 채움 0.87~0.92(이사만루 0.90~0.93) —
// 꽉 찬 네모꼴은 그대로, 이사만루보다 한결 가볍다. Bold는 디자이너가 '너무 굵다'고 해 쓰지 않았다.
// 2026-10-06: **둥켈산스로 되돌렸다**(디자이너 — 지금 앱에 둥켈만 바꿔 끼운 목업을 보고). 3/5의 셋째 막대도 무게에서
// 말투(온화한 · 예리한 — 둥켈의 GLAT 축)로 돌아왔다. 4/5 모양(기본 · 휘기 · 기울이기)은 그대로.
//
// 네 서체가 가진 축은 제각각이다 (파일의 fvar를 직접 읽어 확인했다):
//   당당한   wdth 700~1000 · GLAT 0~1000  ← 무게 축이 없다(둥켈산스, 10-06 되돌림)
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
   3/5 견본, 4/5, 벽이 모두 이 값을 곱한다. shift는 그대로다.
   2026-10-01: 당당한이 아침 Medium이 되며 다시 쟀다(100px). 한글이 고정폭 0.92em이라
   둥켈(0.678)보다 한 줄이 1.36배 길다. scale 0.8은 한 글자 몫(0.92 × 0.8 = 0.74)을 다른 셋
   (본명조 0.71 · 다카포 0.77 · 핸드젯 0.73)에 맞춘 값이다 — 디자이너가 굵기를 고른 격자도 이 크기였다.
   잉크 높이로 맞추면 1.04가 나와(아침 0.89em, 둥켈 0.93em) 두 잣대가 갈린다. 0.8 · 0.9 · 1.04를
   세로 75% · 100%와 한 장에 놓고 디자이너가 0.8 · 100%로 정했다(같은 날) — 길이와 높이가
   둘 다 다른 셋 안에 드는 칸이 그것 하나였다.
   shift는 같은 방법(잉크의 세로 중심, 아래로 +)으로 쟀다 — 둥켈을 함께 재서 0.0175(표 0.0172)로 방법을 확인했다.
   2026-10-04: 당당한이 이사만루 Medium이 되며 같은 잣대로 다시 쟀다. 0.7~1.0을 다른 셋 옆에 놓으면 글줄 길이와
   글자 높이가 둘 다 다른 셋의 범위(길이 0.96~1.08 · 높이 0.89~1.12) 안에 드는 것은 0.85(길이 1.08 · 높이 0.93)
   — 0.8은 높이가 0.88로 바로 밑이다. shift −0.0382(아침 −0.0042) — 이사만루는 잉크가 줄 가운데보다 위에 선다.
   같은 날 당당한이 김정철 고딕 Regular가 되며 다시 쟀다. 다른 셋의 범위가 길이 0.96~1.09 · 높이 0.86~1.13일 때
   0.8이 길이 1.01 · 높이 1.00(셋의 한가운데), 0.85가 1.07 · 1.06 — 이사만루 0.85(1.08 · 1.07)와 같은 크기라
   0.85를 그대로 둔다. shift −0.0104. 아침 · 둥켈을 같은 방법으로 다시 재 기록과 맞는 것(−0.0037 · 0.018)을
   확인했다 — 이사만루의 −0.0382는 그때 잘못 잰 값이었다(지금 재면 −0.065).
   2026-10-06: 둥켈로 되돌리며 둥켈 시절 값(1 · 0.0172) 그대로 — 디자이너가 그 크기로 본 목업에서 골랐다. 둥켈은 면 채움이
   0.60이라 벽에서 다른 셋보다 크게 읽힌다(10-01에 아침으로 바꾼 까닭) — 알고 되돌렸다.
   같은 날 벽에서만 크게 읽히던 것은 이 값이 아니라 나무 글자 배수(cloud.ts의 tree.text)로 맞췄다 — 이 값을 0.75로 내리면 벽은
   같아지지만 폰 2/5 이름만 넷 중 가장 작아졌다(잉크 18.5px, 다른 셋 25.5 ~ 30). */
export const opticalFix: Record<string, { scale?: number; shift?: number }> = {
  ttoryeot: { scale: 1, shift: 0.0172 },        // 당당한   둥켈산스(10-06 되돌림)
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
 * 말투(GLAT)를 두었다.
 *
 * 2026-10-01: 당당한의 줄을 뺐다 — 서체가 아침 Medium(정적 500)으로 갈렸다.
 * 2026-10-06: 둥켈로 되돌리며 그 줄도 돌아왔다 — 막대가 생기기 전의 옛 글(wght)이 쓴다.
 */
const STROKE_LADDER: Record<string, Record<number, number>> = {
  ttoryeot: { 300: 0, 400: 0.002, 500: 0.004, 600: 0.006, 700: 0.008 },
  doran: { 300: 0, 400: 0.015, 500: 0.03, 600: 0.045, 700: 0.06 }
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
 *
 * 2026-10-01: 당당한이 아침 Medium이 되어 GLAT 축이 없어졌다. 말투는 이제
 * **둥글기와 자간**이 맡는다(디자이너, 격자로 골랐다):
 *   예리한  아침 그대로 · 자간 −0.02em
 *   온화한  바깥 모서리 0.025em · 안쪽 구석 0.02em 둥글게 · 자간 +0.02em
 *          (둥글기는 VoiceBubble의 useSoften — 화면 픽셀 68 아래에서는 끈다)
 * 자간을 양쪽으로 0.02씩만 벌린 것은 어느 쪽도 어색하지 않으면서, 둥글기가
 * 안 보이는 작은 글자에서도 말투가 갈리게 하려는 것이다.
 *
 * 2026-10-04: 당당한의 말투를 뺐다(디자이너 — 이사만루에는 둥켈처럼 자형 자체의
 * 변수가 없다). 당당한은 그동안 **무게**를 물었다(김정철 고딕 Light · Regular · Regular에 획 덧대기).
 * 2026-10-06: 둥켈로 되돌리며 말투(GLAT)도 돌아왔다(디자이너). 값의 뜻(0 = 온화한 · 1 = 예리한)은 둥켈 시절 그대로라
 * 벽에 남은 옛 글의 말투 · 나무가 바뀌지 않는다. 무게로 쓴 글(10-04 ~ 10-06)은 말투가 비어 있어 온화한 자형에 서고,
 * 나무는 그때처럼 무게가 고른다(cloud.ts treeFor).
 */
/* 이름은 두 언어로 든다(2026-09-26, 영문판). 쓰는 곳이 지금 언어를 고른다.
   labels · axes는 **저장되는 값**(manner 0 · 1)의 차례다. 화면에 서는 차례는 order —
   값의 뜻을 바꾸면 벽에 떠 있는 글의 말투와 형상이 뒤집힌다. */
export const MANNER: Record<string, { labels: Pair<[string, string]>; axes?: [string, string]; order?: [number, number] }> = {
  ttoryeot: { labels: { ko: ['온화한', '예리한'], en: ['Gentle', 'Sharp'] }, axes: ['"GLAT" 1000', '"GLAT" 0'] }
};
/**
 * 유머있는(핸드젯)의 옛 말투 자형 — 귀여운 · 시니컬한(저장된 manner 0 · 1의 차례). 2026-10-04 유머있는도 말투를 뺐다(디자이너 —
 * 귀여운 · 시니컬한 둘 대신 '귀여움' 하나, 셋째 막대는 무게). 이제부터는 귀여운 자형 하나에 무게 막대가 굵기를 바꾼다
 * (HANDJET_WEIGHT). 말투가 적힌 옛 글만 이 값으로 그때 모습 그대로 선다 — 쓴 사람이 고른 모양을 벽이 바꾸지 않는다.
 * 시니컬한의 ELSH는 **8.8**이다. 0.8로 적혀 있었다(2026-09-20에 안내서와 대조해 고쳤다) — 0.8이면 획이 거의 사라져
 * 글자가 점선으로 흩어진다(2026-09-25 표의 값을 그대로 둔다)
 */
const HANDJET_AXES = ['"ELSH" 12, "ELGR" 1.75', '"ELSH" 0.8, "ELGR" 1'] as const;

/** 이 서체가 무게 축을 실제로 갖고 있는가 — 없으면 말투를 묻는다 */
export const hasWeightAxis = (font: string) => !(font in MANNER);

/** 말투 칸이 화면에 서는 차례 — 저장되는 값(0 · 1)을 앞 칸부터 */
export const mannerOrder = (font: string): [number, number] => MANNER[font]?.order ?? [0, 1];
/** 처음 들어왔을 때 골라져 있는 말투 — 앞 칸의 값 */
export const mannerDefault = (font: string) => mannerOrder(font)[0];

/**
 * 이 서체에 넘길 font-variation-settings 한 줄.
 *
 * 한곳에서만 만든다. 전에는 화면마다 `'"wght" ' + weight`를 따로 적고
 * 있었는데, 그러면 축이 서체마다 다르다는 사실이 네 군데에 흩어진다.
 */
export function variationFor(font: string, wght: number, manner = 0): string {
  const m = MANNER[font];
  if (m) return m.axes?.[manner ? 1 : 0] ?? 'normal';
  // 유머있는의 옛 글(막대 전) — 그때의 말투 자형 그대로, 굵기는 font-weight가 든다
  if (font === 'deulseok') return HANDJET_AXES[manner ? 1 : 0];
  return `"wght" ${wght}`;
}


/* ─── 목소리의 모양 — 서체별 표 (2026-09-25) ──────────────────────────────
   3/5의 막대 셋(크기 · 속도 · 무게/말투)이 정한 자리에서 글자의 모양을
   계산한다. **표는 여기 하나다** — 3/5 견본, 4/5, 미리보기, 벽이 모두 이
   함수를 거친다. 값은 사용자가 정했다(작업 지침 8번).

     성격 · 서체              속도 왼쪽            가운데              오른쪽
     당당한 · 둥켈산스        진중한 폭 1000       보통 폭 700          거침없는 폭 700
                              세로75%              세로75%
     유머있는 · 핸드젯(840)   능청능청 가로121%     보통                 재잘재잘 가로88%
                              세로75%
     차분한 · 본명조(자간-25) 느긋한 세로86%       보통                 날렵한 가로88%
     다정한 · 다카포          느긋한 가로138%      보통                 날렵한 가로84%

     무게  차분한 wght 500 · 620 · 900 + 끝에서 획 0.0093em('1000쯤', 2026-10-04 — 그전 250 · 445 · 900)
           다정한 획 0.36 · 0.46 · 0.56pt(12pt 기준, 2026-10-04 — 그전 0 · 0.1 · 0.2pt)
     말투  당당한 온화한 GLAT 1000 · 예리한 GLAT 0(둥켈산스, 2026-10-06 되돌림)
           유머있는 ELSH 12/ELGR 1.75 · 0.8/1

   당당한의 진중한은 둥켈의 폭 축(1000)으로 넓어졌었다. 아침에는 폭 축이 없어
   2026-10-01부터 그 차이를 뺐다 — 무엇으로 대신할지는 격자로 정한다(디자이너).
   진중한 · 보통의 세로 75%도 같은 날 뺐다(디자이너) — 키가 큰 둥켈을 다른 셋 높이로
   맞추던 눌림이라, 키가 낮은 아침에 걸면 혼자 납작했다(글자 높이 0.70, 다른 셋 0.89~1.12).
   진중한은 같은 날 격자로 다시 골랐다(디자이너): 장평 125% · 자간 +0.12em · 세로 85% · 굵기 700 ·
   장평 115%+자간 +0.06em · 굵기 700+자간 +0.08em · 장평 115%+세로 90%를 한 장에 놓고
   **장평 115% + 자간 +0.06em**(넓게 + 띄워 — 글줄 길이 1.24, 농도 0.93). 무게는 자간을 더하지
   않는다(김정철 고딕은 굵기마다 글자폭이 같다, 10-04). 거침없는 쪽(기울기 18°)은 그대로 두었다.
   2026-10-06: 둥켈산스로 되돌리며 위 둥켈 시절 값(폭 1000 · 700 · 700, 세로 75% · 75% · 100%)으로 돌아왔다(디자이너가 본 목업 그대로).

   기울기는 속도 가운데에서 0, 오른쪽 끝에서 18도 — 그 사이를 이어서 기운다
   (12~18도로 세기를 조절, 사용자 결정). 모든 값은 세 지점 사이를 곧게 잇는다.
   장평·세로·기울기는 서체의 축이 아니라 브라우저 변형이다(scale · skewX). 기울기는
   oblique였다가 줄마다 skewX로 바꿨다(2026-09-29) — 기운 글꼴이 없어 브라우저가
   흉내 냈고, 크롬에서 9°는 안 기울고 18°는 14°로 고정이었다(VoiceBubble). */
export const SLANT_MAX = 18;
type Three = [number, number, number];
const SPEED: Record<string, { sx: Three; sy: Three; wdth?: Three }> = {
  ttoryeot: { sx: [1, 1, 1], sy: [0.75, 0.75, 1], wdth: [1000, 700, 700] },
  deulseok: { sx: [1.21, 1, 0.88], sy: [0.75, 1, 1] },
  chabun: { sx: [1, 1, 0.88], sy: [0.86, 1, 1] },
  doran: { sx: [1.38, 1, 0.84], sy: [1, 1, 1] }
};
/** 차분한의 무게 — 2026-10-04 250 · 445 · 900에서 올렸다(디자이너). 가장 가는 글이 벽에서 너무 얇아 안 읽혔다: 빗금 결(돌)의
    검은 틈 2.3px 옆에서 가장 작은 글의 획이 0.47px. 격자 넷(지금 · 325 · 400 · 500) 중 500 · 620 · 900 — 가운데는 전처럼
    가늘게 + 0.3 × (900 − 가늘게). 900은 본명조의 끝이라 그 위는 획을 덧댄다(CHABUN_STROKE) */
const CHABUN_WGHT: Three = [500, 620, 900];
/** 차분한 '1000쯤' — 가장 굵게에서만 같은 색 획을 덧댄다(다정한과 같은 장치, 가운데까지는 0). 본명조를 재서 무게 100 ≈ 획 평균
    +0.0093em — 900 · 1000쯤 · 1100쯤 · 1200쯤을 벽 16 · 22px와 46px(속공간)에 놓고 디자이너가 1000쯤(2026-10-04) */
const CHABUN_STROKE: Three = [0, 0, 0.0093];
/** 다카포 획 덧대기 — 12pt에서 0.36 · 0.46 · 0.56pt, 글자 크기에 비례하므로 em으로. 2026-10-04 0 · 0.1 · 0.2pt에서 올렸다
    (디자이너): 맨 획이 0.0275em(차분한 500의 절반 아래)이라 벽의 작은 글이 13.7px에서 획 0.4px — 구름 빗금 틈(획 × 1.6까지)이
    0.6px로 가늘어졌다. 사다리를 통째로 +0.12 · +0.24 · +0.36pt 올린 넷 중 '다' — "여기까지가 한계"(가장 가는 획 2.09배) */
const DORAN_STROKE: Three = [0.36 / 12, 0.46 / 12, 0.56 / 12];
/** 핸드젯 — 말투를 고르던 옛 글(2026-09-25 ~ 10-03)의 굵기. 그때는 840에 고정이었다 */
const HANDJET_WGHT = 840;
/**
 * 유머있는의 무게(2026-10-04, 디자이너) — 막대 다섯 칸이 핸드젯 굵기 400 · 560 · 720 · 840 · 900. 굵기 100 ~ 900을 폰 40px · 벽
 * 22px × 밝은 칠 · 어두운 칠에 늘어놓은 격자에서 골랐다: 100 · 200은 글자를 이루는 점이 흐려져 점선으로 흩어지고, 300은 벽 22px에서
 * 아슬아슬했다. 고르게 나눈 300 · 450 · 600 · 750 · 900 대신, 벽의 가장 가는 글도 넉넉히 읽히게 아래를 올리고 지금까지의 840을
 * '무겁게'에 둔 쪽(제안 2)
 */
const HANDJET_WEIGHT = [400, 560, 720, 840, 900] as const;
/** 유머있는(비)의 모양 — 4/5 '모양' 칸의 값(tone.align). 그 밖의 값(옛 왼쪽 · 가운데 · 오른쪽, 빈 값)은 둥글 */
export type RainShape = 'round' | 'square' | 'pointy';
export const RAIN_SHAPES: readonly RainShape[] = ['round', 'square', 'pointy'];
export const rainShapeOf = (align?: string): RainShape => (align === 'square' || align === 'pointy' ? align : 'round');
/**
 * 모양마다 핸드젯의 낱알(ELSH · ELGR)과 무게 다섯 칸의 굵기(2026-10-04, 디자이너). 둥글 = 지금까지의 귀여운 자형, 뾰족 = 옛 시니컬한의
 * 톱니 세모(ELSH 1 — 0.8보다 낱알이 커 벽에서 덜 흐리다), 네모 = 기본 네모 낱알. 굵기는 **같은 무게 칸이면 셋이 같은 무게로 보이게**
 * 둥글을 기준으로 맞췄다: 글자의 칠해진 넓이와 흐리게 본 덩치(가우스 0.05em, 50% 넘는 넓이)를 견본 글 마흔 자로 재서 둥글과 1% 안
 * (뾰족 840 칸만 870 — 900이면 위 두 칸이 같아져서 조금 덜 올렸다). 뾰족은 톱니라 칠이 적어 올리고, 네모는 꽉 차서 내렸다
 */
export const RAIN_FACE: Record<RainShape, { elsh: number; elgr: number; wght: readonly [number, number, number, number, number] }> = {
  round: { elsh: 12, elgr: 1.75, wght: HANDJET_WEIGHT },
  square: { elsh: 2, elgr: 1, wght: [370, 450, 550, 620, 660] },
  pointy: { elsh: 1, elgr: 1, wght: [600, 700, 800, 870, 900] }
};
/** 다섯 칸(0 · ¼ · ½ · ¾ · 1) 사이를 곧게 잇는다 */
const alongFive = (t: number, v: readonly [number, number, number, number, number]) => {
  const x = Math.min(1, Math.max(0, t)) * 4, i = Math.min(3, Math.floor(x));
  return v[i] + (v[i + 1] - v[i]) * (x - i);
};
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
/** 무게 막대의 칸 말 — 막대는 말의 개수만큼 칸을 낸다(당당한의 세 칸 무게는 2026-10-06 둥켈로 되돌리며 말투로 갈음했다) */
export const weightWordsFor = (_font: string): Pair<readonly string[]> => WEIGHT_WORDS;
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
/**
 * 유머있는(비)의 빠르기 막대 — 보통 ~ 빠르게 세 칸(2026-10-04, 디자이너 — "장평은 조절하지 말고 기울기만, 보통-빠르게만").
 * 막대 자리 0 · ½ · 1이 speed 0.5 · 0.75 · 1이라 저장되는 값의 뜻(가운데 = 보통)은 다른 성격과 같고, 기울기는 0 · 9 · 18°다.
 * 이 값이 기울기와 함께 비눗방울이 떠다니는 박자를 정한다(lib/rain.ts bubbleMove)
 */
const RAIN_SPEED_WORDS: Pair<[string, string, string]> = {
  ko: ['보통', '재잘재잘', '한껏 재잘재잘'],
  en: ['Regular', 'Chatty', 'Extra chatty']
};
/** 빠르기 막대 — 칸의 말과, 막대 자리(0~1) ↔ 저장되는 speed(0~1, 가운데 = 보통) */
export function speedBarFor(font: string): { words: Pair<readonly string[]>; toSpeed: (v: number) => number; fromSpeed: (s: number) => number } {
  if (font === 'deulseok') return { words: RAIN_SPEED_WORDS, toSpeed: (v) => 0.5 + 0.5 * v, fromSpeed: (s) => Math.min(1, Math.max(0, (s - 0.5) / 0.5)) };
  return { words: SPEED_WORDS[font] ?? SIZE_WORDS, toSpeed: (v) => v, fromSpeed: (s) => s };
}
/** 크기 막대를 세우는가 — 유머있는(비)은 벽 글자가 28px 하나라 크기를 묻지 않는다(2026-10-04, 디자이너 — 막대는 빠르기 · 무게 둘) */
export const hasSizeBar = (font: string) => font !== 'deulseok';
/** 막대 자리에서 가장 가까운 칸(0~4) */
export const stopAt =(t: number) => Math.round(Math.min(1, Math.max(0, t)) * (STOPS - 1));
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
  /** 둥켈산스의 폭 축(700~1000) — 구름 · 나무(cloud.ts)가 글자폭을 셀 때 받는다. 2026-10-01 ~ 10-06엔 비어 있었다 */
  wdth?: number;
}

type FormInput = { font: string; tone?: number; slnt?: number; wght?: number; manner?: number; speed?: number; weight?: number; align?: string };

/**
 * 한 글의 모양. speed가 있으면 새 표로, 없으면(옛 글) 옛 칸 그대로 그린다.
 */
export function formFor(t: FormInput): Form {
  const font = t.font;
  const bold = font === 'ttoryeot';
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
  let letterSpacing = track;
  /** 장평 · 세로를 그대로 두는가 — 유머있는(비)의 새 글은 기울기만 바뀐다(speedBarFor) */
  let flat = false;
  let wdth: number | undefined;
  if (bold) {
    /* 둥켈산스(2026-10-06 되돌림) — 폭 축은 속도가(진중한 1000 · 보통 · 거침없는 700), 말투는 GLAT(온화한 1000 · 예리한 0).
       무게 축이 없어 굵기는 그대로다. 말투가 빈 글(무게로 쓴 10-04 ~ 10-06)은 온화한 자형 */
    wdth = Math.round(along(s, row.wdth!));
    variation = `"wdth" ${wdth}, ${MANNER.ttoryeot.axes![t.manner ? 1 : 0]}`;
  } else if (font === 'deulseok') {
    /* 무게 다섯 칸(HANDJET_WEIGHT) · 귀여운 자형 하나. 말투가 적힌 옛 글은 그때처럼 840에 그 말투(HANDJET_AXES) */
    const old = t.manner === 0 || t.manner === 1;
    if (old) {
      weight = HANDJET_WGHT;
      variation = `"wght" ${weight}, ${HANDJET_AXES[t.manner ? 1 : 0]}`;
    } else {
      /* 비(2026-10-04) — 4/5 모양(둥글 · 네모 · 뾰족)이 낱알 모양을, 무게 칸이 그 모양의 보정 굵기를 고른다 */
      const f = RAIN_FACE[rainShapeOf(t.align)];
      weight = Math.round(alongFive(w, f.wght));
      variation = `"wght" ${weight}, "ELSH" ${f.elsh}, "ELGR" ${f.elgr}`;
    }
    flat = !old;
  } else if (font === 'chabun') {
    weight = Math.round(along(w, CHABUN_WGHT));
    variation = `"wght" ${weight}`;
    stroke = along(w, CHABUN_STROKE).toFixed(4) + 'em';
  } else if (font === 'doran') {
    stroke = along(w, DORAN_STROKE).toFixed(4) + 'em';
  }
  return {
    scaleX: flat ? 1 : along(s, row.sx), scaleY: flat ? 1 : along(s, row.sy), slant,
    variation, stroke, letterSpacing, weight, wdth
  };
}

/**
 * 새 표를 모르는 곳을 위한 옛 칸 — 표가 계산한 모양을 옛 칸(tone · slnt · wght)
 * 으로도 적어 둔다. 세로 비율은 옛 칸에 자리가 없어 빠진다.
 */
export function legacyFields(t: FormInput) {
  const f = formFor(t);
  return { tone: +f.scaleX.toFixed(3), slnt: -+f.slant.toFixed(2), wght: f.weight };
}
