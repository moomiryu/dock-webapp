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
