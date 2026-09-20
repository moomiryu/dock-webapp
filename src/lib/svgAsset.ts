// 일러스트레이터에서 나온 SVG를 문서에 그대로 부어 넣기 전에 손보는 일.
//
// 그 도구는 파일마다 `.cls-1` `.cls-2` 같은 이름과 `id="_레이어_1"` 을 붙여 내보낸다.
// 한 장일 때는 문제가 없지만, by_moomiryu에 에셋이 둘 이상 쌓이는 순간
// 두 번째 파일의 `.cls-1`이 첫 번째 파일의 색을 덮어쓴다. <style>이 문서 전역이라서다.
// id도 마찬가지로 그라디언트·마스크 참조(url(#...))가 엉킨다.
//
// 그래서 붓기 전에 이름 뒤에 에셋 키를 달아 각자 방을 준다.
// 원본 파일은 건드리지 않는다 — 그림은 작가 것이고, 여기서는 읽기만 한다.

export function scopeSvg(raw: string, key: string): string {
  return raw
    .replace(/\bcls-(\d+)\b/g, `cls-$1-${key}`)
    .replace(/\sid="([^"]+)"/g, ` id="$1-${key}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1-${key})`)
    .replace(/(\s(?:xlink:)?href=")#([^"]+)"/g, `$1#$2-${key}"`);
}

// ─── 두 컷을 오가는 모프 ──────────────────────────────────────────
//
// 작가가 삽화를 짝으로 준다. 한 군데만 다른 두 컷이다 — 크기 손잡이가
// 위였다 아래로, 느낌표가 없었다 생기고. 그 사이를 자연스럽게 오가게 한다.
//
// 값 보간은 직접 하지 않고 브라우저에 맡긴다(SVG SMIL `<animate>`).
// 한 프레임씩 계산해 넣으면 삽화 하나에 path가 서른 넘는 이 그림에서는
// 소개 화면이 도는 내내 메인 스레드를 붙잡게 된다. 우리가 할 일은
// **두 경로를 같은 뼈대로 맞춰 주는 것**뿐이다 — 브라우저는 명령 순서가
// 같을 때만 보간하므로, H·V·상대좌표를 전부 절대 M·L·C·Z로 편다.
//
// 맞출 수 없으면(명령이 다르거나 짝이 안 맞으면) 조용히 둘째 컷만 그린다.
// 삽화가 안 움직이는 것은 아쉬운 일이고, 찌그러지는 것은 망가진 일이다.

/** 소수점 둘째 자리까지. 그보다 정밀해 봐야 화면에서 같은 픽셀이다 */
const r2 = (n: number) => Number(n.toFixed(2));

/**
 * path의 d를 절대좌표 M·L·C·Z 만으로 다시 쓴다.
 * 이 그림들이 실제로 쓰는 명령만 받는다. 모르는 게 나오면 null.
 */
function normalizeD(d: string): string | null {
  const t = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = '';
  /* 직전 곡선의 **두 번째 손잡이**. s(부드러운 곡선)는 그것을 거울처럼
     뒤집어 제 첫 손잡이로 쓴다. 곡선이 아니었으면 지금 점이 그 자리다.
     q(2차 곡선)의 손잡이는 따로 센다 — t가 그것을 뒤집어 쓴다. */
  let bx = 0, by = 0, curved = false;
  let qx = 0, qy = 0, quad = false;
  const out: string[] = [];
  const num = () => Number(t[i++]);
  const to = (x: number, y: number, c: 'M' | 'L') => {
    out.push(`${c}${r2(x)},${r2(y)}`); cx = x; cy = y; curved = false; quad = false;
  };
  const curve = (ax: number, ay: number, dx: number, dy: number, x: number, y: number) => {
    out.push(`C${r2(ax)},${r2(ay)} ${r2(dx)},${r2(dy)} ${r2(x)},${r2(y)}`);
    bx = dx; by = dy; cx = x; cy = y; curved = true; quad = false;
  };
  /**
   * 2차 곡선을 3차로 바꾼다. 손잡이 하나를 셋 중 둘로 나누어 놓는 것인데,
   * 같은 곡선이 정확히 나온다(근사가 아니다).
   *
   * 홈 캐릭터의 **다리**가 Q를 쓴다. 2026-09-20까지 여기서 null로 물러났고,
   * 그 바람에 다리의 겉넓이를 못 재어 몸을 자르는 자리가 Infinity가 됐다 —
   * 인물의 몸이 통째로 사라졌다.
   */
  const quadTo = (ax: number, ay: number, x: number, y: number) => {
    const x0 = cx, y0 = cy;
    qx = ax; qy = ay;
    curve(x0 + (2 / 3) * (ax - x0), y0 + (2 / 3) * (ay - y0),
      x + (2 / 3) * (ax - x), y + (2 / 3) * (ay - y), x, y);
    quad = true;
  };
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    switch (cmd) {
      // M 뒤에 이어지는 숫자 쌍은 L이다. 그 규칙을 여기서 지킨다.
      case 'M': { const x = num(), y = num(); to(x, y, 'M'); sx = cx; sy = cy; cmd = 'L'; break; }
      case 'm': { const x = cx + num(), y = cy + num(); to(x, y, 'M'); sx = cx; sy = cy; cmd = 'l'; break; }
      case 'L': { const x = num(), y = num(); to(x, y, 'L'); break; }
      case 'l': { const x = cx + num(), y = cy + num(); to(x, y, 'L'); break; }
      case 'H': to(num(), cy, 'L'); break;
      case 'h': to(cx + num(), cy, 'L'); break;
      case 'V': to(cx, num(), 'L'); break;
      case 'v': to(cx, cy + num(), 'L'); break;
      case 'C': { const a = num(), b = num(), c = num(), e = num(), x = num(), y = num(); curve(a, b, c, e, x, y); break; }
      case 'c': {
        const x0 = cx, y0 = cy;
        curve(x0 + num(), y0 + num(), x0 + num(), y0 + num(), x0 + num(), y0 + num()); break;
      }
      /* 부드러운 곡선. 2026-09-20까지 여기서 null로 물러났고, 그게 새 삽화의
         짝짓기를 통째로 무너뜨렸다 — About의 빨간 인물 몸과 구경꾼 몸이
         전부 s를 쓴다. 짝이 없으니 '둘째 컷에만 있는 것'으로 분류돼,
         인물의 몸이 구경꾼들과 함께 화면 밖에서 걸어 들어왔다. */
      case 'S': {
        const ax = curved ? 2 * cx - bx : cx, ay = curved ? 2 * cy - by : cy;
        const c = num(), e = num(), x = num(), y = num(); curve(ax, ay, c, e, x, y); break;
      }
      case 's': {
        const x0 = cx, y0 = cy;
        const ax = curved ? 2 * cx - bx : cx, ay = curved ? 2 * cy - by : cy;
        curve(ax, ay, x0 + num(), y0 + num(), x0 + num(), y0 + num()); break;
      }
      /* 2차 곡선. 다리가 이것으로 그려져 있다. */
      case 'Q': { const a = num(), b = num(), x = num(), y = num(); quadTo(a, b, x, y); break; }
      case 'q': {
        const x0 = cx, y0 = cy;
        quadTo(x0 + num(), y0 + num(), x0 + num(), y0 + num()); break;
      }
      case 'T': {
        const ax = quad ? 2 * cx - qx : cx, ay = quad ? 2 * cy - qy : cy;
        quadTo(ax, ay, num(), num()); break;
      }
      case 't': {
        const x0 = cx, y0 = cy;
        const ax = quad ? 2 * cx - qx : cx, ay = quad ? 2 * cy - qy : cy;
        quadTo(ax, ay, x0 + num(), y0 + num()); break;
      }
      case 'Z': case 'z': out.push('Z'); cx = sx; cy = sy; curved = false; quad = false; break;
      default: return null;
    }
  }
  return out.join('');
}

/** 명령 글자만 남긴 것. 이게 같아야 브라우저가 보간한다 */
const shapeOf = (d: string) => d.replace(/[^A-Z]/g, '');

/** style 속성에 한 줄 더 붙인다. 덮어쓰면 앞서 붙은 것이 지워진다 */
function addStyle(el: Element, decl: string) {
  const had = el.getAttribute('style');
  el.setAttribute('style', had ? `${had};${decl}` : decl);
}

