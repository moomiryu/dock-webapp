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

/**
 * 한 줄의 폭을 **한글 한 자 = 한 칸**으로 센다(2026-09-26, 영문판).
 *
 * 줄 길이 12자·크기 계산은 한글을 두고 정했다. 한글 한 자는 거의 정사각형
 * (1em)인데 영문자·숫자는 그 절반 남짓이다. 글자 수로만 세면 영어는 한 줄에
 * 한글 12자 폭의 절반만 쓰고 접혀서, 60자를 채우기 전에 다섯 줄에 걸렸고
 * 12자가 넘는 낱말(International)은 가운데서 잘렸다.
 *
 * 그래서 **한글이 한 자도 없는 글**에서만 영문자·숫자를 반 칸으로 센다.
 * 빈칸·부호는 한 칸 그대로다(넉넉하게). 한글이 섞인 글은 전과 똑같이 한
 * 자에 한 칸이다 — 한국어 글의 줄 나눔과 벽에 있는 글은 하나도 안 바뀐다.
 * 화면의 언어가 아니라 **글**을 본다: 한국어 화면에서 영어로 쓴 글도 같다.
 */
export function isLatinText(text: string): boolean {
  return !/[ᄀ-ᇿ㄰-㆏가-힣]/.test(text);
}
export function lineCells(line: string, latin = isLatinText(line)): number {
  let n = 0;
  for (const ch of line) n += latin && /[A-Za-z0-9]/.test(ch) ? 0.5 : 1;
  return n;
}

/** 가장 긴 줄이 폭의 88%, 전체 줄이 높이의 82%에 맞춰지는 font-size 식 */
export function fitFontSize(text: string, { min = 6, max = 200 }: Options = {}): string {
  const lines = text.split('\n');
  const latin = isLatinText(text);
  const longest = Math.max(1, ...lines.map((l) => lineCells(l, latin)));
  const byWidth = (88 / longest).toFixed(2);
  const byHeight = (82 / (lines.length * 1.25)).toFixed(2);
  return `clamp(${min}px, min(${byWidth}cqw, ${byHeight}cqh), ${max}px)`;
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

/* 말풍선 틀의 치수(bubbleAt · 크기 칸 · 폰 한 변)는 2026-10-20에 걷었다 — 도트 집합체는 제 자리를 재서 크기를 정한다(DotBubble · WallSky) */

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
export function foldLines(text: string, per = CHARS_PER_LINE, latin = isLatinText(text)): string[] {
  /* 발화자가 끊은 자리는 지킨다. 다만 그 안에서도 **한 줄에 들어갈 만큼만**
     접는다 — 2026-09-22까지는 줄바꿈이 하나라도 있으면 접기를 통째로 껐고,
     그래서 '가'를 60자 친 뒤 엔터를 한 번 누르면 그 60자가 한 줄로 벽을
     가로질렀다. 발화자가 정하는 것은 **어디서 끊을지**이지 한 줄이 얼마나
     길어도 되는지가 아니다. 벽의 한 줄은 열두 자다. */
  if (text.includes('\n')) return text.split('\n').flatMap((part) => foldLines(part, per, latin));
  const out: string[] = [];
  let line = '';
  /* 폭은 칸으로 센다(lineCells) — 영어만 영문자·숫자가 반 칸이다 */
  const len = (v: string) => lineCells(v, latin);
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? line + ' ' + word : word;
    if (len(next) <= per) { line = next; continue; }
    if (line) out.push(line);
    line = word;
    while (len(line) > per) {
      /* 한 줄보다 긴 낱말만 자른다 — 칸으로 세어 넘기 직전 글자에서 */
      const chars = Array.from(line);
      let k = 0, w = 0;
      while (k < chars.length && w + lineCells(chars[k], latin) <= per) w += lineCells(chars[k++], latin);
      k = Math.max(1, k);
      out.push(chars.slice(0, k).join(''));
      line = chars.slice(k).join('');
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}
