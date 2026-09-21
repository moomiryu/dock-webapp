// 액자에 글을 맞추는 계산 — 쓰는 만큼 글자가 작아진다.
//
// 벽은 정해진 크기(2.5 × 1.41 m · Full HD)라, 긴 문장은 작게 들어갈 수밖에 없다.
// 그 사실을 쓰는 동안에도 보여주려고 입력 화면과 미리보기가 같은 공식을 쓴다.
// /wall의 강조 렌더도 같은 비율을 쓰되 단위만 뷰포트(vw/vh)다.
//
// 단위가 cqw/cqh라서 부모에 `container-type: size`가 있어야 한다.
// 컨테이너 쿼리를 모르는 브라우저에서는 이 값이 통째로 무효가 되므로,
// CSS 쪽에 폴백 font-size를 남겨둘 것.

interface Options {
  /** 아래로 줄어들 수 있는 한계 (px). 편집 화면은 읽을 수 있어야 해서 더 높다 */
  min?: number;
  /** 위로 커질 수 있는 한계 (px) */
  max?: number;
}

/** 가장 긴 줄이 폭의 88%, 전체 줄이 높이의 82%에 맞춰지는 font-size 식 */
export function fitFontSize(text: string, { min = 6, max = 200 }: Options = {}): string {
  const lines = text.split('\n');
  const longest = Math.max(1, ...lines.map((l) => Array.from(l).length));
  const byWidth = (88 / longest).toFixed(2);
  const byHeight = (82 / (lines.length * 1.25)).toFixed(2);
  return `clamp(${min}px, min(${byWidth}cqw, ${byHeight}cqh), ${max}px)`;
}

/** 그 글자가 실제 벽에서 몇 cm가 되는지 */
export function glyphCm(text: string, wallWidthM: number): number {
  const lines = text.split('\n');
  const longest = Math.max(1, ...lines.map((l) => Array.from(l).length));
  return Math.round(((wallWidthM * 100) / longest) * 0.88);
}

// ─────────────────────────────────────────────────────────────────────
// 글 → 틀. 위 계산과 반대 방향이다.
//
// 위의 fitFontSize는 **액자가 먼저 있고 글자가 거기 맞춰 줄어든다.** 그
// 순서에서는 발화자가 정한 줄바꿈이 크기 축에 밀려 다시 접힌다. 아래는
// 그 반대다 — 글과 크기가 먼저고, 틀이 결과로 나온다.
//
// 두 계산이 당분간 같이 산다. 위쪽은 아직 03·04·/wall이 쓰고 있고,
// 아래쪽이 그 자리들을 하나씩 넘겨받는다.
// ─────────────────────────────────────────────────────────────────────

/** 한 줄에 들어갈 수 있는 최대 글자 수. 근거는 design/line-length-2026-09-17.md */
export const CHARS_PER_LINE = 12;

/** 줄 높이 — 글자 한 칸의 배수 */
export const LINE_HEIGHT = 1.5;

/**
 * 크기 축 다섯 칸. **절대 크기가 아니라 비율이다.**
 *
 * 절대 크기(28~60px)로 두면 두 가지가 동시에 깨진다. 짧은 한마디가 제
 * 자리를 못 쓰고(‘왜?’가 최대 영역의 4분의 1에 갇힌다), 긴 글에서는 위쪽
 * 칸들이 영역을 넘어 죽은 칸이 된다.
 *
 * 그래서 축의 뜻을 바꾼다 — **이 말이 벽에서 쓸 수 있는 자리 중 얼마를
 * 쓸 것인가.** 맨 위 칸이 곧 최대 영역이고, 그래서 "영역을 넘는 크기는
 * 고를 수 없다"가 규칙이 아니라 정의가 된다.
 *
 * 이 정의가 폰 문제도 같이 푼다. 비율은 폰에서도 벽에서도 같은 값이라,
 * 폰이 19배 작아도 **거짓말을 하지 않는다.** 절대 크기를 보여주려 들면
 * 축의 아래 칸이 폰에서 5.7pt가 되어 못 읽고, 읽히게 바닥을 깔면 이번엔
 * 축이 거짓이 된다(그 바닥이 지금 코드의 18px이다).
 */
export const SIZE_FILLS = [0.47, 0.6, 0.73, 0.87, 1] as const;

/** 틀 치수. 전부 **최대 영역 한 변에 대한 비율**이라 폰(px)에도 벽(vh)에도 곱하면 된다 */
export interface Boxed {
  /** 글자 한 칸 = font-size */
  unit: number;
  /** 몸통 */
  w: number;
  h: number;
  /** 꼬리가 몸통 아래로 더 쓰는 높이 */
  tail: number;
}

/** 크기와 틀 치수를 이어 주는 도형 쪽 계약 — bubbles.ts의 Bubble이 이걸 만족한다 */
export interface BoxShape {
  body(tw: number, th: number, u: number): { w: number; h: number };
  tail(u: number): number;
}