/**
 * <style> 규칙을 클래스별 선언 묶음으로 편다.
 *
 * 규칙 하나에 선택자가 여럿 묶여 나온다: `.cls-3, .cls-4 { fill: #fff }`.
 * 앞의 하나만 집으면 뒤에 묶인 것들이 색을 못 받아 검정으로 떨어진다 —
 * About의 눈 흰자와 벽에 켜지는 글자가 그렇게 검어졌다. 쉼표로 끊어 전부 준다.
 *
 * 한 클래스가 규칙 여럿에 걸리는 것도 흔하다(일러스트레이터는 색과 글꼴을
 * 따로 낸다). 뒤에 오는 규칙이 앞을 덮는 CSS의 순서를 그대로 지킨다.
 */
function styleTable(css: string): Record<string, Record<string, string>> {
  const table: Record<string, Record<string, string>> = {};
  for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const decls: Array<[string, string]> = [];
    for (const one of rule[2].split(';')) {
      const m = one.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);
      if (m) decls.push([m[1], m[2]]);
    }
    if (!decls.length) continue;
    for (const sel of rule[1].split(',')) {
      const c = sel.trim().match(/^\.([\w-]+)$/);
      if (!c) continue;
      const bag = (table[c[1]] ??= {});
      for (const [k, v] of decls) bag[k] = v;
    }
  }
  return table;
}

/**
 * <style>을 각 요소에 붙여 넣고 <style>을 없앤다.
 *
 * 문서가 섞이기 때문이다 — 다른 컷의 요소를 이 문서로 옮겨 심는데,
 * 옮겨 온 것의 `class="cls-3"`은 여기서 전혀 다른 색을 뜻한다.
 *
 * **fill만 옮기다가 2026-09-20에 나머지를 다 잃고 있었다는 걸 알았다.**
 * 새 Step 2 삽재는 잣대 선이 `fill:none; stroke:#fff; stroke-width:8.25px`
 * 이고 글자가 `font-family: Pretendard Variable; font-size: 167.49px`인데,
 * 그 선언들이 <style>과 함께 통째로 버려져 선은 안 보이고 '가'는 16px
 * 기본 글꼴로 떨어졌다. 이제 선언을 전부 옮긴다.
 *
 * fill만은 style이 아니라 **속성**으로 둔다 — 짝을 지을 때 읽는 값이라
 * (itemsOf · pairs) 한자리에 있어야 한다.
 */
const PRESENTATION = new Set([
  'fill', 'fill-opacity', 'fill-rule', 'opacity',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-opacity',
  'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor'
]);

function inlineFills(root: Element) {
  const table = styleTable(root.querySelector('style')?.textContent ?? '');
  root.querySelectorAll('[class]').forEach((el) => {
    const bag = table[el.getAttribute('class')!];
    el.removeAttribute('class');
    if (!bag) return;
    const rest: string[] = [];
    for (const [k, v] of Object.entries(bag)) {
      // 표현 속성은 속성 자리에 둔다. style에 두면 SMIL이 바꿔도 style이
      // 이겨서 아무 일도 안 일어난다 — '가'의 font-size가 그렇다.
      if (PRESENTATION.has(k)) el.setAttribute(k, v);
      else rest.push(`${k}:${v}`);
    }
    if (rest.length) addStyle(el, rest.join(';'));
  });
  root.querySelectorAll('style').forEach((s) => s.remove());
}

// text도 센다. 벽에 켜지는 글자가 한쪽 컷에만 있어서, 빠뜨리면 그것만
// 내내 켜진 채로 남는다 (실제로 그랬다).
const DRAWN = 'path,ellipse,circle,rect,polygon,line,text';

/**
 * 눈을 찾아 깜빡이게 표시한다.
 *
 * 작가의 캐릭터는 눈을 동심원 무리로 그린다 — 흰 눈알 하나에 그 안쪽으로
 * 몸 색깔의 작은 동그라미가 한둘 겹친다(About에서 잰 값: 흰자 r 22,
 * 안쪽 13). 그래서 **흰 원·타원 중 화판에 비해 작은 것**을 눈알로 보고,
 * 그 눈알 반지름 안에 중심이 든 다른 동그라미를 한 눈으로 묶는다.
 * 묶어야 하는 이유: 흰자만 감으면 눈동자가 허공에 남는다.
 *
 * 깜빡임 자체는 CSS가 한다(.mf-eye). SMIL로 세로만 눌러 감으려면 원점을
 * 눈 한가운데로 옮기는 변환을 세 겹 쌓아야 하는데, CSS는 transform-box
 * 한 줄이면 된다.
 *
 * 눈마다 깜빡이는 때를 어긋나게 준다. 넷이 한꺼번에 감으면 캐릭터가
 * 넷인 게 아니라 화면이 한 번 꺼진 것으로 보인다.
 */
function markEyes(root: Element) {
  const vb = (root.getAttribute('viewBox') ?? '').split(/[ ,]+/).map(Number);
  const canvas = vb.length === 4 ? Math.max(vb[2], vb[3]) : 0;
  if (!canvas) return;
  const balls = Array.from(root.querySelectorAll('circle,ellipse')).map((el) => {
    const n = (a: string) => Number(el.getAttribute(a) ?? 0);
    const r = el.tagName === 'circle' ? n('r') : Math.max(n('rx'), n('ry'));
    return { el, cx: n('cx'), cy: n('cy'), r, white: (el.getAttribute('fill') ?? '').toLowerCase() };
  });
  const isWhite = (f: string) => f === '#fff' || f === '#ffffff' || f === 'white';
  // 눈알: 흰색이고, 화판의 0.6~5% 크기. 그보다 크면 몸통이나 바닥 그림자다.
  const eyes = balls.filter((b) => isWhite(b.white) && b.r > canvas * 0.006 && b.r < canvas * 0.05);
  eyes.forEach((eye, i) => {
    const delay = (i * 1.37) % 5.4;              // 서로 어긋나게. 5.4는 한 바퀴
    for (const b of balls) {
      if (Math.hypot(b.cx - eye.cx, b.cy - eye.cy) > eye.r) continue;
      if (b.r > eye.r) continue;                 // 눈알보다 큰 건 눈이 아니라 그 뒤
      b.el.setAttribute('class', 'mf-eye');
      addStyle(b.el, `animation-delay:${delay.toFixed(2)}s`);
    }
  });
}
/** 모양이 숫자로 적혀 있는 요소들. 이 속성들만 오간다 */
const SHAPE_ATTRS = ['cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2'];

/**
 * **덩치**만 적은 것. 자리(cx·x·y1…)는 뺐다.
 *
 * 컷이 바뀌어도 한 물건의 덩치는 그대로고 자리만 옮긴다 — 잣대 손잡이는
 * 위아래로 다니지만 늘 18.12×10.67이다. 그래서 덩치가 곧 그 물건의 이름이다.
 *
 * 이게 없던 동안 짝짓기가 너무 헐거웠다. 같은 태그·같은 색이면 무엇이든
 * 짝이 되어서, 잣대의 손잡이(18.12)가 눈금 하나(10.86)와 짝지어졌다.
 * 그러면 진짜 손잡이가 짝을 잃고 '이 컷에만 있는 것'으로 심어져, 넷째 컷의
 * 손잡이가 첫째 컷에서도 같이 떠 있었다(재서 확인: 알약이 3개여야 하는데 5개).
 */
const SIZE_ATTRS = ['r', 'rx', 'ry', 'width', 'height'];

interface Item { el: Element; tag: string; fill: string; d: string | null; shape: string; text: string; size: string }

/**
 * <defs> 안쪽은 그리는 것이 아니라 **도구**다 — clipPath의 사각형은 오려낼
 * 틀이지 화면에 나오는 사각형이 아니다. querySelectorAll은 그 둘을 구분하지
 * 못해서, Step 2의 clipPath 안에 든 흰 사각형이 도형으로 잡혀 다른 컷으로
 * 옮겨 심어졌고 글자를 통째로 덮었다.
 */
const INSIDE_DEFS = 'defs,clipPath,mask,pattern,marker,symbol';

function itemOf(el: Element): Item {
  const d = el.tagName === 'path' ? normalizeD(el.getAttribute('d') ?? '') : null;
  return {
    el,
    tag: el.tagName,
    fill: (el.getAttribute('fill') ?? '').toLowerCase(),
    d,
    shape: d ? shapeOf(d) : SHAPE_ATTRS.map((a) => el.getAttribute(a) ?? '').join(','),
    text: el.tagName === 'text' ? (el.textContent ?? '').trim() : '',
    size: SIZE_ATTRS.map((a) => el.getAttribute(a) ?? '').join(',')
  };
}

