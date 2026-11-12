#!/usr/bin/env node
// Pokédex sprites (PokeAPI/sprites on GitHub raw) -> public/sprites/<formId>.png, for every entry of public/data/pokedex.json.
// Existing files are kept (cache-friendly); individual failures are never fatal.
// Transparent margins are cropped (bounding box of the non-transparent pixels, PokeAPI sprites are 96×96 with the
// Pokémon drawn small in the middle), so the UI can scale every sprite up to fill its tile. Files restored from the
// CI cache are cropped in place too (a no-op when already cropped).
//   node scripts/fetch-sprites.mjs [--out public/sprites] [--dex public/data/pokedex.json] [--only 6,10034,10035]
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sleep, FETCH_TIMEOUT_MS, loadSharp } from './lib/common.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const outDir = resolve(root, arg('--out', 'public/sprites'))
const entries = JSON.parse(await readFile(resolve(root, arg('--dex', 'public/data/pokedex.json')), 'utf8'))
const only = arg('--only', '') ? new Set(arg('--only', '').split(',').map(Number)) : null
const sharp = loadSharp()
const URL_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'

await mkdir(outDir, { recursive: true })
const ids = [...new Set(entries.map((e) => e.spriteId ?? e.formId))].filter((id) => !only || only.has(id))
const exists = (p) => stat(p).then((s) => s.size > 0, () => false)
let done = 0, skipped = 0, failed = 0, cropped = 0

/** Crops fully transparent rows/columns (alpha 0). Returns null when there is nothing to crop or the image is empty. */
export async function cropSprite(sharp, buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: c } = info
  let top = h, bottom = -1, left = w, right = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + c - 1] === 0) continue
    if (y < top) top = y
    if (y > bottom) bottom = y
    if (x < left) left = x
    if (x > right) right = x
  }
  if (bottom < 0 || (top === 0 && left === 0 && bottom === h - 1 && right === w - 1)) return null
  return sharp(buf).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).png({ compressionLevel: 9 }).toBuffer()
}

async function one(id) {
  const file = join(outDir, id + '.png')
  if (await exists(file)) {
    skipped++
    try { const out = await cropSprite(sharp, await readFile(file)); if (out) { await writeFile(file, out); cropped++ } } catch { /* keep as is */ }
    return
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(URL_BASE + id + '.png', { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (r.status === 404) break
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const buf = Buffer.from(await r.arrayBuffer())
      let out = null
      try { out = await cropSprite(sharp, buf) } catch { /* keep the original */ }
      await writeFile(file, out ?? buf)
      done++
      return
    } catch { await sleep(500 * (attempt + 1)) }
  }
  failed++
}

const queue = [...ids]
await Promise.all(Array.from({ length: 8 }, async () => { for (let id; (id = queue.shift()) !== undefined;) await one(id) }))
console.log(`sprites: ${done} downloaded (cropped), ${skipped} already there (cropped now ${cropped}), ${failed} missing (of ${ids.length})`)
