// Shared helpers for the asset-fetching scripts (logos, emblems). Network failures are never fatal.
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'

const require = createRequire(import.meta.url)
export function loadSharp() {
  for (const p of [process.env.SHARP_PATH, 'sharp', '/tmp/sh/node_modules/sharp'].filter(Boolean)) {
    try { return require(p) } catch { /* try next */ }
  }
  console.error('sharp not found: npm i -D sharp (or SHARP_PATH=...)')
  process.exit(1)
}

/** Maximum duration of one HTTP request in the download scripts. */
export const FETCH_TIMEOUT_MS = 30000
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const UA = 'Mozilla/5.0 (compatible; ptcgp-collection-asset-fetch)'

/** GET with retries. Returns Buffer, or null on 404 / persistent failure (never throws). */
export async function getBuffer(url, { retries = 2, headers = {} } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, ...headers }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return Buffer.from(await r.arrayBuffer())
    } catch (e) {
      if (attempt === retries) { console.warn(`  ! ${url}: ${e.message}`); return null }
      await sleep(500 * (attempt + 1))
    }
  }
  return null
}

export async function getText(url, opts) {
  const b = await getBuffer(url, opts)
  return b ? b.toString('utf8') : null
}

/** MediaWiki upload path: /<md5[0]>/<md5[0:2]>/<filename> (spaces already turned into underscores). */
export function mediaWikiPath(filename) {
  const h = createHash('md5').update(filename, 'utf8').digest('hex')
  return `${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(filename)}`
}

/** Lowercase, no accents, alphanumerics only, single spaces. */
export const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** ASCII file name for a booster emblem (keep in sync with src/lib/assets.ts). */
export const emblemFile = (boosterId) => boosterId.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_') + '.webp'