function itemsOf(root: Element): Item[] {
  return Array.from(root.querySelectorAll(DRAWN)).filter((el) => !el.closest(INSIDE_DEFS)).map(itemOf);
}

/**
 * 같은 것으로 볼 수 있는 한 쌍인가 — 태그·색·뼈대가 모두 같아야 한다.
 *
 * <text>는 **내용까지** 같아야 한다. 안 그러면 '크기'와 '무게'가 서로
 * 짝이 되어 잣대 이름이 자리를 맞바꾼다.
 */
const pairs = (a: Item, b: Item) =>
  a.tag === b.tag && a.fill === b.fill &&
  (a.tag === 'text' ? a.text === b.text : true) &&
  (a.d !== null && b.d !== null
    ? shapeOf(a.d) === shapeOf(b.d)
    : a.tag !== 'path' && a.size === b.size);

/* ─── transform 을 오가게 하기 ──────────────────────────────────────
   SMIL은 transform을 <animate>로 못 다룬다. <animateTransform>이 맡는데
   그것은 한 번에 한 가지(translate·rotate·scale·skewX·skewY)만 안다.

   그래서 컷마다의 transform을 낱개로 뜯어 **정해진 자리 순서**로 세우고,
   없는 자리는 항등값으로 채운 뒤 겹쳐 쌓는다. 첫 자리만 replace로 바탕
   값을 지우고 나머지는 sum으로 얹는다 — 전부 sum으로 두면 요소가 원래
   들고 있던 transform 위에 또 얹혀 두 번 적용된다.

   자리 순서를 하나로 고정할 수 있는 근거: 이 삽화들에서 한 요소가 rotate와
   scale을 같이 쓰는 일이 없다(잣대 손잡이는 translate+rotate, '가'는
   translate+scale+skewX). 섞여 나오면 곱하는 차례가 달라져 결과가 틀어지
   므로, 그럴 때는 손대지 않고 물러난다(null). */
const SLOTS = ['translate', 'rotate', 'scale', 'skewX', 'skewY'] as const;
type Slot = (typeof SLOTS)[number];
/** 자리마다 인자 개수를 고정한다. rotate(a)는 rotate(a,0,0)과 같은 뜻이다 */
const ARITY: Record<Slot, number> = { translate: 2, rotate: 3, scale: 2, skewX: 1, skewY: 1 };
const IDENTITY: Record<Slot, number[]> = {
  translate: [0, 0], rotate: [0, 0, 0], scale: [1, 1], skewX: [0], skewY: [0]
};

function transformOf(el: Element): Record<Slot, number[]> | null {
  const out = { translate: [0, 0], rotate: [0, 0, 0], scale: [1, 1], skewX: [0], skewY: [0] };
  const t = el.getAttribute('transform');
  if (!t) return out;
  let last = -1;
  for (const m of t.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const at = SLOTS.indexOf(m[1] as Slot);
    if (at < 0 || at < last) return null;       // matrix이거나 곱하는 차례가 다르다
    last = at;
    const slot = SLOTS[at];
    const n = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []).map(Number);
    const v = IDENTITY[slot].slice();
    for (let i = 0; i < ARITY[slot]; i++) if (n[i] !== undefined) v[i] = n[i];
    // scale(0.94)는 가로세로 같은 값이다 — 0으로 채우면 납작해진다
    if (slot === 'scale' && n[1] === undefined && n[0] !== undefined) v[1] = n[0];
    out[slot] = v;
  }
  return out;
}

/**
 * 머무는 칸과 옮기는 칸을 번갈아 재어 keyTimes·keySplines를 만든다.
 *
 * values는 컷마다 **두 번씩** 들어간 목록이다(v1;v1;v2;v2;…) — 앞의 것이
 * 머묾의 시작, 뒤의 것이 끝이다. 쉬지 않고 오가면 삽화가 아니라 깜빡이가 된다.
 *
 * @param holds 컷마다 머무는 몫. 되돌아서는 컷에 더 준다
 * @param move  한 번 옮기는 데 드는 몫
 */
function timeline(holds: number[], move: number | number[] = 2) {
  const gap = (i: number) => (Array.isArray(move) ? move[i] ?? 2 : move);
  let total = holds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < holds.length - 1; i++) total += gap(i);
  const times: number[] = [];
  const splines: string[] = [];
  let t = 0;
  holds.forEach((h, i) => {
    times.push(t);
    t += h / total;
    times.push(t);
    splines.push('0 0 1 1');                                  // 머무는 칸
    if (i < holds.length - 1) { t += gap(i) / total; splines.push('0.4 0 0.2 1'); }
  });
  times[times.length - 1] = 1;
  const at = times.map((x) => +x.toFixed(4));
  return { keyTimes: at.join(';'), keySplines: splines.join(';'), at };
}

/** 컷마다 두 번씩 늘어놓는다 — timeline이 기대하는 꼴 */
const doubled = (v: string[]) => v.flatMap((x) => [x, x]);

function put(el: Element, tag: string, attrs: Record<string, string>) {
  const n = el.ownerDocument.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.setAttribute('repeatCount', 'indefinite');
  el.appendChild(n);
  return n;
}

/** 여러 컷을 이어 도는 값 하나 */
function animateSeq(el: Element, name: string, values: string[], t: ReturnType<typeof timeline>, dur: number) {
  put(el, 'animate', {
    attributeName: name, values: doubled(values).join(';'),
    keyTimes: t.keyTimes, keySplines: t.keySplines, calcMode: 'spline', dur: `${dur}s`
  });
}

/**
 * 여러 컷을 이어 도는 transform. 움직이는 자리만 골라 쌓는다.
 *
 * 항등인 자리는 빼도 결과가 같고, 빼야 요소 하나에 <animateTransform>이
 * 다섯씩 달리는 일을 면한다.
 */
function animateTransformSeq(el: Element, cuts: Array<Record<Slot, number[]> | null>, t: ReturnType<typeof timeline>, dur: number) {
  if (cuts.some((c) => !c)) return false;
  const live = SLOTS.filter((slot) =>
    cuts.some((c) => c![slot].join() !== IDENTITY[slot].join()));
  if (!live.length) return false;
  if (!live.some((slot) => new Set(cuts.map((c) => c![slot].join())).size > 1)) return false;
  el.removeAttribute('transform');
  live.forEach((slot, i) => {
    put(el, 'animateTransform', {
      attributeName: 'transform', type: slot,
      // 첫 자리가 바탕 값을 지우고, 나머지가 그 위에 얹힌다
      additive: i === 0 ? 'replace' : 'sum',
      values: doubled(cuts.map((c) => c![slot].map(r2).join(' '))).join(';'),
      keyTimes: t.keyTimes, keySplines: t.keySplines, calcMode: 'spline', dur: `${dur}s`
    });
  });
  return true;
}


/**
 * 두 목록을 나란히 걸어 짝을 짓는다.
 *
 * 세 컷을 이으려면 같은 걸음을 두 번 걸어야 해서(A↔B, B↔C) 함수로 뗐다.
 * 가운데 컷의 요소를 열쇠로 쓰면 두 걸음의 결과가 한 요소에서 만난다.
 */
/**
 * 한 칸이 아니라 열두 칸을 내다본다.
 *
 * 한 칸만 보던 때: 한쪽에만 끼어든 것이 **두 개 이상 잇달아** 나오면 그
 * 자리에서 두 목록의 박자가 어긋나고, 그 뒤로는 전혀 다른 것끼리 짝이 된다.
 * About 삽화에서 글자가 윤곽선 일곱 조각으로 바뀌자 바로 그 일이 났다 —
 * 짝이 18쌍에서 11쌍으로 줄었고, 엉뚱하게 짝지어진 빨간 인물의 눈이
 * 화면을 가로질러 미끄러졌다. 그림이 그렇게 그려진 것이 아니라 계산이
 * 자리를 잃은 것이었다.
 *
 * 열두 칸인 이유: 한쪽에만 있는 것이 잇달아 나오는 제일 긴 구간이 그
 * 글자 일곱 조각이다. 넉넉히 잡되 무한정 보지는 않는다 — 멀리 볼수록
 * 우연히 닮은 남남끼리 짝이 될 여지가 생긴다.
 */
const LOOKAHEAD = 12;

/** list의 start 다음 몇 칸째에 target의 짝이 있나. 없으면 -1 */
function ahead(list: Item[], start: number, target: Item, limit = list.length): number {
  for (let n = 1; n <= LOOKAHEAD && start + n < limit; n++) {
    if (pairs(list[start + n], target)) return n;
  }
  return -1;
}

