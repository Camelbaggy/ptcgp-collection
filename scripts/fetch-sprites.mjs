#!/usr/bin/env node
// Pokédex sprites (PokeAPI/sprites on GitHub raw) -> public/sprites/<formId>.png, for every entry of public/data/pokedex.json.
// Existing files are kept (cache-friendly); individual failures are never fatal.
//   node scripts/fetch-sprites.mjs [--out public/sprites] [--dex public/data/pokedex.json] [--only 6,10034,10035]
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sleep, FETCH_TIMEOUT_MS } from './lib/common.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const outDir = resolve(root, arg('--out', 'public/sprites'))
const entries = JSON.parse(await readFile(resolve(root, arg('--dex', 'public/data/pokedex.json')), 'utf8'))
const only = arg('--only', '') ? new Set(arg('--only', '').split(',').map(Number)) : null
const URL_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'

await mkdir(outDir, { recursive: true })
const ids = [...new Set(entries.map((e) => e.spriteId ?? e.formId))].filter((id) => !only || only.has(id))
const exists = (p) => stat(p).then((s) => s.size > 0, () => false)
let done = 0, skipped = 0, failed = 0

async function one(id) {
  const file = join(outDir, id + '.png')
  if (await exists(file)) { skipped++; return }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(URL_BASE + id + '.png', { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (r.status === 404) break
      if (!r.ok) throw new Error('HTTP ' + r.status)
      await writeFile(file, Buffer.from(await r.arrayBuffer()))
      done++
      return
    } catch { await sleep(500 * (attempt + 1)) }
  }
  failed++
}

const queue = [...ids]
await Promise.all(Array.from({ length: 8 }, async () => { for (let id; (id = queue.shift()) !== undefined;) await one(id) }))
console.log(`sprites: ${done} downloaded, ${skipped} already there, ${failed} missing (of ${ids.length})`)
