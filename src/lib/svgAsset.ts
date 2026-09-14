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
  const out: string[] = [];
  const num = () => Number(t[i++]);
  const to = (x: number, y: number, c: 'M' | 'L') => { out.push(`${c}${r2(x)},${r2(y)}`); cx = x; cy = y; };
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
      case 'C': {
        const a = num(), b = num(), c = num(), e = num(), x = num(), y = num();
        out.push(`C${r2(a)},${r2(b)} ${r2(c)},${r2(e)} ${r2(x)},${r2(y)}`); cx = x; cy = y; break;
      }
      case 'c': {
        const x0 = cx, y0 = cy;
        const a = x0 + num(), b = y0 + num(), c = x0 + num(), e = y0 + num(), x = x0 + num(), y = y0 + num();
        out.push(`C${r2(a)},${r2(b)} ${r2(c)},${r2(e)} ${r2(x)},${r2(y)}`); cx = x; cy = y; break;
      }
      case 'Z': case 'z': out.push('Z'); cx = sx; cy = sy; break;
      default: return null;
    }
  }
  return out.join('');
}

/** 명령 글자만 남긴 것. 이게 같아야 브라우저가 보간한다 */
const shapeOf = (d: string) => d.replace(/[^A-Z]/g, '');

/**
 * <style>의 .cls-N 을 각 요소의 fill 속성으로 옮기고 style을 없앤다.
 *
 * 규칙 하나에 선택자가 여럿 묶여 나온다: `.cls-3, .cls-4 { fill: #fff }`.
 * 앞의 하나만 집으면 뒤에 묶인 것들이 색을 못 받아 검정으로 떨어진다 —
 * About의 눈 흰자와 벽에 켜지는 글자가 그렇게 검어졌다. 쉼표로 끊어 전부 준다.
 */
function inlineFills(root: Element) {
  const css = root.querySelector('style')?.textContent ?? '';
  const table: Record<string, string> = {};
  for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const f = rule[2].match(/fill:\s*([^;}]+)/);
    if (!f) continue;
    for (const sel of rule[1].split(',')) {
      const c = sel.trim().match(/^\.([\w-]+)$/);
      if (c) table[c[1]] = f[1].trim();
    }
  }
  root.querySelectorAll('[class]').forEach((el) => {
    const f = table[el.getAttribute('class')!];
    if (f) el.setAttribute('fill', f);
    el.removeAttribute('class');
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
      b.el.setAttribute('style', `animation-delay:${delay.toFixed(2)}s`);
    }
  });
}
/** 모양이 숫자로 적혀 있는 요소들. 이 속성들만 오간다 */
const SHAPE_ATTRS = ['cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2'];

interface Item { el: Element; tag: string; fill: string; d: string | null; shape: string }

/**
 * <defs> 안쪽은 그리는 것이 아니라 **도구**다 — clipPath의 사각형은 오려낼
 * 틀이지 화면에 나오는 사각형이 아니다. querySelectorAll은 그 둘을 구분하지
 * 못해서, Step 1의 clipPath 안에 든 흰 사각형이 도형으로 잡혀 다른 컷으로
 * 옮겨 심어졌고 글자를 통째로 덮었다.
 */
const INSIDE_DEFS = 'defs,clipPath,mask,pattern,marker,symbol';

function itemsOf(root: Element): Item[] {
  return Array.from(root.querySelectorAll(DRAWN)).filter((el) => !el.closest(INSIDE_DEFS)).map((el) => {
    const d = el.tagName === 'path' ? normalizeD(el.getAttribute('d') ?? '') : null;
    return {
      el,
      tag: el.tagName,
      fill: (el.getAttribute('fill') ?? '').toLowerCase(),
      d,
      shape: d ? shapeOf(d) : SHAPE_ATTRS.map((a) => el.getAttribute(a) ?? '').join(',')
    };
  });
}

/** 같은 것으로 볼 수 있는 한 쌍인가 — 태그·색·뼈대가 모두 같아야 한다 */
const pairs = (a: Item, b: Item) =>
  a.tag === b.tag && a.fill === b.fill &&
  (a.d !== null && b.d !== null ? shapeOf(a.d) === shapeOf(b.d) : a.tag !== 'path');

/**
 * 세 컷을 이어 도는 값. 컷마다 머물렀다 다음으로 간다.
 *
 *   0 ─ 0.08 ── 0.28 ─ 0.42 ── 0.62 ─ 0.76 ──── 1
 *   [ A 머묾 ][ A→B ][ B 머묾 ][ B→C ][ C 머묾 ][ C→A ]
 *
 * 마지막 구간이 긴 것은 C에서 A로 돌아가는 길이 두 칸을 건너뛰기 때문이다 —
 * 앞의 두 전환과 같은 시간을 주면 그 한 번만 두 배로 빨라 보인다.
 */
