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

// 자판이 올라온 동안 실제로 보이는 높이를 CSS 변수로 흘려보낸다
trackViewport();
// 폰의 상태줄 · 주소창을 화면 끝의 색에 맞춘다. 벽 · 관리는 폰이 아니다
if (!isDisplaySurface) trackEdgeTint();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
