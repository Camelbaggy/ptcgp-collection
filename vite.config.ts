import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import { pzFavoriScript } from './src/lib/importers/pzBookmarklet.ts'

// Base configurable pour GitHub Pages : BASE_PATH=/ptcgp-app/ npm run build
const raw = process.env.BASE_PATH || '/'
const base = (raw.startsWith('/') ? raw : '/' + raw).replace(/\/?$/, '/')

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const buildId = (process.env.GITHUB_SHA || 'local').slice(0, 7)
const isAndroid = process.env.VITE_TARGET === 'android'
// date du commit (et non de la compilation) : les déploiements planifiés du même code (données
// Limitless) produisent alors exactement la même appli, sans bandeau « Nouvelle version »
const buildDate = (() => {
  try { return new Date(execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim()).toISOString() } catch { return new Date().toISOString() }
})()

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __APP_BUILD__: JSON.stringify(buildId), __APP_BUILD_DATE__: JSON.stringify(buildDate), __APP_BUNDLE__: JSON.stringify(process.env.APP_BUNDLE_VERSION || buildId), __APP_TARGET__: JSON.stringify(isAndroid ? 'android' : 'web') },
  plugins: [
    react(),
    {
      // script du favori Pokémon-Zone, chargé depuis le site du joueur (voir pzBookmarklet.ts)
      name: 'pz-favori',
      generateBundle() {
        const sets = JSON.parse(readFileSync(new URL('./public/data/sets.json', import.meta.url), 'utf8')) as { id: string }[]
        this.emitFile({ type: 'asset', fileName: 'pz-favori.js', source: pzFavoriScript(sets.map((x) => (/^P-[A-Z]$/.test(x.id) ? 'PROMO-' + x.id.slice(2) : x.id))) })
      },
    },
    VitePWA({
      // Appli Android (Capacitor) : pas de service worker, le module virtual:pwa-register reste résolu (no-op).
      disable: isAndroid,
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'data/*.json', 'logos/*.webp', 'emblems/*.webp'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webp,woff2}'],
        // Gros volumes : mis en cache à l'usage (runtimeCaching), pas au premier chargement.
        // meta.json (Limitless, plusieurs fois par jour) et app-version.json changent sans que l'appli change :
        // hors précache, sinon chaque déploiement planifié afficherait « Nouvelle version »
        globIgnores: ['pz-favori.js', 'app-version.json', 'data/meta.json', 'cards/**', 'packs/**', 'sprites/**', 'items/**', 'events/**'],
        runtimeCaching: [{
          urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) => sameOrigin && url.pathname.endsWith('/data/meta.json'),
          handler: 'NetworkFirst',
          options: { cacheName: 'ptcgp-meta', networkTimeoutSeconds: 8, expiration: { maxEntries: 2 }, cacheableResponse: { statuses: [200] } },
        }, {
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
        name: 'Holothèque',
        short_name: 'Holothèque',
        description: 'Holothèque : suivi de collection Pokémon TCG Pocket, hors connexion.',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1420',
        theme_color: '#15122e',
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