function animate3(el: Element, name: string, a: string, b: string, c: string, dur: number) {
  const n = el.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'animate');
  n.setAttribute('attributeName', name);
  n.setAttribute('values', `${a};${a};${b};${b};${c};${c};${a}`);
  n.setAttribute('keyTimes', '0;0.08;0.28;0.42;0.62;0.76;1');
  n.setAttribute('calcMode', 'spline');
  n.setAttribute('keySplines', '0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1');
  n.setAttribute('dur', `${dur}s`);
  n.setAttribute('repeatCount', 'indefinite');
  el.appendChild(n);
}

function animate(el: Element, name: string, values: string, dur: number) {
  const a = el.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'animate');
  a.setAttribute('attributeName', name);
  a.setAttribute('values', values);
  a.setAttribute('keyTimes', '0;0.12;0.45;0.78;1');
  // 양 끝에서 한 번씩 머문다. 쉬지 않고 오가면 삽화가 아니라 깜빡이가 된다.
  a.setAttribute('calcMode', 'spline');
  a.setAttribute('keySplines', '0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1');
  a.setAttribute('dur', `${dur}s`);
  a.setAttribute('repeatCount', 'indefinite');
  el.appendChild(a);
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
function ahead(list: Item[], start: number, target: Item): number {
  for (let n = 1; n <= LOOKAHEAD && start + n < list.length; n++) {
    if (pairs(list[start + n], target)) return n;
  }
  return -1;
}

function align(ia: Item[], ib: Item[]) {
  let i = 0, j = 0;
  const pair = new Map<Element, Item>();          // ib 요소 → 짝이 된 ia 요소
  const onlyB: Item[] = [];                       // ib에만 있는 것
  const onlyA: Array<{ item: Item; before: Element | null }> = [];
  while (i < ia.length || j < ib.length) {
    const a = ia[i], b = ib[j];
    if (a && b && pairs(a, b)) { pair.set(b.el, a); i++; j++; continue; }
    // 짝이 어긋났다. 어느 쪽에 끼어든 것인지 — 더 가까운 쪽이 끼어든 쪽이다.
    const da = a ? ahead(ib, j, a) : -1;          // a의 짝이 B에서 몇 칸 뒤
    const db = b ? ahead(ia, i, b) : -1;          // b의 짝이 A에서 몇 칸 뒤
    if (da >= 0 && (db < 0 || da <= db)) { onlyB.push(b!); j++; continue; }
    if (db >= 0) { onlyA.push({ item: a!, before: b ? b.el : null }); i++; continue; }
    if (b) { onlyB.push(b); j++; }
    if (a) { onlyA.push({ item: a, before: b ? b.el : null }); i++; }
  }
  return { pair, onlyB, onlyA };
}

/**
 * 다른 컷의 요소를 이 문서로 옮겨 심는다.
 *
 * itemsOf는 querySelectorAll로 도형만 뽑아 오므로 그 위에 있던 <g>의 옷 —
 * clip-path·transform·mask — 이 통째로 벗겨진다. 벗은 채로 심으면 잘려
 * 있어야 할 것이 안 잘린다. Step 1의 마지막 컷에 그런 흰 사각형이 하나
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

/** 절대좌표로 편 d에서 대충의 크기. 화판 대비 얼마나 큰가만 보면 된다 */
function dExtent(d: string | null): { w: number; h: number } {
  if (!d) return { w: 0, h: 0 };
  const n = d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let k = 0; k + 1 < n.length; k += 2) {
    x0 = Math.min(x0, n[k]); x1 = Math.max(x1, n[k]);
    y0 = Math.min(y0, n[k + 1]); y1 = Math.max(y1, n[k + 1]);
  }
  return Number.isFinite(x0) ? { w: x1 - x0, h: y1 - y0 } : { w: 0, h: 0 };
}