/** 요소가 놓인 자리. 어느 무리에 속하는지 가를 때만 쓰므로 대충이면 된다 */
function boxOf(it: Item): { x: number; y: number; w: number; h: number } | null {
  const n = (a: string) => Number(it.el.getAttribute(a) ?? NaN);
  if (it.d) {
    const nums = it.d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k + 1 < nums.length; k += 2) {
      x0 = Math.min(x0, nums[k]); x1 = Math.max(x1, nums[k]);
      y0 = Math.min(y0, nums[k + 1]); y1 = Math.max(y1, nums[k + 1]);
    }
    return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }
  if (it.tag === 'circle') return { x: n('cx') - n('r'), y: n('cy') - n('r'), w: n('r') * 2, h: n('r') * 2 };
  if (it.tag === 'ellipse') return { x: n('cx') - n('rx'), y: n('cy') - n('ry'), w: n('rx') * 2, h: n('ry') * 2 };
  if (it.tag === 'rect') return { x: n('x') || 0, y: n('y') || 0, w: n('width'), h: n('height') };
  return null;
}

/**
 * 두 목록에서 **틀림없이 같은 것**의 자리를 먼저 못 박는다.
 *
 * <text>는 내용이 곧 이름이다 — '가'는 어느 컷에서나 '가' 하나뿐이다.
 * 차례로 걷는 방식은 두 문서의 순서가 대체로 같다는 데 기대는데,
 * 일러스트레이터는 컷마다 순서를 바꿔 내보낸다. 새 Step 2에서 '가'가
 * 첫 컷의 둘째에서 넷째 컷의 뒤에서 둘째로 갔고, 열두 칸을 내다봐도
 * 못 찾아 짝이 끊겼다 — 끊기면 '가'가 모양을 잇지 못하고 겹쳐 뜬다.
 *
 * 양쪽에서 딱 하나씩인 글자만 못이 된다. 둘 이상이면 어느 것이 어느
 * 것인지 알 수 없고, 엇갈리게 놓인 것(A에서는 앞, B에서는 뒤)도 버린다.
 */
function anchorsOf(ia: Item[], ib: Item[]): Array<[number, number]> {
  const seen = (l: Item[]) => {
    const m = new Map<string, number[]>();
    l.forEach((x, i) => {
      if (x.tag !== 'text' || !x.text) return;
      const at = m.get(x.text);
      if (at) at.push(i); else m.set(x.text, [i]);
    });
    return m;
  };
  const A = seen(ia), B = seen(ib);
  const found: Array<[number, number]> = [];
  for (const [k, at] of A) {
    const bt = B.get(k);
    if (at.length === 1 && bt && bt.length === 1) found.push([at[0], bt[0]]);
  }
  found.sort((x, y) => x[0] - y[0]);
  /* 두 목록에서 **모두** 앞뒤가 같은 것만 못이 된다. 앞에서부터 욕심내어
     고르면 안 된다 — 새 Step 2에서 '가'가 첫 컷의 둘째에서 넷째 컷의
     뒤에서 둘째로 갔는데, 그것을 먼저 박으면 나머지 셋('크기'·'빠르기'·
     '무게')이 전부 엇갈린 것으로 버려져 못이 하나만 남았다. 그 하나가
     목록 한쪽 끝이라 그 앞의 열아홉을 한 칸에 우겨넣었고, 잣대 손잡이가
     통째로 짝을 잃었다. 제일 긴 오름차순을 찾는다. */
  const best: number[] = [], from: number[] = [];
  for (let i = 0; i < found.length; i++) {
    from[i] = -1;
    let at = 0;
    for (let k = 0; k < best.length; k++) if (found[best[k]][1] < found[i][1]) at = k + 1;
    if (at) from[i] = best[at - 1];
    best[at] = i;
  }
  const keep: Array<[number, number]> = [];
  for (let i = best.length ? best[best.length - 1] : -1; i >= 0; i = from[i]) keep.unshift(found[i]);
  return keep;
}

function align(ia: Item[], ib: Item[]) {
  const pair = new Map<Element, Item>();          // ib 요소 → 짝이 된 ia 요소
  const onlyB: Item[] = [];                       // ib에만 있는 것
  const onlyA: Array<{ item: Item; before: Element | null }> = [];

  /** 못과 못 사이만 차례로 걷는다 */
  const walk = (i0: number, i1: number, j0: number, j1: number, after: Element | null) => {
    let i = i0, j = j0;
    while (i < i1 || j < j1) {
      const a = i < i1 ? ia[i] : undefined;
      const b = j < j1 ? ib[j] : undefined;
      if (a && b && pairs(a, b)) { pair.set(b.el, a); i++; j++; continue; }
      // 짝이 어긋났다. 어느 쪽에 끼어든 것인지 — 더 가까운 쪽이 끼어든 쪽이다.
      const da = a ? ahead(ib, j, a, j1) : -1;    // a의 짝이 B에서 몇 칸 뒤
      const db = b ? ahead(ia, i, b, i1) : -1;    // b의 짝이 A에서 몇 칸 뒤
      const before = b ? b.el : after;
      if (da >= 0 && (db < 0 || da <= db)) { onlyB.push(b!); j++; continue; }
      if (db >= 0) { onlyA.push({ item: a!, before }); i++; continue; }
      if (b) { onlyB.push(b); j++; }
      if (a) { onlyA.push({ item: a, before }); i++; }
    }
  };

  let i0 = 0, j0 = 0;
  for (const [ai, bi] of anchorsOf(ia, ib)) {
    walk(i0, ai, j0, bi, ib[bi].el);
    pair.set(ib[bi].el, ia[ai]);
    i0 = ai + 1; j0 = bi + 1;
  }
  walk(i0, ia.length, j0, ib.length, null);

  /* 짝을 못 지은 것들을 **자리로 한 번 더 건진다.**
     차례로 걷는 방식은 두 문서의 순서가 대체로 같다는 데 기댄다. 새 About
     에서 그 전제가 깨졌다 — 작가가 다시 내보내면서 빨간 인물이 문서 가운데
     에서 맨 뒤로 갔다. 걸음이 어긋나자 그 인물의 몸이 '둘째 컷에만 있는 것'
     으로 잘못 분류됐고, 구경꾼들과 함께 화면 밖에서 걸어 들어왔다.
     같은 태그·같은 색·같은 뼈대인데 **자리까지 겹치면** 같은 것이다. */
  if (onlyA.length && onlyB.length) {
    const taken = new Set<Item>();
    /* 못이 되지 못하고 남은 글자는 **내용으로** 건진다. 자리로 건지는
       아래 단계는 <text>에는 못 쓴다 — 글자의 겉넓이는 글꼴이 있어야
       나오는데 여기는 브라우저 밖이다. '가'가 이 길로 돌아온다. */
    for (let k = onlyA.length - 1; k >= 0; k--) {
      const a = onlyA[k].item;
      if (a.tag !== 'text' || !a.text) continue;
      const hit = onlyB.filter((b) => !taken.has(b) && pairs(a, b));
      if (hit.length !== 1) continue;
      taken.add(hit[0]);
      pair.set(hit[0].el, a);
      onlyA.splice(k, 1);
    }
    for (let k = onlyA.length - 1; k >= 0; k--) {
      const a = onlyA[k];
      const ab = boxOf(a.item);
      if (!ab) continue;
      let best: Item | null = null, near = Infinity;
      for (const b of onlyB) {
        if (taken.has(b) || !pairs(a.item, b)) continue;
        const bb = boxOf(b);
        if (!bb) continue;
        const d = Math.hypot(ab.x - bb.x, ab.y - bb.y) + Math.hypot(ab.w - bb.w, ab.h - bb.h);
        if (d < near) { near = d; best = b; }
      }
      // 화판의 10분의 1 안에 있어야 같은 것으로 본다. 그보다 멀면 남남이다.
      const span = Math.max(ab.w, ab.h, 1);
      if (!best || near > Math.max(span, 40)) continue;
      taken.add(best);
      pair.set(best.el, a.item);
      onlyA.splice(k, 1);
    }
    for (let k = onlyB.length - 1; k >= 0; k--) if (taken.has(onlyB[k])) onlyB.splice(k, 1);
  }
  return { pair, onlyB, onlyA };
}