/**
 * 크기 축 **맨 위 칸**의 글자 크기 — 최대 영역 한 변에 대한 비율.
 *
 * 2026-09-22까지 크기 축은 '영역 중 얼마를 쓸 것인가'였다. 틀을 언제나
 * 영역 한 변에 꽉 채우고 그 비율만 칸이 정했으니, 어떤 글이든 같은 칸이면
 * **폭이 소수점까지 같았다** — 재서 확인: 6자·13자·43자가 세 칸 모두
 * 정확히 1.000. 더 나쁜 것은 짧은 말이 오히려 컸다는 것이다(액자 면적
 * 30.6% 대 17.1%). 한 줄짜리는 세로로 여유가 남아 폭 쪽이 먼저 닿는데,
 * 거기에 짧은 글의 최소 지름까지 얹혀 두 줄짜리를 넘어섰다.
 *
 * 이제 칸이 **글자 크기 자체**를 정하고 틀은 그 결과로 나온다. 길게 쓰면
 * 구름이 커지고 짧게 쓰면 작아진다 — 말의 길이가 크기로 읽힌다.
 *
 * 0.074는 43자(다섯 줄)가 맨 위 칸에서 영역을 꽉 채우는 값이다. 재서
 * 골랐다 — 글마다 '영역에 꼭 맞는 글자 크기'는 2자 0.138에서 60자
 * 0.058까지 걸쳐 있고, 그 가운데를 잡아야 짧은 글이 작아질 자리와 긴 글이
 * 쓸 자리가 둘 다 남는다. 더 키우면(0.09) 6자가 영역의 96%를 먹어 다시
 * 길이가 안 읽히고, 더 줄이면 긴 글이 제 자리를 못 쓴다.
 */
export const UNIT_TOP = 0.074;

/**
 * 그 크기 칸에서 이 글이 쓰는 치수.
 *
 * 도형 함수는 전부 글자 한 칸(u)에 정비례한다 — 늘어나는 건 가운데뿐이고
 * 꼬리·갈래도 u의 배수다. 그래서 u=1로 한 번 재면 계수가 나온다.
 *
 * 칸이 정한 크기를 그대로 쓰되 **영역을 넘지는 않는다**(cap). 긴 글은
 * 위쪽 칸 몇 개가 거기서 뭉치는데, 그건 계산이 아니라 벽이 정한 사실이다 —
 * 60자를 쓰면 더 크게 쓸 자리가 없다.
 */
export function bubbleAt(lines: readonly string[], shape: BoxShape, fill: number): Boxed {
  const longest = Math.max(1, ...lines.map((l) => Array.from(l).length));
  const rows = Math.max(1, lines.length);
  const at1 = shape.body(longest, rows * LINE_HEIGHT, 1);
  const tail1 = shape.tail(1);
  const cap = Math.min(1 / at1.w, 1 / (at1.h + tail1));
  const unit = Math.min(UNIT_TOP * fill, cap);
  return { unit, w: at1.w * unit, h: at1.h * unit, tail: tail1 * unit };
}

/** 저장된 옛 크기(28~60)를 새 다섯 칸 중 가까운 자리로 읽는다 */
export function fillFromLegacySize(size: number | undefined): number {
  const i = Math.round(((Math.min(60, Math.max(28, size ?? 44)) - 28) / 32) * (SIZE_FILLS.length - 1));
  return SIZE_FILLS[i];
}

/**
 * 줄바꿈이 없는 글을 한 줄 12자로 접는다 — **어절 단위로만.**
 *
 * 줄을 어디서 나눌지는 발화자가 정한다. 그런데 그 규칙이 생기기 전에 쓰인
 * 글에는 나눌 자리가 적혀 있지 않다 — 저장된 글은 전부 줄바꿈 없는 한
 * 덩어리다. 그걸 그대로 새 계산에 넣으면 25자짜리가 한 줄로 늘어서 벽을
 * 가로지르는 띠가 된다.
 *
 * 그래서 **줄바꿈이 없을 때만** 여기서 접는다. 발화자가 넣은 줄바꿈이
 * 하나라도 있으면 손대지 않는다. 시스템이 형식을 정하는 것이 아니라,
 * 아직 아무도 정하지 않은 자리를 메우는 다리다.
 *
 * 어절이 한 줄보다 긴 경우에만 음절에서 자른다. 표본에서 어절 최대가
 * 6자였으니 12자 한도에서는 거의 오지 않는 길이다.
 */
export function foldLines(text: string, per = CHARS_PER_LINE): string[] {
  /* 발화자가 끊은 자리는 지킨다. 다만 그 안에서도 **한 줄에 들어갈 만큼만**
     접는다 — 2026-09-22까지는 줄바꿈이 하나라도 있으면 접기를 통째로 껐고,
     그래서 '가'를 60자 친 뒤 엔터를 한 번 누르면 그 60자가 한 줄로 벽을
     가로질렀다. 발화자가 정하는 것은 **어디서 끊을지**이지 한 줄이 얼마나
     길어도 되는지가 아니다. 벽의 한 줄은 열두 자다. */
  if (text.includes('\n')) return text.split('\n').flatMap((part) => foldLines(part, per));
  const out: string[] = [];
  let line = '';
  const len = (v: string) => Array.from(v).length;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? line + ' ' + word : word;
    if (len(next) <= per) { line = next; continue; }
    if (line) out.push(line);
    line = word;
    while (len(line) > per) {
      out.push(Array.from(line).slice(0, per).join(''));
      line = Array.from(line).slice(per).join('');
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}