/**
 * 세 컷을 이어 도는 한 장.
 *
 * 가운데 컷(B)을 바탕 문서로 삼고, 그 요소마다 앞 컷과 뒤 컷의 짝을 찾아
 * a→b→c→a 값을 건다. 같은 걸음(align)을 두 번 걷되 열쇠가 둘 다 B의
 * 요소라서, 두 결과가 한 요소 위에서 만난다.
 *
 * 세 컷 중 일부에만 있는 것은 그 구간에서만 켜진다. 처음엔 그런 것을
 * 통째로 버렸는데, Step 1에서 버려진 것이 하필 주인공이었다 — 얇은 '가'와
 * 굵은 '가'와 기운 '가'는 획 수가 달라 서로 짝이 되지 못하니, 버리면
 * 가운데 컷의 '가' 하나만 내내 서 있고 아무 일도 일어나지 않는다.
 *
 * 마지막 컷에만 있는 것 중 제일 큰 한 조각에는 흔들림 표시를 단다.
 * Step 1에서 그건 기울어진 '가'다 — 작가가 기울기까지는 그려 주었고,
 * 흔들리는 것은 그림이 들 수 없는 몫이라 여기서 얹는다.
 */
function chain3(A: Element, B: Element, C: Element, key: string, dur: number, crop?: string): string {
  inlineFills(A); inlineFills(B); inlineFills(C);
  const ia = itemsOf(A), ib = itemsOf(B), ic = itemsOf(C);
  const wAB = align(ia, ib);
  const wBC = align(ib, ic);
  const ahead = new Map<Element, Item>();          // B 요소 → C의 짝
  for (const c of ic) { const b = wBC.pair.get(c.el); if (b) ahead.set(b.el, c); }

  let matched = 0;
  for (const b of ib) {
    const a = wAB.pair.get(b.el), c = ahead.get(b.el);
    if (a && c) {
      matched++;
      if (a.d && b.d && c.d) {
        if (a.d !== b.d || b.d !== c.d) animate3(b.el, 'd', a.d, b.d, c.d, dur);
      } else {
        for (const at of SHAPE_ATTRS) {
          const x = a.el.getAttribute(at), y = b.el.getAttribute(at), z = c.el.getAttribute(at);
          if (x !== null && y !== null && z !== null && !(x === y && y === z)) animate3(b.el, at, x, y, z, dur);
        }
      }
      continue;
    }
    // 세 컷에 다 있지는 않다. 없는 구간에서는 물러나되, **있는 구간끼리는
    // 모양이 이어져야 한다** — 얇은 '가'와 굵은 '가'는 획 순서가 같아 짝이
    // 되는데(둘 다 같은 윤곽에서 나왔다) 기운 '가'는 짝이 없다. 물러나는
    // 것만 시키고 모양을 안 이으면, 첫 컷 자리에 굵은 '가'가 서 있고 그
    // 뒤로 얇은 '가'가 비쳐 두 장이 겹쳐 보인다.
    animate3(b.el, 'opacity', a ? '1' : '0', '1', c ? '1' : '0', dur);
    const near = a ?? c;
    if (near?.d && b.d && near.d !== b.d) {
      animate3(b.el, 'd', a?.d ?? b.d, b.d, c?.d ?? b.d, dur);
    } else if (near) {
      for (const at of SHAPE_ATTRS) {
        const y = b.el.getAttribute(at);
        const x = a?.el.getAttribute(at) ?? y, z = c?.el.getAttribute(at) ?? y;
        if (y !== null && x !== null && z !== null && !(x === y && y === z)) animate3(b.el, at, x, y, z, dur);
      }
    }
  }
  if (!matched) { markEyes(B); return scopeSvg(new XMLSerializer().serializeToString(B), key); }

  // 바깥 컷에만 있는 것은 B 문서에 없다. 옮겨 심고 그것이 부르는 defs도 같이.
  const defsB = B.querySelector('defs') ?? B.insertBefore(
    B.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'defs'), B.firstChild);
  for (const src of [A, C]) {
    const d = src.querySelector('defs');
    if (d) Array.from(d.children).forEach((n) => { if (n.tagName !== 'style') defsB.appendChild(n.cloneNode(true)); });
  }
  const plant = (item: Item, before: Element | null, first: string, last: string) => {
    const copy = cloneInto(B, item.el, before);
    animate3(copy, 'opacity', first, '0', last, dur);
    return copy;
  };
  for (const { item, before } of wAB.onlyA) plant(item, before, '1', '0');       // 첫 컷에만
  const tail = wBC.onlyB.map((item) => ({ item, el: plant(item, null, '0', '1') }));  // 끝 컷에만

  // 끝 컷에만 있는 것 중 제일 큰 조각 = 흔들릴 주인공
  const vb = (B.getAttribute('viewBox') ?? '').split(/[ ,]+/).map(Number);
  const canvas = vb.length === 4 ? Math.max(vb[2], vb[3]) : 0;
  // 큰 조각은 다 흔든다. 글자는 획이 여럿으로 쪼개져 나오는 일이 흔해서
  // (기운 '가'는 ㄱ과 ㅏ가 따로 그려져 있다) 제일 큰 하나만 흔들면 글자가
  // 반만 떨린다. 작은 조각(잣대 손잡이 같은 것)은 문턱 아래로 걸러진다.
  for (const t of tail) {
    const { h } = dExtent(t.item.d);
    if (h < canvas * 0.15) continue;
    t.el.setAttribute('class', 'mf-shake');
    t.el.setAttribute('style', `animation-duration:${dur}s`);
  }

  const va = A.getAttribute('viewBox')!, vbs = B.getAttribute('viewBox')!, vc = C.getAttribute('viewBox')!;
  if (va !== vbs || vbs !== vc) animate3(B, 'viewBox', va, vbs, vc, dur);
  else if (crop) B.setAttribute('viewBox', crop);
  markEyes(B);
  return scopeSvg(new XMLSerializer().serializeToString(B), key);
}

