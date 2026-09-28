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

/* 어떤 색 표기든(#hex · 토큰 · color-mix) 브라우저에게 풀게 해 [r, g, b, a]로 받는다 */
let probe: HTMLElement | null = null;
const rgbaCache = new Map<string, number[] | null>();
function rgba(css: string): number[] | null {
  css = css.trim();
  if (!css) return null;
  const hit = rgbaCache.get(css);
  if (hit !== undefined) return hit;
  let out: number[] | null = null;
  const m0 = css.match(/^rgba?\(([^)]+)\)$/);
  const m = m0 ? m0[1].match(/[\d.]+%?/g) : null;
  if (!m) {
    if (!probe) { probe = document.createElement('i'); probe.style.display = 'none'; document.documentElement.appendChild(probe); }
    probe.style.color = '';
    probe.style.color = css;
    const back = probe.style.color ? getComputedStyle(probe).color : '';
    const n = back.match(/rgba?\(([^)]+)\)/)?.[1].match(/[\d.]+%?/g);
    if (n) out = n.map((v, i) => (i === 3 && v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v)));
  } else {
    out = m.map((v, i) => (i === 3 && v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v)));
  }
  if (out && out.length === 3) out.push(1);
  rgbaCache.set(css, out);
  return out;
}

/**
 * 한 점에 쌓인 층들의 칠을 위에서부터 겹쳐 본 색. 문서(html · body)는 뺀다 — 여기서 칠하는 곳이다.
 *
 * 단색 바탕(background-color)만으로는 모자랐다 — 홈은 회색 그라데이션, 소개는
 * 바닥에서 올라오는 더운 기운(::after)이라 둘 다 '투명'으로 읽혀 하양이 칠해졌다
 * (사용자, 2026-09-28). 그라데이션 · 덮개를 쓰는 화면은 CSS에 제 끝의 칠을 적어
 * 둔다: --edge-top-paint · --edge-bottom-paint(global.css의 @property — 물려받지
 * 않는다). 그 칠은 제 바탕색 **위에** 놓인 것으로 겹친다.
 */
function colorAt(x: number, y: number, edge: 'top' | 'bottom'): string {
  let r = 0, g = 0, b = 0, a = 0;
  const layer = (c: number[] | null) => {
    if (!c || c[3] <= 0 || a >= 0.99) return;
    const w = (1 - a) * c[3];
    r += w * c[0]; g += w * c[1]; b += w * c[2]; a += w;
  };
  for (const el of document.elementsFromPoint(x, y)) {
    if (el === document.documentElement || el === document.body) continue;
    if (el instanceof HTMLElement && el.dataset.edgeStrip) continue;   // 이 칠을 사파리에 넘기는 띠 — 제 색을 되읽지 않는다
    const cs = getComputedStyle(el);
    layer(rgba(cs.getPropertyValue(`--edge-${edge}-paint`)));
    layer(rgba(cs.backgroundColor));
    if (a >= 0.99) break;
  }
  // 끝까지 투명한 자리가 남으면 원래 문서 바탕(--paper) 위에 놓인 것으로 본다
  const rest = Math.max(0, 1 - a);
  const [pr, pg, pb] = rgba(getComputedStyle(document.documentElement).getPropertyValue('--paper')) ?? [255, 255, 255];
  return `rgb(${Math.round(r + rest * pr)}, ${Math.round(g + rest * pg)}, ${Math.round(b + rest * pb)})`;
}

