#!/usr/bin/env node
// Download set logos from Pokepedia -> public/logos/<setId>.webp (max 400px wide).
// Filename guess: "Logo_<French name, spaces -> _>_JCCP.png"; direct MediaWiki upload URL
// (/images/<md5[0]>/<md5[0:2]>/<file>) first, then the MediaWiki API (allimages "Logo_" index matched
// loosely on accents/case, then imageinfo for the guessed titles). Never fatal: prints a summary.
//
//   node scripts/fetch-logos.mjs [--force] [--sets public/data/sets.json] [--out public/logos]
//   env POKEPEDIA=http://localhost:1234   (tests: mock host serving /images/... and /api.php)
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBuffer, getText, loadSharp, mediaWikiPath, norm } from './lib/common.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d }
const flag = (n) => { const i = args.indexOf(`--${n}`); if (i >= 0) args.splice(i, 1); return i >= 0 }
const force = flag('force')
const setsFile = resolve(root, opt('sets', 'public/data/sets.json'))
const outDir = resolve(root, opt('out', 'public/logos'))
const HOST = (process.env.POKEPEDIA || 'https://www.pokepedia.fr').replace(/\/$/, '')
const sharp = loadSharp()

// Sets without a logo on Pokepedia (skipped quietly).
const SKIP = new Set(['P-A', 'P-B', 'P-C', 'SP1'])
// setId -> exact file name(s) (without "File:") when the generated name does not match.
const OVERRIDES = {
  // A1: ['Logo_Puissance_Génétique_JCCP.png'],
}

const exists = (f) => stat(f).then((s) => s.size > 0, () => false)
const fileName = (name) => `Logo_${name.trim().replace(/\s+/g, '_')}_JCCP.png`
function candidates(set) {
  const out = [...(OVERRIDES[set.id] ?? [])]
  const n = set.name.trim()
  const lowerRest = n.charAt(0) + n.slice(1).toLowerCase()
  for (const v of [n, lowerRest, n.replace(/-/g, ' '), n.replace(/’/g, "'")]) out.push(fileName(v))
  return [...new Set(out)]
}

let allImages = null // normalized-name -> {name,url}, lazily loaded from the API
async function loadIndex() {
  if (allImages) return allImages
  allImages = new Map()
  let cont = null
  for (let page = 0; page < 20; page++) {
    const u = `${HOST}/api.php?action=query&list=allimages&aiprefix=Logo_&ailimit=500&aiprop=url&format=json` + (cont ? `&aicontinue=${encodeURIComponent(cont)}` : '')
    const txt = await getText(u)
    let j; try { j = JSON.parse(txt ?? '') } catch { break }
    for (const im of j?.query?.allimages ?? []) if (/_JCCP\.png$/i.test(im.name)) allImages.set(norm(im.name.replace(/\.png$/i, '')), im)
    cont = j?.continue?.aicontinue
    if (!cont) break
  }
  console.log(`API index: ${allImages.size} JCCP logos`)
  return allImages
}

async function viaImageInfo(names) {
  const titles = names.map((n) => `Fichier:${n}`).join('|')
  const txt = await getText(`${HOST}/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url&format=json`)
  try {
    for (const p of Object.values(JSON.parse(txt ?? '').query?.pages ?? {})) if (p.imageinfo?.[0]?.url) return p.imageinfo[0].url
  } catch { /* ignore */ }
  return null
}

async function findLogo(set) {
  const names = candidates(set)
  for (const n of names) {
    const b = await getBuffer(`${HOST}/images/${mediaWikiPath(n)}`, { retries: 1 })
    if (b) return { buf: b, how: 'md5', file: n }
  }
  const idx = await loadIndex()
  const hit = idx.get(norm(fileName(set.name).replace(/\.png$/i, '')))
  const url = hit?.url ?? (await viaImageInfo(names))
  if (url) {
    const b = await getBuffer(url.startsWith('http') ? url : HOST + url, { retries: 1 })
    if (b) return { buf: b, how: 'api', file: hit?.name ?? url }
  }
  return null
}

const sets = JSON.parse(await readFile(setsFile, 'utf8'))
const stats = { written: 0, skipped: 0, missing: [], errors: [] }
await mkdir(outDir, { recursive: true })
for (const set of sets) {
  if (SKIP.has(set.id)) continue
  const file = join(outDir, `${set.id}.webp`)
  if (!force && (await exists(file))) { stats.skipped++; continue }
  try {
    const r = await findLogo(set)
    if (!r) { stats.missing.push(`${set.id} (${fileName(set.name)})`); continue }
    const out = await sharp(r.buf).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 85, effort: 5 }).toBuffer()
    await writeFile(file, out)
    stats.written++
    console.log(`${set.id}: ${r.how} ${r.file} -> ${(out.length / 1024).toFixed(0)} KB`)
  } catch (e) { stats.errors.push(`${set.id}: ${e.message}`) }
}
console.log(`logos: written ${stats.written}, already present ${stats.skipped}, missing ${stats.missing.length}, errors ${stats.errors.length}`)
if (stats.missing.length) console.log('missing (add to OVERRIDES in scripts/fetch-logos.mjs):', stats.missing.join(', '))
if (stats.errors.length) console.log('errors:', stats.errors.join('; '))
