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
/** 모양이 숫자로 적혀 있는 요소들. 이 속성들만 오간다 */
const SHAPE_ATTRS = ['cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2'];

interface Item { el: Element; tag: string; fill: string; d: string | null; shape: string }

function itemsOf(root: Element): Item[] {
  return Array.from(root.querySelectorAll(DRAWN)).map((el) => {
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
 * 두 장을 겹쳐 오가는 한 장으로 만든다.
 *
 * @param from 처음 컷 · @param to 나중 컷 · @param key 이름 충돌을 막는 열쇠
 * @param dur  한 바퀴 (초). 머무는 시간까지 포함한 값이다
 * @param crop 두 컷의 화판이 같을 때만. 빈 자리를 잘라 낼 viewBox
 */
export function morphSvg(from: string, to: string, key: string, dur = 4.2, crop?: string): string {
  if (typeof DOMParser === 'undefined') return scopeSvg(to, key);
  try {
    const parse = (s: string) => new DOMParser().parseFromString(s, 'image/svg+xml').documentElement;
    const A = parse(from), B = parse(to);
    if (!A.getAttribute('viewBox') || !B.getAttribute('viewBox')) return scopeSvg(to, key);
    inlineFills(A); inlineFills(B);

    const ia = itemsOf(A), ib = itemsOf(B);
    // 짝이 없는 것은 양쪽에 다 생긴다. 뒤 컷에만 있는 것(느낌표)은 나타났다
    // 사라지고, 앞 컷에만 있는 것(벽에 켜졌던 글자)은 있다가 물러난다.
    // 한 칸씩 내다보며 어느 쪽에 끼어든 것인지 가른다.
    let i = 0, j = 0, matched = 0;
    const appear: Element[] = [];
    const vanish: Array<{ el: Element; before: Element | null }> = [];
    while (i < ia.length || j < ib.length) {
      const a = ia[i], b = ib[j];
      if (a && b && pairs(a, b)) {
        matched++; i++; j++;
        if (b.d && a.d && b.d !== a.d) animate(b.el, 'd', `${a.d};${a.d};${b.d};${b.d};${a.d}`, dur);
        else for (const at of SHAPE_ATTRS) {
          const x = a.el.getAttribute(at), y = b.el.getAttribute(at);
          if (x !== null && y !== null && x !== y) animate(b.el, at, `${x};${x};${y};${y};${x}`, dur);
        }
        continue;
      }
      if (a && ib[j + 1] && pairs(a, ib[j + 1])) { appear.push(b!.el); j++; continue; }
      if (b && ia[i + 1] && pairs(ia[i + 1], b)) { vanish.push({ el: a!.el, before: b.el }); i++; continue; }
      if (b) { appear.push(b.el); j++; }
      if (a) { vanish.push({ el: a.el, before: b ? b.el : null }); i++; }
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
        const copy = B.ownerDocument.importNode(el, true) as Element;
        if (before?.parentNode) before.parentNode.insertBefore(copy, before);
        else B.appendChild(copy);
        animate(copy, 'opacity', '1;1;0;0;1', dur);
      }
    }

    const va = A.getAttribute('viewBox')!, vb = B.getAttribute('viewBox')!;
    if (va !== vb) animate(B, 'viewBox', `${va};${va};${vb};${vb};${va}`, dur);
    // 화판에 빈 자리가 넓으면 장면이 작아진다. 잘라 낼 자리를 받으면 그만큼 당긴다.
    else if (crop) B.setAttribute('viewBox', crop);
    return scopeSvg(new XMLSerializer().serializeToString(B), key);
  } catch {
    return scopeSvg(to, key);
  }
}