/**
 * **시선의 중심**을 화면에 알려 준다. 화판은 건드리지 않는다.
 *
 * 2026-09-20에 한 번 반대로 했다 — 빈 자리를 잘라 내어 화판을 그림에 맞췄다.
 * 작가가 `Artboard size_*.pdf`를 주면서 그게 틀렸다는 게 드러났다. 그 PDF의
 * 페이지 크기가 정확히 390×603, 곧 **화판 자체가 의도한 화면**이다. 화판
 * 밖으로 나간 것(Step 2 구경꾼의 그림자는 x 468까지 간다)은 잘려야 하는
 * 것이지 끌어와 보여줄 것이 아니고, 화판 안의 빈 자리는 지울 여백이 아니라
 * 구도다.
 *
 * 그래서 자르는 일은 CSS가 맡고(.info-art), 여기서는 **어디를 가운데에
 * 두어야 하는지**만 백분율로 적어 보낸다. 그린 것들의 세로 한가운데다.
 * 소개 화면이 내주는 높이는 글의 길이와 기기에 따라 달라지므로, 얼마나
 * 잘릴지는 여기서 알 수 없다 — 잘려도 잃지 말아야 할 자리만 말해 준다.
 *
 * 컷 전부를 재는 이유: 움직이는 동안 자리를 옮기는 것이 있다. About의
 * 구경꾼은 오른쪽 밖에서 들어오고 Step 2의 '가'는 위아래로 다닌다.
 */
function focusOn(root: Element, items: Item[]) {
  const vb = (root.getAttribute('viewBox') ?? '').split(/[ ,]+/).map(Number);
  if (vb.length !== 4 || !vb[3]) return;
  let y0 = Infinity, y1 = -Infinity;
  for (const it of items) {
    const b = boxOf(it);
    if (!b || !Number.isFinite(b.y) || !Number.isFinite(b.h)) continue;
    if (b.w >= vb[2] * 0.99 && b.h >= vb[3] * 0.99) continue;   // 배경은 빼고 잰다
    y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y + b.h);
  }
  if (!Number.isFinite(y0) || y1 <= y0) return;
  // 화판 밖까지 뻗은 것은 화판 끝까지만 친다 — 어차피 잘리는 자리다
  y0 = Math.max(y0, vb[1]); y1 = Math.min(y1, vb[1] + vb[3]);
  const mid = ((y0 + y1) / 2 - vb[1]) / vb[3];
  addStyle(root, `--focus:${r2(mid * 100)}%`);
}

/**
 * 다른 컷의 요소를 이 문서로 옮겨 심는다.
 *
 * itemsOf는 querySelectorAll로 도형만 뽑아 오므로 그 위에 있던 <g>의 옷 —
 * clip-path·transform·mask — 이 통째로 벗겨진다. 벗은 채로 심으면 잘려
 * 있어야 할 것이 안 잘린다. Step 2의 마지막 컷에 그런 흰 사각형이 하나
 * 있었고, 옮겨 심자 글자를 통째로 덮어 버렸다. 조상을 껍데기만 복제해
 * 다시 입힌다(형제는 데려오지 않는다).
 */
function cloneInto(B: Element, el: Element, before: Element | null): Element {
  const coats: Element[] = [];
  for (let p = el.parentElement; p && p.tagName === 'g'; p = p.parentElement) coats.push(p);
  const copy = B.ownerDocument.importNode(el, true) as Element;
  let node: Element = copy;
  for (const coat of coats) {                    // 가까운 조상부터 바깥으로
    const g = B.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (const at of Array.from(coat.attributes)) g.setAttribute(at.name, at.value);
    g.appendChild(node);
    node = g;
  }
  if (before?.parentNode) before.parentNode.insertBefore(node, before);
  else B.appendChild(node);
  return copy;
}

/* 두 컷짜리 morphSvg와 세 컷짜리 chain3이 여기 있었다. 2026-09-20에 걷어냈다.
   chainSvg가 컷 몇이든 받고 왔던 길로 되짚어 돌아오므로, 둘이 하던 일을
   전부 한다 — 컷 둘을 주면 A→B→A다. 남겨 두면 엔진이 둘이 되고, 그러면
   그중 하나는 반드시 낡는다(tokens.css 머리말에 같은 이야기가 있다). */


/* ═══ 컷 여럿을 오가는 한 장 ═══════════════════════════════════════ */

/** 모양 말고도 오가야 하는 숫자들. font-size가 '크기' 축의 답이다 */
const NUM_ATTRS = [...SHAPE_ATTRS, 'font-size', 'stroke-width'];


/* 여기에 **걸어 들어오는 기계**가 있었다. 2026-09-20에 넣었다가 같은 날
   걷어냈다.

   홈을 걸어 다니는 그 캐릭터를 소개 화면에도 옮겨 붙인 것이었다 — 골격이
   정말 같다는 것까지 좌표로 확인했고(머리 지름 = 몸 너비, 그 비례로 뽑은
   배율로 발밑을 옮기면 작가가 그린 그림자 시작점과 소수점까지 맞는다),
   허리에서 몸을 잘라 홈의 다리를 갈아 끼우고 걸음의 박자로 몸을 흔들었다.

   잘 돌았지만 **소개 화면에는 필요 없는 일이었다.** 여기서 인물은 장면을
   설명하는 그림이지 살아 움직이는 배경이 아니다. 걸어 들어오는 데 두
   걸음이 드는 만큼 한 장을 읽는 시간이 길어졌고, 읽을 것은 그동안 기다린다.
   이제 인물은 처음부터 제자리에 서 있다.

   되살릴 일이 있으면 34315f3을 본다 — 다리 데이터 샘플링, 도착에서 멎게
   하는 시간표, 배율 반올림이 허리에 흰 선을 만들던 것까지 거기 다 있다.

   골격을 재는 조각(RIG · rigOf)은 남겼다. Step 2에서 잣대를 잡은 손을
   찾는 데 그대로 쓴다 — 인물의 머리와 그림자로 몸을 알아보는 일이다. */

/** 홈 캐릭터의 골격 치수(Character_walk_v3.svg의 화판에서) */
const RIG = { left: 17.13, width: 332.21, hipX: 183.23, hipY: 449, footY: 541.81 };

interface Rig { tx: number; ty: number; s: number; r: number; cx: number; cy: number }

/**
 * 이 동그라미가 누군가의 **머리**인가.
 *
 * 머리라면 몸 너비가 머리 지름과 같고, 그 비례로 정해지는 발밑 자리에
 * 그림자가 누워 있어야 한다. 그림자가 증거다 — 없으면 그냥 동그라미다.
 */
