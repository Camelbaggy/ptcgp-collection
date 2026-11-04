#!/usr/bin/env node
// Builds public/data/pokedex.json (official Pokédex: base species + Mega evolutions + regional forms) from the
// PokeAPI CSV dump on GitHub (pokeapi.co itself is not needed). The generation list is read from the data, so a new
// generation appears automatically once PokeAPI publishes it. Sprites are NOT part of this file: they are fetched at
// deploy time (scripts/fetch-sprites.mjs) as public/sprites/<formId>.png (spriteId === formId).
//
//   node scripts/build-pokedex.mjs [--out public/data/pokedex.json] [--csv-dir <local dir with the CSVs>]
//
// Entry: { dex, formId, gen, nameFr, nameEn, formLabelFr?, formLabelEn?, formKind, types[] }
//   formKind 'base' | 'mega' | 'regional' ; types = PokeAPI type ids (1..18) ; gen = generation of the species.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
const args = process.argv.slice(2)
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const out = resolve(root, arg('--out', 'public/data/pokedex.json'))
const csvDir = arg('--csv-dir', '')

export function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

async function load(name) {
  if (csvDir) return parseCsv(await readFile(join(csvDir, name + '.csv'), 'utf8'))
  const r = await fetch(BASE + name + '.csv')
  if (!r.ok) throw new Error(`${name}.csv: HTTP ${r.status}`)
  return parseCsv(await r.text())
}

const REGIONS = {
  alola: { fr: "d'Alola", en: 'Alolan' },
  galar: { fr: 'de Galar', en: 'Galarian' },
  hisui: { fr: 'de Hisui', en: 'Hisuian' },
  paldea: { fr: 'de Paldea', en: 'Paldean' },
}
const EXTRA = {
  combat: ['Race Combat', 'Combat Breed'], blaze: ['Race Flamme', 'Blaze Breed'], aqua: ['Race Aqua', 'Aqua Breed'],
  female: ['Femelle', 'Female'], curly: ['Courbée', 'Curly'], droopy: ['Affaissée', 'Droopy'], stretchy: ['Raide', 'Stretchy'],
  original: ['Originel', 'Original'],
}
const SKIP_TOKENS = new Set(['totem', 'cap', 'zen', 'gmax', 'eternamax', 'primal'])
const IGNORED = new Set(['male', 'standard', 'breed'])
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** Form of a PokeAPI pokemon identifier relative to its species identifier, or null when it is not wanted. */
export function classifyForm(identifier, speciesIdentifier) {
  if (!identifier.startsWith(speciesIdentifier + '-')) return null
  const toks = identifier.slice(speciesIdentifier.length + 1).split('-')
  if (toks.some((t) => SKIP_TOKENS.has(t))) return null
  const region = toks.find((t) => REGIONS[t])
  const mega = toks.includes('mega')
  if (!region && !mega) return null
  const rest = toks.filter((t) => t !== 'mega' && !REGIONS[t] && !IGNORED.has(t))
  const letter = rest.find((t) => /^[xyz]$/.test(t))
  const extras = rest.filter((t) => t !== letter)
  const ex = extras.map((t) => EXTRA[t] ?? [cap(t), cap(t)])
  if (mega) {
    const L = letter ? ' ' + letter.toUpperCase() : ''
    const x = ex.length ? ` (${ex.map((e) => e[0]).join(', ')})` : ''
    const xe = ex.length ? ` (${ex.map((e) => e[1]).join(', ')})` : ''
    return { kind: 'mega', fr: 'Méga' + L + x, en: 'Mega' + L + xe }
  }
  const x = ex.length ? ` (${ex.map((e) => e[0]).join(', ')})` : ''
  const xe = ex.length ? ` (${ex.map((e) => e[1]).join(', ')})` : ''
  return { kind: 'regional', fr: REGIONS[region].fr + x, en: REGIONS[region].en + xe }
}

export function buildPokedex({ species, speciesNames, pokemon, pokemonTypes }) {
  const names = new Map() // `${species_id}:${lang}` -> name
  for (const n of speciesNames) if (n.local_language_id === '5' || n.local_language_id === '9') names.set(`${n.pokemon_species_id}:${n.local_language_id}`, n.name)
  const bySpecies = new Map(species.map((s) => [s.id, s]))
  const types = new Map()
  for (const t of [...pokemonTypes].sort((a, b) => Number(a.slot) - Number(b.slot))) {
    if (!types.has(t.pokemon_id)) types.set(t.pokemon_id, [])
    types.get(t.pokemon_id).push(Number(t.type_id))
  }
  const entries = []
  for (const p of pokemon) {
    const s = bySpecies.get(p.species_id)
    if (!s) continue
    const nameFr = names.get(`${s.id}:5`) || names.get(`${s.id}:9`)
    const nameEn = names.get(`${s.id}:9`)
    if (!nameEn) continue
    let f = null
    if (p.is_default === '1') f = { kind: 'base', fr: '', en: '' }
    else {
      f = classifyForm(p.identifier, s.identifier)
      if (!f) continue
    }
    const e = { dex: Number(s.id), formId: Number(p.id), gen: Number(s.generation_id), nameFr, nameEn }
    if (f.fr) { e.formLabelFr = f.fr; e.formLabelEn = f.en }
    e.formKind = f.kind
    e.types = types.get(p.id) ?? (f.kind !== 'base' ? types.get(String(Number(s.id))) : null) ?? []
    entries.push(e)
  }
  const rank = { base: 0, regional: 1, mega: 2 }
  entries.sort((a, b) => a.dex - b.dex || rank[a.formKind] - rank[b.formKind] || a.formId - b.formId)
  return entries
}

async function main() {
  const [species, speciesNames, pokemon, pokemonTypes] = await Promise.all(
    ['pokemon_species', 'pokemon_species_names', 'pokemon', 'pokemon_types'].map(load))
  const entries = buildPokedex({ species, speciesNames, pokemon, pokemonTypes })
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, '[\n' + entries.map((e) => JSON.stringify(e)).join(',\n') + '\n]\n')
  const byGen = {}, byKind = {}
  for (const e of entries) { byGen[e.gen] = (byGen[e.gen] ?? 0) + 1; byKind[e.formKind] = (byKind[e.formKind] ?? 0) + 1 }
  console.log(`pokedex.json: ${entries.length} entries`, JSON.stringify(byKind), 'by gen', JSON.stringify(byGen))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
