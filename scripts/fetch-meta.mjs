#!/usr/bin/env node
// Builds public/data/meta.json (Méta tier list) from Limitless (play.limitlesstcg.com/api).
// Never fatal: on any failure the previous meta.json is kept (or the deployed one is downloaded), exit 0.
//
//   node scripts/fetch-meta.mjs [--out public/data/meta.json] [--cards public/data/cards.json]
//        [--days 14] [--cap 200] [--fixture-dir <dir with tournaments.json + standings.json>] [--now <ISO>]
//   env META_FALLBACK_URL (default: the deployed GitHub Pages file)
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
const now = opt('now', '') ? Date.parse(opt('now', '')) : Date.now()
const API = 'https://play.limitlesstcg.com/api'
const UA = 'ptcgp-collection (+https://github.com/Camelbaggy/ptcgp-collection)'
const FALLBACK = process.env.META_FALLBACK_URL || 'https://camelbaggy.github.io/ptcgp-collection/data/meta.json'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const { computeMeta, selectTournaments } = await import(new URL('../src/lib/meta/compute.ts', import.meta.url).href)

async function get(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(API + path, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(60000) })
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * (attempt + 1)); continue }
    if (!r.ok) throw new Error(`${path} : HTTP ${r.status}`)
    return r.json()
  }
  throw new Error(`${path} : too many retries`)
}

async function listTournaments() {
  if (fixtureDir) return JSON.parse(await readFile(resolve(fixtureDir, 'tournaments.json'), 'utf8'))
  const all = []
  const cutoff = now - days * 86400000
  for (let page = 1; page <= 12; page++) {
    const rows = await get(`/tournaments?game=POCKET&limit=100&page=${page}`)
    if (!Array.isArray(rows) || !rows.length) break
    all.push(...rows)
    if (rows.some((t) => Date.parse(t.date) < cutoff) || rows.length < 100) break
    await sleep(250)
  }
  return all
}

async function build() {
  const cards = JSON.parse(await readFile(cardsFile, 'utf8'))
  const picked = selectTournaments(await listTournaments(), now, { days, cap })
  if (!picked.length) throw new Error('no eligible tournament')
  console.log(`${picked.length} tournaments`)
  const data = []
  for (const t of picked) {
    try {
      const standings = fixtureDir ? JSON.parse(await readFile(resolve(fixtureDir, 'standings.json'), 'utf8')) : await get(`/tournaments/${t.id}/standings`)
      if (Array.isArray(standings)) data.push({ tournament: t, standings })
    } catch (e) { console.warn(`! ${t.id} : ${e.message}`) }
    if (!fixtureDir) await sleep(250)
  }
  if (data.length < Math.min(3, picked.length)) throw new Error(`only ${data.length}/${picked.length} standings fetched`)
  const meta = computeMeta(data, cards, now)
  if (!meta.decks.length) throw new Error('empty result')
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(meta))
  console.log(`meta.json : ${meta.decks.length} decks, ${meta.windows['7d'].players} players (7d)`)
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
