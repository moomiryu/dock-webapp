// 자판이 올라오면 화면이 줄어든다. 그 줄어든 높이를 CSS가 알아야
// 액자와 버튼이 남은 자리를 나눠 가질 수 있다.
//
// dvh는 브라우저 UI(주소창)만 따라간다. 자판이 먹는 높이를 아는 것은
// visualViewport 뿐이다. 여기서 하는 일은 높이를 '고정'하는 게 아니라
// 지금 실제로 보이는 높이를 그대로 흘려보내는 것이다 — 자리를 어떻게
// 나눌지는 CSS가 유동으로 정한다.

/** 자판이 올라왔다고 볼 최소 축소량 (px). 주소창이 접히는 정도와 구분한다. */
const KEYBOARD_THRESHOLD = 140;

export function trackViewport(): () => void {
  const vv = window.visualViewport;
  const root = document.documentElement;
  if (!vv) {
    // visualViewport가 없는 브라우저는 dvh로 두면 된다. 폴백이 이미 CSS에 있다.
    return () => {};
  }

  let raf = 0;
  const write = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const h = Math.round(vv.height);
      root.style.setProperty('--vvh', `${h}px`);
      /* 보이는 창이 **얼마나 밀려 올라갔는가.**
         높이만으로는 모자란 때가 있다. 자판이 올라올 때 사파리는 창의
         높이를 줄이는 대신 창 자체를 위로 밀기도 하는데, 그러면 높이는
         맞는데 화면 위쪽이 잘려 보인다. 0이 아닌 값이 나오면 그만큼
         어긋나 있다는 뜻이다.

         값을 흘려보내기만 하고 이것으로 화면을 되밀지는 않는다 — 자판이
         열리는 동안 이 값이 몇 프레임에 걸쳐 오르내려서, 그대로 따라가면
         화면이 떨린다. 대신 **밀릴 일 자체를 없앤다**: 쓰는 동안에는
         본문이 보이는 창보다 길지 않게 해서(app.css의 is-typing) 브라우저가
         밀어 올릴 것을 갖지 못하게 한다. 이 값은 그것이 실제로 지켜지는지
         재 보는 자리다. */
      root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
      // 자판이 올라온 동안에는 안내 문구처럼 없어도 되는 것을 접는다
      root.dataset.keyboard = window.innerHeight - h > KEYBOARD_THRESHOLD ? 'up' : 'down';
    });
  };

  write();
  vv.addEventListener('resize', write);
  vv.addEventListener('scroll', write);
  window.addEventListener('orientationchange', write);

  return () => {
    cancelAnimationFrame(raf);
    vv.removeEventListener('resize', write);
    vv.removeEventListener('scroll', write);
    window.removeEventListener('orientationchange', write);
  };
}

// ─── 화면 끝의 색을 브라우저 테두리로 (2026-09-28) ─────────────────────
// 사파리는 위 상태줄(시간 · 와이파이)과 아래 주소창을 페이지 바탕색과
// theme-color로 물들인다. 우리 문서 바탕은 늘 하양이라 3/5의 붉은 면 ·
// 4/5 · 5/5의 검은 화면 위아래에 흰 띠가 남아 산만했다(사용자, 폰에서 봄).
//
// 색을 정해 두지 않고 **지금 화면 끝에 실제로 칠해진 색을 읽는다.** 단계가
// 늘어도, 소개처럼 위를 덮는 층이 떠도 따라간다 — 인스타그램에서 회색 막이
// 뜨면 테두리도 회색이 되는 것과 같다. 새 색을 만들지 않는다: 읽은 색을
// 그대로 옮길 뿐이다. 위 끝 색은 문서 바탕 위쪽과 theme-color에, 아래 끝
// 색은 문서 바탕 아래쪽에 간다(global.css의 html[data-edge]).

/** 문서의 원래 바탕(tokens.css의 --paper)을 [r, g, b]로 */
function paperRGB(): [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 한 점에 쌓인 층들의 바탕을 위에서부터 겹쳐 본 색. 문서(html · body)는 뺀다 — 여기서 칠하는 곳이다 */
function colorAt(x: number, y: number): string {
  let r = 0, g = 0, b = 0, a = 0;
  for (const el of document.elementsFromPoint(x, y)) {
    if (el === document.documentElement || el === document.body) continue;
    const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    if (!m) continue;
    const al = m.length > 3 ? parseFloat(m[3]) : 1;
    if (al <= 0) continue;
    const w = (1 - a) * al;
    r += w * +m[0]; g += w * +m[1]; b += w * +m[2]; a += w;
    if (a >= 0.99) break;
  }
  // 끝까지 투명한 자리가 남으면 원래 문서 바탕 위에 놓인 것으로 본다
  const rest = Math.max(0, 1 - a), [pr, pg, pb] = paperRGB();
  return `rgb(${Math.round(r + rest * pr)}, ${Math.round(g + rest * pg)}, ${Math.round(b + rest * pb)})`;
}

export function trackEdgeTint(): () => void {
  const root = document.documentElement;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  let timer = 0, last = '';
  const read = () => {
    timer = 0;
    const x = window.innerWidth / 2;
    const top = colorAt(x, 1), bottom = colorAt(x, window.innerHeight - 1);
    if (top + bottom === last) return;
    last = top + bottom;
    root.style.setProperty('--edge-top', top);
    root.style.setProperty('--edge-bottom', bottom);
    if (meta) meta.content = top;
  };
  /* 화면이 바뀌는 신호는 많고 잦다(홈 캐릭터는 매 프레임 style을 바꾼다) —
     120ms에 한 번만 읽는다. 바탕이 번지며 바뀌는 화면(03 · 04, 420ms)은
     전환이 끝날 때 한 번 더 읽는다.
     신호만으로는 모자랐다: 움직임 줄이기에서 3/5 조율판이 올라온 뒤에도
     아래 끝이 빨강으로 남았다(재 봄 — 판이 서는 순간에 오는 신호가 없다).
     그래서 0.5초마다 한 번 더 본다. 점 두 개를 읽는 일이라 폰에 짐이 안 된다. */
  const soon = () => { if (!timer) timer = window.setTimeout(read, 120); };
  const mo = new MutationObserver(soon);
  mo.observe(document.body, { subtree: true, childList: true, attributes: true });
  document.addEventListener('transitionend', soon, true);
  document.addEventListener('animationend', soon, true);
  window.addEventListener('resize', soon);
  const beat = window.setInterval(() => { if (!document.hidden) soon(); }, 500);
  root.dataset.edge = '';
  soon();
  return () => {
    clearTimeout(timer);
    clearInterval(beat);
    mo.disconnect();
    document.removeEventListener('transitionend', soon, true);
    document.removeEventListener('animationend', soon, true);
    window.removeEventListener('resize', soon);
    delete root.dataset.edge;
  };
}
