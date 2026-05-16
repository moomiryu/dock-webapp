import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-64x64.png'],
      manifest: {
        name: 'DOCK',
        short_name: 'DOCK',
        description: '캠퍼스 공공 발화 시스템',
        lang: 'ko',
        start_url: '/?stage=enter',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#FCE7F3',
        background_color: '#efefef',
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
