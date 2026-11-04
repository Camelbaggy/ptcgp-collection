#!/usr/bin/env node
// Adds Card.entityId / entityKind (in-game entity of the card, needed for the deck QR codes) to public/data/cards.json
// from the community dataset (flibustier/pokemon-tcg-pocket-database dist/cards.json, asset file names).
// Idempotent: cards that already have an id are left alone. Keeps the file layout (1-space indent).
//
//   node scripts/add-entity-ids.mjs [--dry-run] [--data public/data] [--src <file or url>]
import { register } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

register(
  'data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx) } catch (e) {
    if (spec.startsWith('.') && !/\\.[a-z]+$/.test(spec)) return next(spec + '.ts', ctx)
    throw e
  }
}`),
  pathToFileURL('./'),
)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d }
const dry = args.includes('--dry-run')
const dataDir = resolve(root, opt('data', 'public/data'))
const src = opt('src', 'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/cards.json')

const { addEntityIds } = await import(new URL('../src/lib/importers/entityIds.ts', import.meta.url).href)

const pub = /^https?:/.test(src)
  ? await (await fetch(src, { signal: AbortSignal.timeout(60000) })).json()
  : JSON.parse(await readFile(resolve(src), 'utf8'))
const path = resolve(dataDir, 'cards.json')
const text = await readFile(path, 'utf8')
const { cards, added } = addEntityIds(JSON.parse(text), pub)
const missing = cards.filter((c) => c.entityId === undefined)
console.log(`${added} carte(s) complétée(s) ; ${missing.length}/${cards.length} sans identifiant.`)
const bySet = {}
for (const c of missing) bySet[c.setId] = (bySet[c.setId] ?? 0) + 1
if (missing.length) console.log('Sans identifiant par extension :', JSON.stringify(bySet))
if (added && !dry) await writeFile(path, JSON.stringify(cards, null, 1) + (text.endsWith('\n') ? '\n' : ''))
