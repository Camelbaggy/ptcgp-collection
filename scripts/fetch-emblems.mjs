#!/usr/bin/env node
// Booster emblems from Serebii (https://www.serebii.net/tcgpocket/emblems.shtml): entries "Collect all <pack> Diamond
// cards" / "100 emblem tickets" -> public/emblems/<boosterId, ASCII>.webp (max 128px).
// Never fatal: prints a summary and the unmatched entries.
//
//   node scripts/fetch-emblems.mjs [--force] [--page <url|local .html>] [--out public/emblems]
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emblemFile, getBuffer, getText, loadSharp, norm } from './lib/common.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d }
const flag = (n) => { const i = args.indexOf(`--${n}`); if (i >= 0) args.splice(i, 1); return i >= 0 }
const force = flag('force')
const PAGE = opt('page', 'https://www.serebii.net/tcgpocket/emblems.shtml')
const outDir = resolve(root, opt('out', 'public/emblems'))
const sharp = loadSharp()

// booster id -> English keyword of the pack (Serebii names packs after their legendary/featured Pokemon).
// Single "Unique" boosters are matched on the set's English name instead (SET_EN below, plus sets.json nameEn).
export const PACK_KEYWORD = {
  'A1-Dracaufeu': 'charizard', 'A1-Mewtwo': 'mewtwo', 'A1-Pikachu': 'pikachu',
  'A2-Dialga': 'dialga', 'A2-Palkia': 'palkia',
  'A3-Lunala': 'lunala', 'A3-Solgaleo': 'solgaleo',
  'A4-Ho-Oh': 'ho-oh', 'A4-Lugia': 'lugia',
  'B1-Altaria': 'altaria', 'B1-Braségali': 'blaziken', 'B1-Léviator': 'gyarados',
  'C1-Mewtwo': 'mewtwo', 'C1-Pikachu': 'pikachu',
}
// English set names missing from sets.json (aliases, any may match).
const SET_EN = {
  B3: ['Pulsing Aura'], B3a: ['Paradox Drive'], B3b: ['Happy Days'], B4: ['Celestial Dominance'],
  B4a: ["Team Rocket's Ambition", 'Rocket Ambition'], B4b: ['Deluxe Pack: Mega', 'Deluxe Pack Mega'], C1: ['Double Fusion', 'Fusion Double'],
}

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&rsquo;/g, "'").replace(/&eacute;/g, 'e').replace(/\s+/g, ' ').trim()

/** Entries = table rows (or, failing that, any <img> followed by text) holding an image and a matching description. */
export function parseEmblems(html, pageUrl) {
  const base = new URL(pageUrl)
  const out = []
  const rows = html.split(/<tr[\s>]/i).slice(1)
  for (const row of rows) {
    const m = row.match(/<img[^>]+src=["']([^"']+)["']/i)
    const text = strip(row)
    if (!m || !/diamond card|100 emblem tickets?/i.test(text)) continue
    // A row holding several emblems (nested tables) is split on <img> boundaries below.
    const imgs = [...row.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    if (imgs.length > 1) {
      for (let i = 0; i < imgs.length; i++) {
        const seg = row.slice(imgs[i].index, i + 1 < imgs.length ? imgs[i + 1].index : undefined)
        const t = strip(seg)
        if (/diamond card|100 emblem tickets?/i.test(t)) out.push({ src: new URL(imgs[i][1], base).href, text: t })
      }
    } else out.push({ src: new URL(m[1], base).href, text })
  }
  return out
}

/** Map entries to booster ids. Returns {map: boosterId -> entry, unmatched: entry[], notes: string[]}. */
export function matchEmblems(entries, sets, boosters) {
  const setById = new Map(sets.map((s) => [s.id, s]))
  const order = new Map(sets.map((s) => [s.id, s.order]))
  const setNames = (id) => [setById.get(id)?.nameEn, ...(SET_EN[id] ?? [])].filter(Boolean).map(norm)
  const wb = (hay, needle) => needle && ` ${hay} `.includes(` ${needle} `)
  const sorted = [...boosters].sort((a, b) => (order.get(a.setId) ?? 99) - (order.get(b.setId) ?? 99))
  const map = {}, unmatched = [], notes = []
  for (const e of entries) {
    const t = norm(e.text)
    // Score: pack keyword (multi-booster sets) + set name mention; Unique boosters need the set name.
    const cands = []
    for (const b of sorted) {
      const kw = PACK_KEYWORD[b.id] ? norm(PACK_KEYWORD[b.id]) : null
      const setHit = setNames(b.setId).some((n) => wb(t, n))
      if (kw) { if (wb(t, kw)) cands.push({ b, score: 1 + (setHit ? 2 : 0) }) }
      else if (setHit && /unique$/i.test(b.id)) cands.push({ b, score: 2 })
    }
    if (!cands.length) { unmatched.push(e); continue }
    const best = Math.max(...cands.map((c) => c.score))
    const top = cands.filter((c) => c.score === best)
    // Ambiguous (same pack keyword in several sets, no set name in the text): earliest set without an emblem yet.
    const pick = top.find((c) => !map[c.b.id]) ?? top[0]
    if (top.length > 1) notes.push(`ambiguous "${e.text}" -> ${pick.b.id} (candidates ${top.map((c) => c.b.id).join(', ')})`)
    if (map[pick.b.id]) { notes.push(`duplicate for ${pick.b.id}: "${e.text}" ignored`); continue }
    map[pick.b.id] = e
  }
  return { map, unmatched, notes }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const sets = JSON.parse(await readFile(resolve(root, 'public/data/sets.json'), 'utf8'))
    const boosters = JSON.parse(await readFile(resolve(root, 'public/data/boosters.json'), 'utf8'))
    const html = /^https?:/.test(PAGE) ? await getText(PAGE) : await readFile(resolve(PAGE), 'utf8')
    if (!html) { console.log('emblems: page unavailable, nothing done'); process.exit(0) }
    const entries = parseEmblems(html, /^https?:/.test(PAGE) ? PAGE : 'https://www.serebii.net/tcgpocket/emblems.shtml')
    console.log(`emblems: ${entries.length} candidate entries on the page`)
    const { map, unmatched, notes } = matchEmblems(entries, sets, boosters)
    await mkdir(outDir, { recursive: true })
    let written = 0, skipped = 0
    const failed = []
    for (const [id, e] of Object.entries(map)) {
      const file = join(outDir, emblemFile(id))
      if (!force && (await stat(file).then((s) => s.size > 0, () => false))) { skipped++; continue }
      try {
        const buf = e.src.startsWith('file:') ? await readFile(new URL(e.src)) : await getBuffer(e.src, { retries: 1 })
        if (!buf) { failed.push(`${id} (${e.src})`); continue }
        await writeFile(file, await sharp(buf).resize({ width: 128, height: 128, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer())
        written++
      } catch (err) { failed.push(`${id} (${err.message})`) }
    }
    console.log(`emblems: written ${written}, already present ${skipped}, failed ${failed.length}`)
    console.log('matched:', Object.entries(map).map(([id, e]) => `${id} <- ${e.text}`).join('\n  '))
    for (const n of notes) console.log('note:', n)
    const noEmblem = boosters.filter((b) => !map[b.id]).map((b) => b.id)
    if (noEmblem.length) console.log('boosters without emblem:', noEmblem.join(', '))
    if (unmatched.length) console.log('unmatched entries:\n  ' + unmatched.map((e) => `${e.text} [${e.src}]`).join('\n  '))
    if (failed.length) console.log('failed downloads:', failed.join(', '))
  } catch (e) { console.log('emblems: error (not fatal):', e.message) }
}
