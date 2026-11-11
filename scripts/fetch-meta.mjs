#!/usr/bin/env node
// Builds public/data/meta.json (Méta tier list) from Limitless (play.limitlesstcg.com/api).
// Never fatal: on any failure the previous meta.json is kept (or the deployed one is downloaded), exit 0.
//
//   node scripts/fetch-meta.mjs [--out public/data/meta.json] [--cards public/data/cards.json]
//        [--days 14] [--cap 200] [--now <ISO>] [--prev <previous meta.json, for the 24 h score change>]
//        [--fixture-dir <dir: list*.json + <id>.details|standings|pairings.json, as captured from the API>]
// Per tournament: details (format, banned cards), standings (deck per player) and pairings (match results): 3 requests.
//   env META_FALLBACK_URL (default: the published file on branch data, see update-meta.yml)
//
// The pure logic lives in src/lib/meta/compute.ts (unit-tested); Node >= 22.18 runs .ts directly.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }
const out = resolve(root, opt('out', 'public/data/meta.json'))
const cardsFile = resolve(root, opt('cards', 'public/data/cards.json'))
const days = Number(opt('days', 14))
const cap = Number(opt('cap', 200))
const fixtureDir = opt('fixture-dir', '')
const prevFile = opt('prev', '')
const now = opt('now', '') ? Date.parse(opt('now', '')) : Date.now()
const API = 'https://play.limitlesstcg.com/api'
const UA = 'ptcgp-collection (+https://github.com/Camelbaggy/ptcgp-collection)'
const FALLBACK = process.env.META_FALLBACK_URL || "https://raw.githubusercontent.com/Camelbaggy/ptcgp-collection/data/meta.json"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const { computeMeta, selectTournaments, isStandardRules } = await import(new URL('../src/lib/meta/compute.ts', import.meta.url).href)

async function get(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(API + path, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(60000) })
    if (r.status === 429 || r.status >= 500) { await sleep(10000 * (attempt + 1)); continue }
    if (!r.ok) throw new Error(`${path} : HTTP ${r.status}`)
    return r.json()
  }
  throw new Error(`${path} : too many retries`)
}

/** Fixture file, or null when absent / not JSON (the CI capture contains rate-limit error bodies). */
async function fixtureJson(f) {
  try { return JSON.parse(await readFile(resolve(fixtureDir, f), 'utf8')) } catch { return null }
}
const fetchJson = (id, what) => (fixtureDir ? fixtureJson(`${id}.${what}.json`) : get(`/tournaments/${id}${what === 'details' ? '' : '/' + what}`))

async function listTournaments() {
  if (fixtureDir) return (await Promise.all(['list1.json', 'list2.json'].map((f) => fixtureJson(f)))).flatMap((x) => x ?? [])
  const all = []
  const cutoff = now - days * 86400000
  for (let page = 1; page <= 12; page++) {
    const rows = await get(`/tournaments?game=POCKET&limit=100&page=${page}`)
    if (!Array.isArray(rows) || !rows.length) break
    all.push(...rows)
    if (rows.some((t) => Date.parse(t.date) < cutoff) || rows.length < 100) break
    await sleep(800)
  }
  return all
}

/** Previously published meta.json (local --prev file, else the deployed one), used for the 24 h score change. Null on any problem. */
async function previousMeta() {
  try {
    const t = prevFile ? await readFile(resolve(root, prevFile), 'utf8') : fixtureDir ? '' : await (await fetch(FALLBACK, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })).text()
    const m = t.trim().startsWith('{') ? JSON.parse(t) : null
    // Only a file at least ~12 h older than this run is a meaningful "yesterday".
    return m && m.version === 2 && now - Date.parse(m.generatedAt) >= 12 * 3600000 ? m : null
  } catch { return null }
}

async function build() {
  const cards = JSON.parse(await readFile(cardsFile, 'utf8'))
  const picked = selectTournaments(await listTournaments(), now, { days, cap })
  if (!picked.length) throw new Error('no eligible tournament')
  console.log(`${picked.length} tournaments`)
  const data = []
  let skipped = 0
  for (const t of picked) {
    try {
      const details = await fetchJson(t.id, 'details').catch(() => null)
      if (!isStandardRules(details)) { skipped++; if (!fixtureDir) await sleep(800); continue }
      const standings = await fetchJson(t.id, 'standings')
      if (!Array.isArray(standings)) throw new Error('no standings')
      if (!fixtureDir) await sleep(800)
      const pairings = await fetchJson(t.id, 'pairings').catch((e) => { console.warn(`! ${t.id} pairings : ${e.message}`); return null })
      data.push({ tournament: t, standings, pairings: Array.isArray(pairings) ? pairings : null })
    } catch (e) { console.warn(`! ${t.id} : ${e.message}`) }
    if (!fixtureDir) await sleep(800)
  }
  console.log(`${data.length} tournaments kept (${skipped} with banned cards / custom rules skipped)`)
  if (data.length < Math.min(3, picked.length - skipped)) throw new Error(`only ${data.length}/${picked.length} tournaments fetched`)
  const prev = await previousMeta()
  const meta = computeMeta(data, cards, now, prev)
  if (!meta.decks.length) throw new Error('empty result')
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(meta))
  console.log(`meta.json : ${meta.decks.length} decks, ${meta.windows['7d'].players} entries, ${meta.windows['7d'].matches} matches (7d)`)
}

async function keepPrevious() {
  try { await access(out); console.warn('Keeping the existing meta.json'); return }
  catch { /* none */ }
  try {
    const r = await fetch(FALLBACK, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })
    const t = await r.text()
    if (!r.ok || !t.trim().startsWith('{')) throw new Error(`HTTP ${r.status}`)
    JSON.parse(t)
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, t)
    console.warn('Previous meta.json restored from ' + FALLBACK)
  } catch (e) { console.warn(`No previous meta.json available (${e.message}); the app will show an empty state.`) }
}

try { await build() } catch (e) { console.warn(`! fetch-meta failed : ${e.message}`); await keepPrevious() }
