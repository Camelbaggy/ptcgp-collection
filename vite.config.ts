import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// Base configurable pour GitHub Pages : BASE_PATH=/ptcgp-app/ npm run build
const raw = process.env.BASE_PATH || '/'
const base = (raw.startsWith('/') ? raw : '/' + raw).replace(/\/?$/, '/')

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'data/*.json', 'cards/**/*.webp', 'logos/*.webp', 'emblems/*.webp', 'events/*.webp'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: base + 'index.html',
      },
      manifest: {
        name: 'PTCGP Collection',
        short_name: 'PTCGP',
        description: 'Suivi de collection Pokémon TCG Pocket, hors connexion.',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1420',
        theme_color: '#d6342c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
