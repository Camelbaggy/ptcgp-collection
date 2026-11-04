#!/usr/bin/env node
// Item icons from Serebii, bundled so the event sheets work offline (Pokemon-Zone's CDN blocks automated downloads):
//   https://www.serebii.net/tcgpocket/items.shtml    -> public/items/<key>.png            (advanceticket, packhourglass...)
//   https://www.serebii.net/tcgpocket/emblems.shtml  -> public/items/emblems/<slug>.png  (every emblem, by its name)
// and the manifest public/data/item-icons.json { items: {key: "items/<key>.png"}, emblems: [{name, path}] } listing the
// files actually present (matching is done in src/lib/events/itemIcons.ts). Never fatal; throttled; cached files are kept.
//
//   node scripts/fetch-item-icons.mjs [--force] [--size 96] [--items-page <url>] [--emblems-page <url>] [--out public]
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBuffer, getText, loadSharp, sleep } from './lib/common.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const unent = (s) => s.replace(/&amp;/g, '&').replace(/&eacute;/g, 'e').replace(/&#0?39;|&apos;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').trim()

/** Item list page: `<img src="items/<key>.png">` -> [{key, src}] (relative URLs resolved against pageUrl). */
export function parseItems(html, pageUrl) {
  const out = new Map()
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']*?\/?items\/([a-z0-9_-]+)\.png)["']/gi)) {
    if (!out.has(m[2])) out.set(m[2], new URL(m[1], pageUrl).href)
  }
  return [...out].map(([key, src]) => ({ key, src }))
}

/** Emblem list page: `<img src="/tcgpocket/emblems/x.png" alt="Name Emblem">` -> [{name, slug, src}] in page order. */
export function parseEmblemList(html, pageUrl) {
  const out = new Map()
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]
    const src = /src=["']([^"']*\/emblems\/([^"'/]+?)\.png)["']/i.exec(tag)
    const alt = /alt=["']([^"']*)["']/i.exec(tag)
    if (!src || !alt) continue
    const name = unent(alt[1])
    const slug = src[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (name && slug && !out.has(slug)) out.set(slug, { name, slug, src: new URL(src[1], pageUrl).href })
  }
  return [...out.values()]
}

async function main() {
  const args = process.argv.slice(2)
  const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : d }
  const flag = (n) => { const i = args.indexOf(`--${n}`); if (i >= 0) args.splice(i, 1); return i >= 0 }
  const force = flag('force')
  const size = Number(opt('size', '96'))
  const ITEMS = opt('items-page', 'https://www.serebii.net/tcgpocket/items.shtml')
  const EMBLEMS = opt('emblems-page', 'https://www.serebii.net/tcgpocket/emblems.shtml')
  const out = resolve(root, opt('out', 'public'))
  const sharp = loadSharp()
  const present = (f) => stat(f).then((s) => s.size > 0, () => false)
  const read = async (p) => (/^https?:/.test(p) ? getText(p) : readFile(p, 'utf8').catch(() => null))
  const page = (p) => (/^https?:/.test(p) ? p : 'https://www.serebii.net/tcgpocket/x.shtml')

  async function grab(src, file) {
    if (!force && (await present(file))) return 'cached'
    await sleep(150) // throttle
    const buf = await getBuffer(src, { retries: 1 })
    if (!buf) return 'failed'
    try {
      await writeFile(file, await sharp(buf).resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer())
      return 'written'
    } catch { return 'failed' }
  }

  await mkdir(join(out, 'items/emblems'), { recursive: true })
  await mkdir(join(out, 'data'), { recursive: true })
  const count = { written: 0, cached: 0, failed: 0 }
  const manifest = { items: {}, emblems: [] }

  const itemsHtml = await read(ITEMS)
  if (!itemsHtml) console.log('item-icons: items page unreachable (not fatal)')
  for (const { key, src } of itemsHtml ? parseItems(itemsHtml, page(ITEMS)) : []) {
    count[await grab(src, join(out, 'items', `${key}.png`))]++
  }
  const emblemsHtml = await read(EMBLEMS)
  if (!emblemsHtml) console.log('item-icons: emblems page unreachable (not fatal)')
  for (const e of emblemsHtml ? parseEmblemList(emblemsHtml, page(EMBLEMS)) : []) {
    count[await grab(e.src, join(out, 'items/emblems', `${e.slug}.png`))]++
  }

  // Manifest = what is on disk (so a cached run, or a partial failure, stays consistent).
  const listed = emblemsHtml ? parseEmblemList(emblemsHtml, page(EMBLEMS)) : []
  const prev = await readFile(join(out, 'data/item-icons.json'), 'utf8').then(JSON.parse, () => null)
  const emblemCandidates = listed.length ? listed.map((e) => ({ name: e.name, slug: e.slug })) : (prev?.emblems ?? []).map((e) => ({ name: e.name, slug: e.path.replace(/^.*\/|\.png$/g, '') }))
  for (const e of emblemCandidates) if (await present(join(out, 'items/emblems', `${e.slug}.png`))) manifest.emblems.push({ name: e.name, path: `items/emblems/${e.slug}.png` })
  const itemKeys = itemsHtml ? parseItems(itemsHtml, page(ITEMS)).map((i) => i.key) : Object.keys(prev?.items ?? {})
  for (const k of itemKeys) if (await present(join(out, 'items', `${k}.png`))) manifest.items[k] = `items/${k}.png`
  await writeFile(join(out, 'data/item-icons.json'), JSON.stringify(manifest))
  console.log(`item-icons: written ${count.written}, cached ${count.cached}, failed ${count.failed}; manifest: ${Object.keys(manifest.items).length} items, ${manifest.emblems.length} emblems`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => console.log('item-icons: error (not fatal):', e.message))
}
