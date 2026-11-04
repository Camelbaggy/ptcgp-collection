#!/usr/bin/env node
// Brings public/data up to date with the community dataset (flibustier/pokemon-tcg-pocket-database):
// new sets (+ boosters, cards, reprint links, slug, rates) and new cards of existing sets.
// Idempotent: nothing new -> no file touched, exit 0. Network failures on optional sources are warnings.
//
//   node scripts/update-sets.mjs [--dry-run] [--data public/data] [--no-tcgdex] [--summary summary.md]
//   env PUBLIC_DATA_BASE=<dir or url>  (tests / mirror), TCGDEX_API=<url>
//
// The pure logic lives in src/lib/importers/updateSets.ts (unit-tested); Node >= 22.18 runs the .ts files
// directly, a tiny resolve hook below adds the missing ".ts" extensions of the extension-less imports.
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
const flag = (n) => { const i = args.indexOf(`--${n}`); if (i >= 0) args.splice(i, 1); return i >= 0 }
const dry = flag('dry-run')
const noTcgdex = flag('no-tcgdex')
const dataDir = resolve(root, opt('data', 'public/data'))
const summaryFile = opt('summary', '')
const BASE = (process.env.PUBLIC_DATA_BASE || 'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist').replace(/\/$/, '')
const TCGDEX = (process.env.TCGDEX_API || 'https://api.tcgdex.net/v2').replace(/\/$/, '')

const { mergePublicData, setsNeedingFrench } = await import(new URL('../src/lib/importers/updateSets.ts', import.meta.url).href)
const { frenchNamesFromTcgdex } = await import(new URL('../src/lib/importers/publicSource.ts', import.meta.url).href)

async function getJson(src, { optional = false } = {}) {
  try {
    if (!/^https?:/.test(src)) return JSON.parse(await readFile(src, 'utf8'))
    const r = await fetch(src, { signal: AbortSignal.timeout(60000), headers: { 'user-agent': 'ptcgp-collection-update-sets' } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.json()
  } catch (e) {
    if (!optional) throw new Error(`${src} : ${e.message}`)
    console.warn(`! ${src} : ${e.message}`)
    return null
  }
}
const file = (n) => resolve(dataDir, n)
// Same layout as the committed files: 1-space indent, trailing newline only if the file had one.
const eol = {}
const ser = (n, v) => JSON.stringify(v, null, 1) + (eol[n] ? '\n' : '')
const readRef = async (n) => {
  const t = await readFile(file(n), 'utf8')
  eol[n] = t.endsWith('\n')
  return JSON.parse(t)
}

const ref = {
  sets: await readRef('sets.json'), boosters: await readRef('boosters.json'),
  cards: await readRef('cards.json'), rates: await readRef('rates.json'), slugs: await readRef('set-slugs.json'),
}
const join = (n) => (/^https?:/.test(BASE) ? `${BASE}/${n}` : resolve(BASE, n))
const [pubSets, pubCards, pullRates] = await Promise.all([
  getJson(join('sets.json')), getJson(join('cards.extra.json')), getJson(join('pullRates.json'), { optional: true }),
])
const sets = Object.values(pubSets).flat()

// French names (TCGdex): only reachable from CI; absence is only a warning.
const french = {}
let tcgdexDown = false
if (!noTcgdex) {
  for (const id of setsNeedingFrench(ref, { sets, cards: pubCards })) {
    const j = await getJson(`${TCGDEX}/fr/sets/${encodeURIComponent(id)}`, { optional: true })
    if (!j) { tcgdexDown = true; continue }
    french[id] = { name: j.name, cards: frenchNamesFromTcgdex(j) }
  }
}

const res = mergePublicData(ref, { sets, cards: pubCards, pullRates: pullRates ?? undefined, french })
if (tcgdexDown) res.report.warnings.push('TCGdex injoignable : noms français non récupérés (relancé automatiquement au prochain passage).')
const r = res.report

const lines = []
for (const s of r.newSets)
  lines.push(`- Nouvelle extension ${s.id} « ${s.name} » : ${s.cards} cartes, ${s.boosters} booster(s), ${s.reprints} réimpression(s) rattachée(s), taux ${s.rates === 'public' ? 'importés de la base communautaire' : s.rates === 'placeholder' ? 'ESTIMÉS (copie d\'une extension voisine)' : 'absents'}`)
for (const [id, n] of Object.entries(r.newCards)) lines.push(`- ${n} nouvelle(s) carte(s) dans ${id}`)
if (r.relinkedCards) lines.push(`- ${r.relinkedCards} carte(s) existante(s) rattachée(s) à de nouveaux boosters (réimpressions)`)
if (r.translatedCards) lines.push(`- ${r.translatedCards} carte(s) traduite(s) en français`)
for (const w of r.warnings) lines.push(`- Attention : ${w}`)

if (!res.changed) {
  console.log('update-sets : rien de nouveau.')
  for (const l of lines) console.log(l)
  if (summaryFile) await writeFile(resolve(root, summaryFile), '')
  process.exit(0)
}

console.log(`update-sets : ${dry ? '(simulation) ' : ''}changements :`)
for (const l of lines) console.log(l)
if (!dry) {
  const d = res.data
  await writeFile(file('sets.json'), ser('sets.json', d.sets))
  await writeFile(file('boosters.json'), ser('boosters.json', d.boosters))
  await writeFile(file('cards.json'), ser('cards.json', d.cards))
  await writeFile(file('rates.json'), ser('rates.json', d.rates))
  await writeFile(file('set-slugs.json'), ser('set-slugs.json', d.slugs))
}
if (summaryFile) await writeFile(resolve(root, summaryFile), lines.join('\n') + '\n')
