import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // 디자인 에셋은 by_moomiryu/ 에 쌓인다. 작가가 넣는 폴더라
  // src 밖에 두고 별칭으로만 부른다 — 경로가 ../../ 로 새지 않게.
  resolve: {
    alias: {
      '@assets': fileURLToPath(new URL('./by_moomiryu', import.meta.url))
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-64x64.png', 'fonts/LinealVF.ttf'],
      manifest: {
        name: 'MEGAFONT',
        short_name: 'MEGAFONT',
        description: '캠퍼스 공공 발화 시스템',
        lang: 'ko',
        // 홈 화면에서 여는 것은 '처음 오는 것'과 같다 — 홈(01)부터 시작해야
        // 프로젝트 정보를 볼 기회가 생긴다. ?stage=enter는 NFC 태그의 몫이다.
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // 크롬은 흑백이다 — 설치 스플래시가 분홍으로 번쩍이면 안 된다
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'jsdelivr-fonts',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('firebaseio.com'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase',
              networkTimeoutSeconds: 5
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ]
});
