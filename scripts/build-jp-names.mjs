#!/usr/bin/env node
// Japanese romanised names used in game asset file names (`cPK_10_000010_00_FUSHIGIDANE_C`) -> French card names.
// Pokémon-Zone names cosmetics after them (`PLAYMAT_100920_MEGAGEKKOUGA`), so the event sheets can say « Tapis de jeu
// Méga-Amphinobi ». Source: the community dataset (flibustier/pokemon-tcg-pocket-database, `image` file names) joined with
// our public/data/cards.json by set + number. Output: public/data/jp-names.json { TOKEN: "Nom FR" } (committed).
//
//   node scripts/build-jp-names.mjs [--src <url|file>]
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getText } from './lib/common.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const i = args.indexOf('--src')
const src = i >= 0 ? args[i + 1] : 'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/cards.json'

const text = /^https?:/.test(src) ? await getText(src) : await readFile(src, 'utf8')
if (!text) { console.log('jp-names: source unreachable, file left unchanged'); process.exit(0) }
const community = JSON.parse(text)
const ours = JSON.parse(await readFile(resolve(root, 'public/data/cards.json'), 'utf8'))
const byKey = new Map(ours.map((c) => [`${c.setId}|${c.number}`, c]))
const setOf = (s) => (/^P-?[A-Z]$/i.test(s) ? 'P-' + s.slice(-1).toUpperCase() : s)

/** token -> {fr name -> count} */
const votes = new Map()
for (const c of community) {
  const m = /^c(?:PK|TR)_\d+_\d+_\d+_([A-Za-z0-9]+?)(?:ex)?_[A-Za-z]+\.webp$/.exec(c.image ?? '')
  const card = byKey.get(`${setOf(c.set)}|${c.number}`)
  if (!m || !card?.name) continue
  const token = m[1].toUpperCase()
  const fr = card.name.replace(/[- ]ex$/i, '').trim()
  const v = votes.get(token) ?? new Map()
  v.set(fr, (v.get(fr) ?? 0) + 1)
  votes.set(token, v)
}
const out = {}
for (const t of [...votes.keys()].sort()) out[t] = [...votes.get(t)].sort((a, b) => b[1] - a[1])[0][0]
await writeFile(resolve(root, 'public/data/jp-names.json'), JSON.stringify(out) + '\n')
console.log(`jp-names: ${Object.keys(out).length} names`)
