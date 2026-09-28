import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import { trackEdgeTint, trackViewport } from './lib/viewport';
import './styles/global.css';
import './styles/app.css';

// Display/operator surfaces (/wall projection, /admin) must always
// show the freshest build — a stale PWA cache here caused the wall to keep
// rendering an old version. Skip the service worker on those routes and tear
// down any previously-registered SW + caches so they self-heal.
const isDisplaySurface = /^\/(wall|admin)/.test(window.location.pathname);
if (isDisplaySurface) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  }
  if ('caches' in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
} else {
  registerSW({ immediate: true });
}

/**
 * 누름 — 손가락이 닿는 순간 그 버튼에 data-pressed를 단다(2026-09-29). app.css의 '누름'
 * 블록이 그걸 보고 97%로 줄인다. CSS :active에 맡겼더니 폰에서 안 보였다: 아이폰 사파리는
 * 스크롤인지 가르느라 :active를 늦게 켜거나 짧은 탭에서는 아예 안 켠다. pointerdown은
 * 닿는 즉시 온다. 떼도 --t-return의 절반까지는 눌린 채 두어, 짧은 탭도 줄어든 모습이
 * 한 번은 보이게 한다. 스크롤로 바뀌면(pointercancel) 곧바로 푼다.
 */
function trackPress() {
  let held: HTMLElement | null = null;     // 손가락이 닿아 있는 버튼
  let fading: HTMLElement | null = null;   // 떼었지만 최소 시간을 채우는 중인 버튼
  let since = 0;
  let timer = 0;
  const minHold = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--t-return').trim();
    return ((parseFloat(v) || 0) * (v.endsWith('ms') ? 1 : 1000) || 220) / 2;   // 빌드가 220ms를 .22s로 적는다
  };
  const clearFading = () => { window.clearTimeout(timer); fading?.removeAttribute('data-pressed'); fading = null; };
  document.addEventListener('pointerdown', (e) => {
    clearFading();
    /* 슬라이더는 틀에 단다 — 안의 칸이 버튼이어도(스위치 · 2/5) 줄어드는 것은 판이고, 판은
       틀이 들고 있다(사용자, 같은 날: '판만 작아지기'). app.css '누름 — 슬라이더' */
    const t = e.target as Element | null;
    const el = t?.closest<HTMLElement>('.tslider-cells, .tseg, .color-roll-window, .style-cards')
      ?? t?.closest<HTMLElement>('button, a');
    if (!el || (el as HTMLButtonElement).disabled) return;
    held = el; since = performance.now();
    el.setAttribute('data-pressed', '');
  }, { capture: true, passive: true });
  const release = (e: Event) => {
    const el = held;
    if (!el) return;
    held = null;
    if (e.type === 'pointercancel') { el.removeAttribute('data-pressed'); return; }
    fading = el;
    timer = window.setTimeout(clearFading, Math.max(0, minHold() - (performance.now() - since)));
  };
  document.addEventListener('pointerup', release, { capture: true, passive: true });
  document.addEventListener('pointercancel', release, { capture: true, passive: true });
}

// 자판이 올라온 동안 실제로 보이는 높이를 CSS 변수로 흘려보낸다
trackViewport();
// 누른 버튼이 폰에서도 줄어들게 — 벽 · 관리는 누르는 화면이 아니다
if (!isDisplaySurface) trackPress();
// 폰의 상태줄 · 주소창을 화면 끝의 색에 맞춘다. 벽 · 관리는 폰이 아니다
if (!isDisplaySurface) trackEdgeTint();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
