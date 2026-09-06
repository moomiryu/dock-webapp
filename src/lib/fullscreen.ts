// 주소창을 없애는 두 가지 길.
//
// 안드로이드 크롬·데스크톱은 Fullscreen API가 있다. 아이폰 사파리에는 없다
// (iPad는 되고 iPhone은 안 된다 — 비디오 말고는 전체화면이 없다).
// 아이폰에서 주소창을 지우는 유일한 방법은 '홈 화면에 추가'로 standalone 실행하는 것이다.
// 그래서 이 모듈은 둘 중 가능한 쪽을 알려주는 일까지 한다.

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FsEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

/** 홈 화면에서 실행됐는가 — 이 경우 이미 주소창이 없다 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function supportsFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as FsEl;
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
}

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const d = document as FsDoc;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<boolean> {
  const el = document.documentElement as FsEl;
  try {
    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }
    if (typeof el.webkitRequestFullscreen === 'function') {
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // 사용자가 거부했거나 브라우저가 막았다 — 조용히 실패한다
  }
  return false;
}

export async function exitFullscreen(): Promise<void> {
  const d = document as FsDoc;
  try {
    if (typeof d.exitFullscreen === 'function') await d.exitFullscreen();
    else if (typeof d.webkitExitFullscreen === 'function') await d.webkitExitFullscreen();
  } catch {
    /* 이미 나와 있을 수 있다 */
  }
}

/** 아이폰/아이패드 사파리 계열 — 전체화면 API가 없거나 반쪽이다 */
export function isIosWebkit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  return iOS && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export type ScreenMode =
  /** 이미 주소창이 없다 — 버튼을 보일 이유가 없다 */
  | 'clean'
  /** 버튼 한 번으로 전체화면이 된다 */
  | 'api'
  /** API가 없다 — '홈 화면에 추가'를 안내하는 수밖에 없다 */
  | 'install';

export function screenMode(): ScreenMode {
  if (isStandalone() || isFullscreen()) return 'clean';
  if (supportsFullscreen() && !isIosWebkit()) return 'api';
  return 'install';
}
