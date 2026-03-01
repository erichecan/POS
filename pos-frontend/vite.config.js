import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// 2026-02-28T15:55:00+08:00 Phase E1.3 PWA 支持
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'POS Handheld',
        short_name: 'POS',
        description: 'Point of Sale - Handheld ordering',
        theme_color: '#1f1f1f',
        background_color: '#1f1f1f',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/vite.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/vite.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
        start_url: '/',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/self-order\/public\/menu\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'menu-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    }
  }
})