function rigOf(head: Item, all: Item[]): Rig | null {
  if (head.tag !== 'circle') return null;
  const n = (a: string) => Number(head.el.getAttribute(a));
  const r = n('r'), cx = n('cx'), cy = n('cy');
  if (!r || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const s = (2 * r) / RIG.width;
  const tx = cx - r - RIG.left * s, ty = cy - r;
  const foot = ty + RIG.footY * s;
  const shadow = all.some((it) => {
    if (it === head) return false;
    const b = boxOf(it);
    // 발밑에 납작하게 누운 것. 몸보다 넓고 머리보다 얇다.
    return !!b && Math.abs(b.y + b.h / 2 - foot) < Math.max(1.5, r * 0.08)
      && b.w > r && b.h < r * 0.8;
  });
  return shadow ? { tx, ty, s, r, cx, cy } : null;
}

/** 제 변환까지 먹인 한가운데. 잣대 손잡이는 돌려서 놓여 있어 bbox만으로는 모자란다 */
function centreOf(it: Item): [number, number] | null {
  const b = boxOf(it);
  if (!b) return null;
  const c: [number, number] = [b.x + b.w / 2, b.y + b.h / 2];
  const tf = transformOf(it.el);
  if (!tf) return c;
  const r = (tf.rotate[0] * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
  const x = c[0] * tf.scale[0], y = c[1] * tf.scale[1];
  return [tf.translate[0] + x * co - y * si, tf.translate[1] + x * si + y * co];
}





/* ═══ 폰을 홈에 꽂기 ═══════════════════════════════════════════════════
   작가는 폰과 홈을 **같은 네모 하나**로 그렸다. 손에 들렸을 때는 검정으로
   세워 두고, 홈에 들어가면 기기의 빨강으로 눕혀 둔다(재서 확인: 셋 다
   42.16×13.21, 컷 2만 #0d0d0d이고 자세가 90도 다르다).

   색이 다르면 짝이 되지 않는다. 그냥 두면 손의 검은 폰이 사라지고 홈의
   빨간 네모가 나타나 — 자세가 270도 떨어져 있어서 **한 바퀴 도는 것처럼**
   읽힌다. 하나로 묶어 짧은 쪽으로 90도만 돌린다. 손목이 도는 만큼이다.

   꽂는 것은 두 걸음이다. 홈에 **맞춰 대고**(돌리며 이동), 그다음 **그대로
   밀어 넣는다**(돌지 않고 제 축으로만). 밀려 들어간 만큼은 오려 내어
   가린다 — 기기 뒤로 보내지 않는 이유는, 손에 들려 있는 동안에는 폰이
   사람보다 앞이어야 하기 때문이다.

   색은 들어가는 그 순간에 바뀐다. 손에 있을 때 검정, 꽂히면 빨강. */

/** 밀어 넣는 깊이 — 폰 길이에 대한 비율 */
const DOCK_DEEP = 0.55;
/**
 * 손이 폰을 따라가는 몫.
 *
 * 작가의 손은 몸통 옆에 붙은 작은 혹이다 — 팔이 아니라서 멀리 못 간다.
 * 절반(0.5)을 줬더니 폰을 따라 몸에서 **떨어져 나가** 허공에 동그라미가
 * 하나 떴다. 폰이 가는 거리의 6분의 1쯤이면 팔을 뻗는 것으로 읽히고
 * 몸에서는 안 떨어진다.
 */
const HAND_FOLLOW = 0.17;

/**
 * 손에 든 폰을 홈에 꽂는다.
 *
 * @param home 기기 쪽 자세(작가가 홈에 눕혀 둔 것) — 이 요소가 폰이 된다
 * @param held 손에 든 자세(다른 컷에 있던 같은 네모)
 * @param hand 함께 움직일 손. 없으면 폰만 간다
 * @param at   손에 들려 있는 컷 번호들
 */
function dockPhone(root: Element, home: Item, held: Item, hand: Item | null,
  order: number[], at: Set<number>, t: { at: number[] }, dur: number) {
  const A = transformOf(home.el), B = transformOf(held.el);
  const box = boxOf(home);
  if (!A || !B || !box || t.at.length < 10) return false;

  /* 돌아가는 길을 짧은 쪽으로. 102도에서 -168도로 가면 270도를 도는데,
     같은 자세인 192도로 적으면 90도만 돌면 된다. */
  let turn = A.rotate[0];
  while (turn - B.rotate[0] > 180) turn -= 360;
  while (turn - B.rotate[0] < -180) turn += 360;

  /* 네모의 한가운데. translate와 rotate는 **따로** 보간되므로, 자세가
     도는 동안 translate만 곧게 이으면 네모의 한가운데가 엉뚱한 호를 그린다
     (재서 확인: 손 (169,490)에서 홈 (192,481)로 가는데 중간이 (103,437)
     이었다 — 화면 왼쪽 위로 크게 튀어 나갔다).
     그래서 **한가운데를 곧게 끌고**, 자세는 그 한가운데를 지키도록 매
     걸음마다 거꾸로 계산해 넣는다. */
  const c: [number, number] = [box.x + box.w / 2, box.y + box.h / 2];
  const at2 = (deg: number, mid: [number, number]): [number, number] => {
    const r = (deg * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
    return [mid[0] - (c[0] * co - c[1] * si), mid[1] - (c[0] * si + c[1] * co)];
  };
  const midOf = (tr: number[], deg: number): [number, number] => {
    const r = (deg * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
    return [tr[0] + c[0] * co - c[1] * si, tr[1] + c[0] * si + c[1] * co];
  };

  const held0 = midOf(B.translate, B.rotate[0]);     // 손에 들린 한가운데
  const slot = midOf(A.translate, turn);             // 홈에 댄 한가운데
  // 꽂히는 축 = 네모의 긴 축. 그 방향으로 제 길이의 절반쯤 들어간다.
  const long = Math.max(box.w, box.h);
  const rad = (turn * Math.PI) / 180;
  const deep: [number, number] = [slot[0] - Math.cos(rad) * long * DOCK_DEEP,
    slot[1] - Math.sin(rad) * long * DOCK_DEEP];

  const xy = (v: number[]) => `${r2(v[0])} ${r2(v[1])}`;
  const rot = (deg: number) => `${r2(deg)} ${r2(A.rotate[1])} ${r2(A.rotate[2])}`;

  /** 한가운데와 자세를 곧게 이으며 여러 걸음으로 나눈다 */
  const STEPS = 6;
  const times: number[] = [], moves: string[] = [], turns: string[] = [], hands: string[] = [];
  const add = (time: number, mid: [number, number], deg: number) => {
    times.push(time);
    moves.push(xy(at2(deg, mid)));
    turns.push(rot(deg));
    hands.push(xy([(mid[0] - held0[0]) * HAND_FOLLOW, (mid[1] - held0[1]) * HAND_FOLLOW]));
  };
  const glide = (t0: number, t1: number, m0: [number, number], m1: [number, number], d0: number, d1: number, from = 1) => {
    for (let i = from; i <= STEPS; i++) {
      const u = i / STEPS;
      add(t0 + (t1 - t0) * u, [m0[0] + (m1[0] - m0[0]) * u, m0[1] + (m1[1] - m0[1]) * u], d0 + (d1 - d0) * u);
    }
  };

  const k = t.at;
  const align = k[3] + (k[4] - k[3]) * 0.55;       // 홈에 맞춰 대기까지
  const pull = k[5] + (k[6] - k[5]) * 0.45;        // 되돌아 빼내기
  add(k[0], held0, B.rotate[0]);
  add(k[1], held0, B.rotate[0]);
  add(k[2], held0, B.rotate[0]);
  add(k[3], held0, B.rotate[0]);
  glide(k[3], align, held0, slot, B.rotate[0], turn);      // ① 맞춰 댄다
  add(k[4], deep, turn);                                   // ② 그대로 밀어 넣는다
  add(k[5], deep, turn);
  add(pull, slot, turn);                                   // 빼낸다
  glide(pull, k[6], slot, held0, turn, B.rotate[0]);       // 손으로 되돌아온다
  add(k[7], held0, B.rotate[0]);
  add(k[8], held0, B.rotate[0]);
  add(1, held0, B.rotate[0]);

  const kt = times.map((x) => r2(x)).join(';');
  const put3 = (el: Element, tag: string, attrs: Record<string, string>, keyTimes = kt, n = times.length) => {
    const node = el.ownerDocument.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, v] of Object.entries(attrs)) node.setAttribute(key, v);
    node.setAttribute('keyTimes', keyTimes);
    node.setAttribute('calcMode', 'spline');
    node.setAttribute('keySplines', Array(n - 1).fill('0.4 0 0.2 1').join(';'));
    node.setAttribute('dur', `${dur}s`);
    node.setAttribute('repeatCount', 'indefinite');
    el.appendChild(node);
  };

  home.el.removeAttribute('transform');
  home.el.setAttribute('fill', held.fill);
  put3(home.el, 'animateTransform', { attributeName: 'transform', type: 'translate', values: moves.join(';') });
  put3(home.el, 'animateTransform', { attributeName: 'transform', type: 'rotate', additive: 'sum', values: turns.join(';') });

  /* 폰은 사람의 것이다. 사람이 오기 전에는 없다. 걸어 들어오는 동안
     반투명하면 스며 나온 것이 되므로 걸음이 시작되는 자리에서 한 번에 켠다. */
  const first = Math.min(...[...at]);
  const gone = order.map((cut, i) => (cut < first && !at.has(cut) ? i : -1)).filter((i) => i >= 0);
  put3(home.el, 'animate', { attributeName: 'opacity', values: '0;0;1;1;0' },
    `0;${r2(k[1])};${r2(Math.min(k[1] + 0.01, k[2]))};${r2(k[gone.length ? gone[gone.length - 1] * 2 : 8])};1`, 5);

  /* 색은 꽂히는 순간에 바뀐다. 손에 있을 때 검정, 홈에 들어가면 기기의 빨강. */
  put3(home.el, 'animate', { attributeName: 'fill', values: `${held.fill};${held.fill};${home.fill};${home.fill};${held.fill}` },
    `0;${r2(align)};${r2(k[4])};${r2(pull)};1`, 5);

  /* 들어간 만큼 가린다. 홈에 다 댔을 때의 앞 끝에 벽을 세우고 그 앞쪽만
     남긴다 — 밀려 들어갈수록 벽을 넘은 부분이 사라진다. */
  const tip = slot[0] + Math.abs(Math.cos(rad)) * long * 0.5;
  const doc = root.ownerDocument;
  const NS = 'http://www.w3.org/2000/svg';
  const clip = doc.createElementNS(NS, 'clipPath');
  const id = `mf-slot-${r2(Math.abs(tip))}`;
  clip.setAttribute('id', id);
  clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
  const wall = doc.createElementNS(NS, 'rect');
  wall.setAttribute('x', r2(tip - 4000) + '');
  wall.setAttribute('y', '-4000');
  wall.setAttribute('width', '4000');
  wall.setAttribute('height', '8000');
  clip.appendChild(wall);
  (root.querySelector('defs') ?? root.insertBefore(doc.createElementNS(NS, 'defs'), root.firstChild)).appendChild(clip);
  home.el.setAttribute('clip-path', `url(#${id})`);

  // 손은 폰과 함께 간다. 팔이 늘어나는 만큼이라 절반쯤이다.
  if (hand) {
    put3(hand.el, 'animateTransform', {
      attributeName: 'transform', type: 'translate', additive: 'sum', values: hands.join(';')
    });
  }
  return true;
}

/**
 * 컷 여럿을 1 → 2 → … → N → … → 2 → 1 로 오가는 한 장.
 *
 * 세 컷짜리(chain3)는 첫 컷으로 **되돌아가지 않고 건너뛴다** — A→B→C→A다.
 * 새 Step 2은 그러면 안 된다. 잣대 손잡이가 끝까지 갔다가 시작으로 순간
 * 이동하면, 보여주려는 것("손잡이를 움직이면 글자가 따라 바뀐다")이 바로
 * 그 순간에 거짓이 된다. 왔던 길을 되짚어 돌아온다.
 *
 * 첫 컷을 바탕 문서로 삼고 나머지 컷을 거기에 맞춰 세운다. 컷이 넷이라
 * 가운데를 축으로 삼을 수가 없어서다(chain3은 B가 축이었다).
 *
 * 되돌아서는 두 컷(처음과 끝)에 머무는 몫을 더 준다 — 거기서 안 쉬면
 * 방향이 바뀌는 것이 아니라 튕겨 나온 것으로 보인다.
 */
export function chainSvg(raws: string[], key: string, dur = 11): string {
  if (typeof DOMParser === 'undefined' || raws.length < 2) return scopeSvg(raws[0], key);
  try {
    const cuts = raws.map((r) => new DOMParser().parseFromString(r, 'image/svg+xml').documentElement);
    if (cuts.some((c) => !c.getAttribute('viewBox'))) return scopeSvg(raws[0], key);
    cuts.forEach(inlineFills);
    const base = cuts[0];
    const items = cuts.map(itemsOf);
    const n = cuts.length;

    /** 오가는 차례: 0,1,…,n-1,n-2,…,0 */
    const order: number[] = [];
    for (let k = 0; k < n; k++) order.push(k);
    for (let k = n - 2; k >= 0; k--) order.push(k);
    /* 첫 구간과 마지막 구간을 길게 준다. 거기서 사람이 걸어 들어오고
       나가기 때문이다(Step 3). 걸음이 짧으면 미끄러진 것으로 보인다.
       사람이 없는 장(Step 2)에서는 그저 첫 전환이 조금 느긋해질 뿐이다. */
    const moves = order.slice(1).map((_, i) => (i === 0 || i === order.length - 2 ? 5 : 2));
    const t = timeline(order.map((k) => (k === 0 || k === n - 1 ? 3 : 1)), moves);

    // 첫 컷의 요소 → 컷마다의 짝
    const of: Array<Map<Element, Item>> = cuts.map(() => new Map());
    items[0].forEach((x) => of[0].set(x.el, x));
    /** 첫 컷에 없던 것. 같은 것이 여러 컷에 나오면 한 번만 심는다 */
    const guests = new Map<string, { item: Item; at: Set<number> }>();
    for (let k = 1; k < n; k++) {
      const w = align(items[0], items[k]);
      for (const [el, a] of w.pair) {
        const it = items[k].find((x) => x.el === el);
        if (it) of[k].set(a.el, it);
      }
      for (const x of w.onlyB) {
        const id = [x.tag, x.fill, x.shape, x.el.getAttribute('transform') ?? ''].join('|');
        const had = guests.get(id);
        if (had) had.at.add(k); else guests.set(id, { item: x, at: new Set([k]) });
      }
    }

    let moved = 0;
    /* 잣대 손잡이가 컷마다 얼마나 옮겨 갔는지 모아 둔다 — 그 손잡이를
       잡고 있는 손이 같은 박자로 따라가야 하기 때문이다(아래 handOn). */
    const drag: Array<[number, number]> = order.map(() => [0, 0]);
    let draggers = 0;
    for (const a of items[0]) {
      const per = order.map((k) => of[k].get(a.el));
      /* 그 컷에 없으면 제일 가까운 컷의 모습을 빌려 온다 — 물러나 있는
         동안에도 모양이 이어져야 다시 나타날 때 튀지 않는다 */
      const near = (i: number): Item => {
        for (let d = 0; d < per.length; d++) {
          const l = per[(i - d + per.length) % per.length];
          if (l) return l;
          const r = per[(i + d) % per.length];
          if (r) return r;
        }
        return a;
      };
      if (per.some((x) => !x)) animateSeq(a.el, 'opacity', per.map((x) => (x ? '1' : '0')), t, dur);
      const ds = per.map((x, i) => (x ?? near(i)).d);
      if (ds.every((d) => d !== null) && new Set(ds).size > 1) {
        animateSeq(a.el, 'd', ds as string[], t, dur); moved++;
      } else {
        for (const at of NUM_ATTRS) {
          const vs = per.map((x, i) => (x ?? near(i)).el.getAttribute(at));
          if (vs.every((v) => v !== null) && new Set(vs).size > 1) {
            animateSeq(a.el, at, vs as string[], t, dur); moved++;
          }
        }
      }
      if (animateTransformSeq(a.el, per.map((x, i) => transformOf((x ?? near(i)).el)), t, dur)) moved++;

      // 손잡이 = 컷마다 자리를 옮기는 작은 네모
      const ab = boxOf(a);
      if (a.tag !== 'rect' || !ab || Math.max(ab.w, ab.h) > 26) continue;
      const c0 = centreOf(a);
      if (!c0) continue;
      const cs = per.map((x, i) => centreOf(x ?? near(i)) ?? c0);
      if (!cs.some((c) => Math.hypot(c[0] - c0[0], c[1] - c0[1]) > 0.5)) continue;
      draggers++;
      cs.forEach((c, i) => { drag[i][0] += c[0] - c0[0]; drag[i][1] += c[1] - c0[1]; });
    }

    /* ── 잣대를 잡은 손 ─────────────────────────────────────────────
       Step 2는 캐릭터가 제 발화를 **직접 다듬는** 장면이다. 손이 가만히
       있으면 잣대가 저절로 움직이는 것으로 보인다. 손잡이들이 옮겨 간
       평균만큼, 같은 시간표 위에서 손도 따라간다 — 따로 흔드는 것이 아니라
       잣대·글자와 한 박자로 움직여야 '내가 만지고 있다'가 된다.

       손은 몸통 옆에 붙은 작은 혹이라 멀리 못 간다. 제일 크게 옮겨 간
       컷에서 머리 반지름의 5분의 1쯤 움직이도록 몫을 맞춘다. */
    if (draggers) {
      const far = Math.max(...drag.map((d) => Math.hypot(d[0], d[1]) / draggers));
      for (const head of items[0]) {
        const rg = rigOf(head, items[0]);
        if (!rg || far < 0.01) continue;
        const nub = items[0]
          .map((x) => ({ x, c: centreOf(x), b: boxOf(x) }))
          .filter((o) => o.x.tag === 'circle' && o.c && o.b && o.b.w < rg.r
            && Math.hypot(o.c[0] - rg.cx, o.c[1] - rg.cy) > rg.r)
          .sort((m, n) => Math.hypot(m.c![0] - rg.cx, m.c![1] - rg.cy) - Math.hypot(n.c![0] - rg.cx, n.c![1] - rg.cy))[0];
        if (!nub) continue;
        const k = (rg.r * 0.2) / far / draggers;
        put(nub.x.el, 'animateTransform', {
          attributeName: 'transform', type: 'translate', additive: 'sum',
          values: doubled(drag.map((d) => `${r2(d[0] * k)} ${r2(d[1] * k)}`)).join(';'),
          keyTimes: t.keyTimes, keySplines: t.keySplines, calcMode: 'spline', dur: `${dur}s`
        });
      }
    }
    if (!moved) { markEyes(base); return scopeSvg(new XMLSerializer().serializeToString(base), key); }

    // 다른 컷에만 있는 것은 바탕 문서에 없다. 옮겨 심고 있는 구간에만 켠다.
    const defs = base.querySelector('defs') ?? base.insertBefore(
      base.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'defs'), base.firstChild);
    for (const c of cuts.slice(1)) {
      const d = c.querySelector('defs');
      if (d) Array.from(d.children).forEach((x) => { if (x.tagName !== 'style') defs.appendChild(x.cloneNode(true)); });
    }
    const planted: Array<{ it: Item; at: Set<number> }> = [];
    for (const g of guests.values()) {
      const copy = cloneInto(base, g.item.el, null);
      planted.push({ it: itemOf(copy), at: g.at });
    }
    const rest = [...planted];

    /* 사람은 걸어 들어오지 않는다 — 제 컷이 오면 그 자리에 서 있다
       (2026-09-20에 걸음을 걷어냈다). 폰만은 손에서 홈으로 옮겨 가야 하므로
       아래에서 따로 다룬다. */
    /* 색만 다르고 덩치가 같은 짝이 있으면 **같은 물건이 색을 갈아입은
       것**이다. 손의 검은 폰과 홈의 빨간 네모가 그렇다. 하나로 묶어 꽂는다.
       사람을 세운 **뒤에** 찾는다 — 먼저 찾으면 함께 움직일 손을 첫 컷에서
       고르게 되는데, 거기엔 사람이 없어서 메가폰트의 눈이 손으로 뽑혔다. */
    for (const g of [...rest]) {
      const gb = boxOf(g.it);
      if (g.it.tag === 'path' || !gb) continue;
      const twin = items[0].find((x) => x.tag === g.it.tag && x.size === g.it.size
        && x.fill !== g.it.fill
        && (x.el.getAttribute('transform') ?? '') !== (g.it.el.getAttribute('transform') ?? ''));
      if (!twin) continue;
      // 함께 움직일 손 = 걸어 들어온 사람의 조각 가운데 폰에 제일 가까운 작은 동그라미
      const hand = planted
        .map((x) => ({ x: x.it, b: boxOf(x.it) }))
        .filter((o) => o.x.tag === 'circle' && o.b && o.b.w < gb.w * 1.2)
        .sort((m, n) => Math.hypot(m.b!.x - gb.x, m.b!.y - gb.y) - Math.hypot(n.b!.x - gb.x, n.b!.y - gb.y))[0];
      if (!dockPhone(base, twin, g.it, hand?.x ?? null, order, g.at, t, dur)) continue;
      g.it.el.parentNode?.removeChild(g.it.el);
      const i = rest.indexOf(g);
      if (i >= 0) rest.splice(i, 1);
      break;
    }

    for (const { it, at } of rest) {
      animateSeq(it.el, 'opacity', order.map((k) => (at.has(k) ? '1' : '0')), t, dur);
    }

    focusOn(base, items.flat());
    markEyes(base);
    return scopeSvg(new XMLSerializer().serializeToString(base), key);
  } catch {
    return scopeSvg(raws[0], key);
  }
}

/**
 * About — 한 장면이 세 걸음으로 지어진다.
 *
 *   ① 불빛이 켜진다   ② '내 생각은…'이 뜬다   ③ 구경꾼들이 들어와 본다
 *
 * 작가가 준 것은 두 컷이다: 불만 켜진 것과 다 있는 것. 가운데 걸음(문구만
 * 있고 사람은 없는 상태)은 그림에 없어서 **둘째 컷을 쪼개** 만든다 —
 * 벽면 안쪽에 든 것은 문구, 그 아래에 선 것은 사람이다.
 *
 * 첫 걸음의 '켜진다'도 그림에 없다. 불빛(방사형 그라디언트)을 꺼 두고
 * 시작해 밝기로 켠다 — 어두운 벽이 먼저 있고 거기 불이 들어오는 것이
 * 이 장면의 첫 문장이라서.
 *
 * 사람은 밝기로 나타나지 않고 **화면 밖에서 걸어 들어온다.** 둘 다 화판
 * 오른쪽에 서므로 오른쪽 밖에서 온다. 나갈 때는 같은 길로 물러난다 —
 * 한 바퀴가 곧 '벽이 켜지고 사람이 모였다 흩어지는' 하룻밤이다.
 */
export function aboutSvg(litRaw: string, fullRaw: string, key: string, dur = 12): string {
  if (typeof DOMParser === 'undefined') return scopeSvg(fullRaw, key);
  try {
    const parse = (x: string) => new DOMParser().parseFromString(x, 'image/svg+xml').documentElement;
    const A = parse(litRaw), B = parse(fullRaw);
    const vb = (B.getAttribute('viewBox') ?? '').split(/[ ,]+/).map(Number);
    if (!A.getAttribute('viewBox') || vb.length !== 4) return scopeSvg(fullRaw, key);
    inlineFills(A); inlineFills(B);
    const ia = itemsOf(A), ib = itemsOf(B);
    const w = align(ia, ib);

    /* 벽면 = 화판을 다 덮지 않는 제일 큰 사각형. 문구는 그 안에 들고
       사람은 그 아래에 선다 — 둘을 가르는 선이 이것이다. */
    let wall: { x: number; y: number; w: number; h: number } | null = null;
    for (const it of ib) {
      const b = it.tag === 'rect' ? boxOf(it) : null;
      if (!b || b.w >= vb[2] * 0.99) continue;
      if (!wall || b.w * b.h > wall.w * wall.h) wall = b;
    }

    /* 다섯 걸음: 어둠 · 불빛 · 문구 · 사람 · (도로 어둠)
       사람이 들어오는 구간(셋째)만 길게 준다 — 걸어 들어오는 데 두 걸음은
       있어야 걸음으로 읽힌다. 짧으면 미끄러져 들어온 것이 된다. */
    const t = timeline([1, 2, 2, 5, 1], [2, 2, 5, 2]);
    const say = (el: Element, v: string[]) => animateSeq(el, 'opacity', v, t, dur);

    // ① 불빛 — 그라디언트를 쓰는 것이 불빛이다
    let lamps = 0;
    for (const it of ib) {
      if (!/^url\(/.test(it.fill)) continue;
      say(it.el, ['0', '1', '1', '1', '0']);
      lamps++;
    }

    // 두 컷에 다 있는 것은 그대로 서 있되, 달라진 만큼만 움직인다
    for (const [bEl, a] of w.pair) {
      const b = ib.find((x) => x.el === bEl);
      if (!b) continue;
      if (a.d && b.d && a.d !== b.d) animateSeq(b.el, 'd', [a.d, a.d, b.d, b.d, a.d], t, dur);
      else for (const at of NUM_ATTRS) {
        const x = a.el.getAttribute(at), y = b.el.getAttribute(at);
        if (x !== null && y !== null && x !== y) animateSeq(b.el, at, [x, x, y, y, x], t, dur);
      }
    }

    // ②③ 둘째 컷에만 있는 것을 벽 안팎으로 가른다
    const inWall = (it: Item) => {
      const b = boxOf(it);
      if (!b || !wall) return false;
      const cy = b.y + b.h / 2;
      return cy > wall.y && cy < wall.y + wall.h;
    };
    // 벽면 안에 든 것만 밝기로 뜬다. 바깥에 선 사람은 처음부터 거기 있다.
    for (const it of w.onlyB.filter(inWall)) say(it.el, ['0', '0', '1', '1', '0']);

    /* ③ 사람은 제일 오른쪽 끝보다 더 오른쪽에서 들어온다. 화판 밖으로
       완전히 나가야 가장자리에서 반쯤 잘린 채로 기다리지 않는다. */
    /* 구경꾼은 **처음부터 거기 서 있다.** 오른쪽 밖에서 걸어 들어오게
       해 뒀었는데(2026-09-20), 들어오는 데 드는 두 걸음만큼 한 장을 읽는
       시간이 길어졌다. 소개 화면의 인물은 장면을 설명하는 그림이지 살아
       움직이는 배경이 아니다. 밝기도 자리도 건드리지 않는다. */

    if (!lamps && !w.onlyB.length) return scopeSvg(fullRaw, key);

    focusOn(B, [...ia, ...ib]);
    markEyes(B);
    return scopeSvg(new XMLSerializer().serializeToString(B), key);
  } catch {
    return scopeSvg(fullRaw, key);
  }
}
