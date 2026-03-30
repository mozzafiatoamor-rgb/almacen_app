import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Set VITE_BASE_URL in your GitHub repo secrets to match your repo name
// e.g. /mozzafiato-almacen/  (with trailing slash)
const base = process.env.VITE_BASE_URL || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'favicon.ico'],
      manifest: {
        name: 'Almacén Mozzafiato',
        short_name: 'Mozzafiato',
        description: 'Sistema de gestión de almacén',
        theme_color: '#0e1726',
        background_color: '#0e1726',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        icons: [
          { src: 'logo.png', sizes: '192x192', type: 'image/png' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/sheets\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sheets-api-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 300 }
            }
          }
        ]
      }
    })
  ]
})