export function trackEdgeTint(): () => void {
  const root = document.documentElement;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  let timer = 0, raf = 0, last = '';
  const watched = new WeakSet<Animation>();
  const read = () => {
    clearTimeout(timer); timer = 0;
    cancelAnimationFrame(raf); raf = 0;
    /* **화면이 가는 곳의 색을 읽는다.** 3/5 조율판은 0.05초에 오르기 시작해 0.585초에
       끝나는데 끝 0.2초는 거의 멈춘 꼬리이고, 그 사이 빨간 '다음' 버튼이 아래 끝을
       지나간다(재 봄). 끝을 기다리면 늦고, 그때그때 따라가면 깜빡인다.
       그래서 끝이 있는 움직임을 끝 1ms 앞으로 잠깐 옮겨 읽고 같은 자리에서 되돌린다 —
       그 사이 화면은 그려지지 않는다. 끝나는 순간(finished)에 한 번 더 읽어 확인한다.
       끝없이 도는 것(홈 캐릭터의 떠다님)은 건드리지 않는다.
       끝 1ms 앞이지 끝이 아니다 — 끝으로 옮기면 그 움직임의 finished가 풀려 버린다 */
    const finite = (document.getAnimations?.() ?? []).filter((a) =>
      a.playState === 'running' && Number.isFinite(Number(a.effect?.getComputedTiming().endTime)));
    for (const a of finite) if (!watched.has(a)) { watched.add(a); a.finished.then(now, () => {}); }
    // 미리 읽는 것은 1초 안에 끝나는 움직임만 — 5/5 제목은 3초 뒤에 접힌다. 그것까지 당기면 3초 뒤를 칠한다
    const moving = finite.filter((a) => Number(a.effect!.getComputedTiming().endTime) - Number(a.currentTime ?? 0) <= 1000);
    const saved = moving.map((a) => a.currentTime);
    let top: string, bottom: string;
    try {
      for (const a of moving) a.currentTime = Number(a.effect!.getComputedTiming().endTime) - 1;
      const x = window.innerWidth / 2;
      top = colorAt(x, 1, 'top');
      bottom = colorAt(x, window.innerHeight - 1, 'bottom');
    } finally {
      moving.forEach((a, i) => { a.currentTime = saved[i]; });
    }
    if (top + bottom === last) return;
    last = top + bottom;
    root.style.setProperty('--edge-top', top);
    root.style.setProperty('--edge-bottom', bottom);
    if (meta) meta.content = top;
    renewStrips();
  };
  /* 화면이 바뀌면 **바로 다음 프레임**에 읽는다 — 새 화면이 처음 그려지는 그
     프레임에 테두리도 같이 바뀐다. 처음엔 신호마다 120ms를 기다렸는데, 폰에서
     "다음 화면으로 넘길 때 버벅이고 바뀐다"고 했다(사용자, 2026-09-28). 재 보니
     화면이 바뀐 뒤 테두리가 120~130ms 늦었다(3/5 조율판은 190ms).
     style만 바뀌는 신호는 예외로 120ms에 한 번만 읽는다 — 홈 캐릭터가 매 프레임
     style을 바꿔서, 그걸 다 따라가면 프레임마다 읽게 된다. 화면 전환은 요소가
     갈리거나(childList) class가 바뀌는 쪽이라 이 예외에 걸리지 않는다.
     신호만으로는 모자란 때가 있다: 움직임 줄이기에서 3/5 조율판이 올라온 뒤에도
     아래 끝이 빨강으로 남았다(판이 서는 순간에 오는 신호가 없다). 그래서 0.5초마다
     한 번 더 본다. 점 두 개를 읽는 일이라 폰에 짐이 안 된다. */
  /* 홈은 떠다니는 말이 생기고 사라져 초당 30번쯤 읽는다. 한 번이 0.02ms(이 PC)라
     폰이 열 배 느려도 1초에 6ms 안쪽이다 — 모아 읽기(0.1초)를 해 봤더니 그게
     전환을 붙잡아 3/5 조율판이 0.13초 늦었다. 모으지 않는다 */
  function now() { if (!raf) raf = requestAnimationFrame(read); }
  const soon = () => { if (!timer && !raf) timer = window.setTimeout(read, 120); };
  /* style만 바뀌는 움직임(3/5 조율판이 매 프레임 style로 미끄러져 오른다)은 끝났다는
     신호가 없다 — 바뀜이 60ms 멎으면 다 선 것으로 보고 읽는다. 그러지 않으면 판이
     선 뒤 0.18초 늦게 따라갔다. 쉬지 않고 도는 것(홈 캐릭터)은 멎지 않으니 여기
     걸리지 않고, 위의 120ms 간격만 탄다 */
  let settle = 0;
  const mo = new MutationObserver((recs) => {
    if (recs.some((r) => r.attributeName !== 'style')) { now(); return; }
    soon();
    clearTimeout(settle);
    settle = window.setTimeout(now, 60);
  });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true });
  document.addEventListener('transitionend', now, true);
  document.addEventListener('animationend', now, true);
  window.addEventListener('resize', now);
  const beat = window.setInterval(() => { if (!document.hidden) soon(); }, 500);
  /* 위 · 아래 끝의 띠(global.css [data-edge-strip]). 사파리는 상태줄과 주소창 뒤를 문서 밑색
     **한 가지로** 같이 칠했다(폰 캡처 2026-09-29 — 밑색을 위 색으로 두면 둘 다 위 색, 아래 색으로
     두면 둘 다 아래 색). 위아래를 따로 가르는 길은 사파리가 화면 끝에 붙은 **고정 요소**의 색을
     그쪽으로 늘리는 것뿐이다. 사파리는 끝을 짚어(hit test) 그 요소를 찾으므로, 띠는 누를 수
     있는 진짜 요소여야 한다 — 누를 수 없는 덧칠 층(body::after)으로 한 번 해 봤을 때 안 먹혔다.
     React 바깥(body 끝)에 둔다.
     **색이 바뀔 때마다 띠를 새로 갈아 끼운다.** 사파리는 띠를 처음 봤을 때의 색만 기억했다 —
     처음 불러온 홈은 맞았는데, 버튼으로 넘긴 가이드는 홈의 색 그대로였다(사용자, 2026-09-29).
     새 요소가 생기면 다시 읽는다 */
  let strips: HTMLDivElement[] = [];
  function renewStrips() {
    strips.forEach((el) => el.remove());
    strips = (['top', 'bottom'] as const).map((edge) => {
      const el = document.createElement('div');
      el.dataset.edgeStrip = edge;
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
      return el;
    });
  }
  renewStrips();
  root.dataset.edge = '';
  now();
  return () => {
    clearTimeout(timer);
    clearTimeout(settle);
    cancelAnimationFrame(raf);
    clearInterval(beat);
    mo.disconnect();
    document.removeEventListener('transitionend', now, true);
    document.removeEventListener('animationend', now, true);
    window.removeEventListener('resize', now);
    strips.forEach((el) => el.remove());
    delete root.dataset.edge;
  };
}
