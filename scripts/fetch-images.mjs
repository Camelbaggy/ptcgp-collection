#!/usr/bin/env node
// Download PTCGP card images, resize to <=300px wide, convert to webp.
// Output: public/cards/<setId>/<cardId>.webp   (cardId = "<setId>-<number>", e.g. A1-1, P-A-5)
// Skips files that already exist. Needs `sharp` (npm i -D sharp, or SHARP_PATH=/path/to/node_modules/sharp).
//
// Usage:
//   node scripts/fetch-images.mjs --all
//   node scripts/fetch-images.mjs A1 A2a B4b P-A         # specific sets (promos: P-A, not PROMO-A)
//   options: --width 300 --quality 60 --concurrency 6 --lang fr --quality-effort 5
//            --base https://assets.tcgdex.net   --dataset <url or local cards.json> --out public/cards
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
let sharp
for (const p of [process.env.SHARP_PATH, 'sharp', '/tmp/sh/node_modules/sharp'].filter(Boolean)) {
  try { sharp = require(p); break } catch { /* try next */ }
}
if (!sharp) { console.error('sharp not found: npm i -D sharp (or SHARP_PATH=...)'); process.exit(1) }

const args = process.argv.slice(2)
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : def }
const flag = (name) => { const i = args.indexOf(`--${name}`); if (i >= 0) args.splice(i, 1); return i >= 0 }
const all = flag('all')
const width = Number(opt('width', 300))
const quality = Number(opt('quality', 60))
const effort = Number(opt('quality-effort', 5))
const concurrency = Number(opt('concurrency', 6))
const lang = opt('lang', 'fr')
const base = opt('base', 'https://assets.tcgdex.net')
const dataset = opt('dataset', 'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/cards.json')
const outDir = resolve(root, opt('out', 'public/cards'))
const wanted = new Set(args.filter((a) => !a.startsWith('--')).map((s) => s.toUpperCase()))
if (!all && !wanted.size) { console.error('Give set ids or --all'); process.exit(1) }

const toSetId = (code) => (/^PROMO-/i.test(code) ? `P-${code.slice(6).toUpperCase()}` : code)
const exists = (f) => stat(f).then((s) => s.size > 0, () => false)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function loadDataset() {
  if (/^https?:/.test(dataset)) {
    const r = await fetch(dataset)
    if (!r.ok) throw new Error(`dataset HTTP ${r.status}`)
    return r.json()
  }
  return JSON.parse(await readFile(resolve(dataset), 'utf8'))
}

async function download(urls) {
  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url)
        if (r.status === 404) break
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return Buffer.from(await r.arrayBuffer())
      } catch (e) {
        if (attempt === 2) throw e
        await sleep(500 * (attempt + 1))
      }
    }
  }
  return null
}

const cards = (await loadDataset()).filter((c) => c.number > 0)
const jobs = cards
  .map((c) => ({ setId: toSetId(c.set), number: c.number }))
  .filter((j) => all || wanted.has(j.setId.toUpperCase()))
const missingSets = [...wanted].filter((w) => !jobs.some((j) => j.setId.toUpperCase() === w))
if (missingSets.length) console.warn('Unknown sets:', missingSets.join(', '))

let done = 0, skipped = 0, failed = [], bytes = 0, written = 0
const queue = [...jobs]
async function worker() {
  for (let j; (j = queue.shift()); ) {
    const id = `${j.setId}-${j.number}`
    const file = join(outDir, j.setId, `${id}.webp`)
    if (await exists(file)) { skipped++; continue }
    const n = String(j.number).padStart(3, '0')
    const urls = [lang, 'en'].filter((v, i, a) => a.indexOf(v) === i)
      .map((l) => `${base}/${l}/tcgp/${j.setId}/${n}/high.webp`)
    try {
      const src = await download(urls)
      if (!src) { failed.push(id); continue }
      const out = await sharp(src).resize({ width, withoutEnlargement: true })
        .webp({ quality, effort }).toBuffer()
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, out)
      bytes += out.length; written++
    } catch (e) { failed.push(`${id} (${e.message})`) }
    if (++done % 50 === 0) console.log(`${done} done...`)
  }
}
await Promise.all(Array.from({ length: concurrency }, worker))
console.log(`written ${written} (${(bytes / 1048576).toFixed(1)} MB, avg ${written ? Math.round(bytes / written / 1024) : 0} KB), skipped ${skipped}, failed ${failed.length}`)
if (failed.length) { console.log('failed:', failed.slice(0, 40).join(', ')); process.exitCode = 2 }