/**
 * 두 장을 겹쳐 오가는 한 장으로 만든다.
 *
 * @param from 처음 컷 · @param to 나중 컷 · @param key 이름 충돌을 막는 열쇠
 * @param dur  한 바퀴 (초). 머무는 시간까지 포함한 값이다
 * @param crop 두 컷의 화판이 같을 때만. 빈 자리를 잘라 낼 viewBox
 */
export function morphSvg(from: string, to: string, key: string, dur = 4.2, crop?: string, third?: string): string {
  if (typeof DOMParser === 'undefined') return scopeSvg(third ?? to, key);
  try {
    const parse = (s: string) => new DOMParser().parseFromString(s, 'image/svg+xml').documentElement;
    const A = parse(from), B = parse(to);
    if (!A.getAttribute('viewBox') || !B.getAttribute('viewBox')) return scopeSvg(to, key);
    if (third) {
      const C = parse(third);
      if (C.getAttribute('viewBox')) return chain3(A, B, C, key, 6.3, crop);
    }
    inlineFills(A); inlineFills(B);

    const ia = itemsOf(A), ib = itemsOf(B);
    // 짝이 없는 것은 양쪽에 다 생긴다. 뒤 컷에만 있는 것(느낌표)은 나타났다
    // 사라지고, 앞 컷에만 있는 것(벽에 켜졌던 글자)은 있다가 물러난다.
    // 한 칸씩 내다보며 어느 쪽에 끼어든 것인지 가른다.
    const walk = align(ia, ib);
    const matched = walk.pair.size;
    const appear: Element[] = walk.onlyB.map((x) => x.el);
    const vanish: Array<{ el: Element; before: Element | null }> =
      walk.onlyA.map((x) => ({ el: x.item.el, before: x.before }));
    for (const [bEl, a] of walk.pair) {
      const b = ib.find((x) => x.el === bEl)!;
      if (b.d && a.d && b.d !== a.d) animate(b.el, 'd', `${a.d};${a.d};${b.d};${b.d};${a.d}`, dur);
      else for (const at of SHAPE_ATTRS) {
        const x = a.el.getAttribute(at), y = b.el.getAttribute(at);
        if (x !== null && y !== null && x !== y) animate(b.el, at, `${x};${x};${y};${y};${x}`, dur);
      }
    }
    if (matched === 0) return scopeSvg(to, key);

    for (const el of appear) animate(el, 'opacity', '0;0;1;1;0', dur);
    if (vanish.length) {
      // 앞 컷에만 있던 것은 B의 문서에 없다. 옮겨 심고, 그것이 참조하는
      // 그라디언트도 같이 가져온다 — 안 그러면 색이 비어 검게 나온다.
      const defsA = A.querySelector('defs');
      if (defsA) {
        const defsB = B.querySelector('defs') ?? B.insertBefore(
          B.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'defs'), B.firstChild);
        Array.from(defsA.children).forEach((c) => { if (c.tagName !== 'style') defsB.appendChild(c.cloneNode(true)); });
      }
      for (const { el, before } of vanish) {
        animate(cloneInto(B, el, before), 'opacity', '1;1;0;0;1', dur);
      }
    }

    const va = A.getAttribute('viewBox')!, vb = B.getAttribute('viewBox')!;
    if (va !== vb) animate(B, 'viewBox', `${va};${va};${vb};${vb};${va}`, dur);
    // 화판에 빈 자리가 넓으면 장면이 작아진다. 잘라 낼 자리를 받으면 그만큼 당긴다.
    else if (crop) B.setAttribute('viewBox', crop);
    markEyes(B);
  return scopeSvg(new XMLSerializer().serializeToString(B), key);
  } catch {
    return scopeSvg(to, key);
  }
}
