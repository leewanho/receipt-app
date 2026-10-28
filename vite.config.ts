import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { devApi } from './dev-api';

export default defineConfig({
  plugins: [
    react(),
    devApi(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '영수증 정리',
        short_name: '영수증',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1a5fd0',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
