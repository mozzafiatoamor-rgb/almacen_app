import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Set VITE_BASE_URL in your GitHub repo vars to match your repo name
// e.g. /almacen_app/  (with slashes)
const base = process.env.VITE_BASE_URL || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Assets that will be cached by the service worker
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable.png', 'favicon.ico'],
      manifest: {
        name: 'Almacén Mozzafiato',
        short_name: 'Mozzafiato',
        description: 'Sistema de gestión de almacén para Mozzafiato',
        theme_color: '#0e1726',
        background_color: '#0e1726',
        display: 'standalone',
        orientation: 'portrait',
        // scope and start_url must match your GitHub Pages subdirectory
        scope: base,
        start_url: base,
        // id identifies the app uniquely — keep consistent with start_url
        id: base,
        prefer_related_applications: false,
        icons: [
          {
            // Standard icon — shown in the install prompt and home screen
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            // Large icon — used for the splash screen on Android
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            // Maskable icon — fills Android's adaptive icon shape without white bars
            // Content must be within the center 80% (safe zone) of the image
            src: 'icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Pre-cache all built assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache the Google Sheets API key URL (security)
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Google Sheets API — NetworkFirst so data is always fresh when online
            urlPattern: /^https:\/\/sheets\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sheets-api-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 300 }, // 5 min
              networkTimeoutSeconds: 10,
            }
          },
          {
            // Apps Script POST — NetworkOnly (writes must never use cache)
            urlPattern: /^https:\/\/script\.google\.com\//,
            handler: 'NetworkOnly',
          }
        ]
      }
    })
  ]
})
