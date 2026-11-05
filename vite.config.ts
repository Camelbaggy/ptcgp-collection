import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// Base configurable pour GitHub Pages : BASE_PATH=/ptcgp-app/ npm run build
const raw = process.env.BASE_PATH || '/'
const base = (raw.startsWith('/') ? raw : '/' + raw).replace(/\/?$/, '/')

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const buildId = (process.env.GITHUB_SHA || 'local').slice(0, 7)
const buildDate = new Date().toISOString()

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __APP_BUILD__: JSON.stringify(buildId), __APP_BUILD_DATE__: JSON.stringify(buildDate) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'data/*.json', 'logos/*.webp', 'emblems/*.webp'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webp,woff2}'],
        // Gros volumes : mis en cache à l'usage (runtimeCaching), pas au premier chargement.
        globIgnores: ['cards/**', 'packs/**', 'sprites/**', 'items/**', 'events/**'],
        runtimeCaching: [{
          urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
            sameOrigin && /\/(cards|packs|sprites|items|events)\/[^/]+/.test(url.pathname) && /\.(webp|png|jpe?g)$/.test(url.pathname),
          handler: 'CacheFirst',
          options: {
            cacheName: 'ptcgp-images',
            expiration: { maxEntries: 10000 },
            cacheableResponse: { statuses: [0, 200] },
          },
        }],
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
