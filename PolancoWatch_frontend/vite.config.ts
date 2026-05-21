import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // Prompt the user to update when a new version is available
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'PolancoWatch',
        short_name: 'PolancoWatch',
        description: 'Advanced System & Container Monitoring',
        theme_color: '#0d0d1a',
        background_color: '#0d0d1a',
        display: 'standalone',
        icons: [
          {
            src: 'p192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'p512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'p512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/hangfire': {
        target: 'http://localhost:5246',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
