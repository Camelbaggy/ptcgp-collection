#!/usr/bin/env node
// Builds the events schedule ("Programme") -> public/data/events.json (+ public/events/<id>.webp, max 400px).
// Sources: Serebii event lists (Special / Drop / Wonder Pick / Emblem / Mass Outbreak) and public/data/releases.json
// (manual, committed: upcoming expansions [{setId?, name, date: "YYYY-MM-DD"}]) merged in as "expansion" events.
// Serebii only gives dates: events start/end at 06:00 UTC of their start/end date (see src/lib/events/parse.ts).
// Keeps events ending after today - 30 days. Never fatal: on network failure the previous events.json is kept.
//
//   node scripts/fetch-events.mjs [--fixtures scripts/fixtures/serebii] [--out public/data/events.json]
//        [--images public/events] [--no-images] [--force-images] [--now 2026-11-04T12:00:00Z]
// (needs Node >= 22.18: the pure parsers are src/lib/events/parse.ts, run directly as TypeScript)
import { register } from 'node:module'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getBuffer, loadSharp } from './lib/common.mjs'

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx) } catch (e) {
    if (spec.startsWith('.') && !/\\.[a-z]+$/.test(spec)) return next(spec + '.ts', ctx)
    throw e
  }
}`), pathToFileURL('./'))

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d }
const flag = (n) => { const i = args.indexOf(`--${n}`); if (i >= 0) args.splice(i, 1); return i >= 0 }
const fixtures = opt('fixtures', '')
const outFile = resolve(root, opt('out', 'public/data/events.json'))
const imgDir = resolve(root, opt('images', 'public/events'))
const noImages = flag('no-images') || !!fixtures
const forceImages = flag('force-images')
const now = new Date(opt('now', '') || Date.now())
const cutoff = new Date(now.getTime() - 30 * 86400000)
const dataDir = resolve(root, 'public/data')

const { buildEvents, parseEventDetails, parseHomeReleases, releaseEvents, SEREBII } = await import(new URL('../src/lib/events/parse.ts', import.meta.url).href)

const PAGES = { events: 'events', drop: 'dropevents', wonderpick: 'wonderpickevents', emblem: 'emblemevents', massoutbreak: 'massoutbreakevents' }
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

async function page(url, local) {
  if (fixtures) return readFile(resolve(root, fixtures, local), 'utf8').catch(() => null)
  const b = await getBuffer(url, { headers: { 'user-agent': UA, accept: 'text/html' } })
  return b ? b.toString('utf8') : null
}
const readJson = async (f, d) => { try { return JSON.parse(await readFile(f, 'utf8')) } catch { return d } }

const html = {}
for (const [k, f] of Object.entries(PAGES)) {
  html[k] = await page(`${SEREBII}/tcgpocket/${f}.shtml`, `${f}.html`)
  if (html[k] == null) console.warn(`! ${f}: unavailable`)
}
if (!html.events && !html.drop && !html.wonderpick && !html.emblem && !html.massoutbreak) {
  console.warn('No Serebii page reachable: events.json left untouched.')
  process.exit(0)
}
const homeHtml = (await page(`${SEREBII}/tcgpocket/`, 'home.html')) ?? ''

const sets = await readJson(join(dataDir, 'sets.json'), [])
const cards = await readJson(join(dataDir, 'cards.json'), [])
const cardIds = new Set(cards.map((c) => c.id))

const events = buildEvents(html, cutoff)

// Featured cards: individual pages of drop / wonderpick events that are not over yet (best effort).
let withCards = 0
for (const e of events) {
  if (!['drop', 'wonderpick'].includes(e.type) || Date.parse(e.end) < now.getTime()) continue
  const h = await page(e.url, `event-${e.slug}.html`)
  const d = h ? parseEventDetails(h, sets, cardIds) : null
  if (d?.cardIds.length) {
    e.cardIds = d.cardIds
    if (d.bonusCardIds.length) e.bonusCardIds = d.bonusCardIds
    if (d.rewards.length) e.rewards = d.rewards
    withCards++
  }
}

// Images -> public/events/<id>.webp
let images = 0
if (!noImages) {
  const sharp = loadSharp()
  await mkdir(imgDir, { recursive: true })
  for (const e of events) {
    if (!e.imageSrc) continue
    const file = join(imgDir, `${e.id}.webp`)
    const have = await stat(file).then((s) => s.size > 0, () => false)
    if (!have || forceImages) {
      const buf = await getBuffer(e.imageSrc, { headers: { 'user-agent': UA } })
      if (!buf) continue
      try { await writeFile(file, await sharp(buf).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()) } catch (err) { console.warn(`  ! ${e.id}: ${err.message}`); continue }
    }
    e.image = `events/${e.id}.webp`
    images++
  }
}

// Expansions: manual releases.json first (wins), then anything announced on the Serebii home page.
const manual = await readJson(join(dataDir, 'releases.json'), [])
const releases = [...manual, ...parseHomeReleases(homeHtml, now).filter((r) => !manual.some((m) => m.date === r.date))]
const all = [...events.map(({ imageSrc, slug, ...e }) => e), ...releaseEvents(releases, cutoff)]
  .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))

await mkdir(dirname(outFile), { recursive: true })
await writeFile(outFile, JSON.stringify(all, null, 1) + '\n')
const n = {}
for (const e of all) n[e.type] = (n[e.type] ?? 0) + 1
console.log(`events.json: ${all.length} events`, n, `| with cards: ${withCards}, images: ${images}`)
