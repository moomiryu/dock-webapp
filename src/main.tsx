import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import './styles/global.css';

// Display/operator surfaces (/wall projection, /admin, /archive) must always
// show the freshest build — a stale PWA cache here caused the wall to keep
// rendering an old version. Skip the service worker on those routes and tear
// down any previously-registered SW + caches so they self-heal.
const isDisplaySurface = /^\/(wall|admin|archive)/.test(window.location.pathname);
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
