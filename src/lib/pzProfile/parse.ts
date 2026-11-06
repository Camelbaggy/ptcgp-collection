/**
 * Parseurs (regex, sans DOM) des pages du profil Pokémon-Zone enregistrées par l'utilisateur
 * (.html / .mht, ou seulement le `<main>` envoyé par le favori) : accueil, stats, collections
 * thématiques, liste de souhaits. Aucune donnée du compte Nintendo : uniquement ce que la page affiche.
 */
import { PZ_RARITY, decode, decodeMht } from '../importers/pzCollection'
import type {
  PzBar, PzCounter, PzHome, PzItem, PzPageKind, PzRank, PzStats, PzThemed, PzThemedCard,
  PzThemedCollection, PzWishlist,
} from './types'

// ───────────────────────── outils ─────────────────────────

/** Texte brut d'un morceau de HTML (balises retirées, entités décodées, espaces réduits). */
function textOf(html: string): string {
  return decode(html.replace(/<[^>]*>/g, '')).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Nombre affiché par la page : « 1 633 », « 115K », « 1.2M », « 54.7% », « #1 086 ». */
export function parsePzNumber(raw: string): { value: number; approx: boolean } | null {
  const s = raw.replace(/[\s   ]+/g, '').replace(/^#/, '').replace(/%$/, '')
  const m = /^(\d+(?:[.,]\d+)?)([KkMm]?)$/.exec(s.replace(/,(?=\d{3}(?:\D|$))/g, ''))
  if (!m) return null
  const base = Number(m[1].replace(',', '.'))
  if (!Number.isFinite(base)) return null
  const mult = m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1
  return { value: Math.round(base * mult * 1e6) / 1e6, approx: !!m[2] }
}

const num = (raw: string | undefined): number => (raw ? parsePzNumber(raw)?.value ?? 0 : 0)

/** « 06/11/2026 » (JJ/MM/AAAA) → « 2026-11-06 ». */
export function parsePzDate(raw: string): string | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw)
  if (!m) return null
  const d = Number(m[1]), mo = Number(m[2])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Texte de la page : mht décodé, puis `<main>` seul s'il existe (hors feuilles de style et pièces jointes). */
function prepare(raw: string): { all: string; main: string } {
  const all = decodeMht(raw)
  const a = all.search(/<main[\s>]/i)
  const b = all.lastIndexOf('</main>')
  const main = a >= 0 ? all.slice(a, b > a ? b : undefined) : all
  return { all, main }
}

/** Morceaux commençant à chaque occurrence de `start` (jusqu'à la suivante). */
function chunks(html: string, start: RegExp): string[] {
  const idx = [...html.matchAll(new RegExp(start.source, start.flags.includes('g') ? start.flags : start.flags + 'g'))].map((m) => m.index!)
  return idx.map((i, k) => html.slice(i, idx[k + 1] ?? html.length))
}

/** Découpe par titres h1–h3 : [{ title (texte), body (jusqu'au titre suivant) }]. */
function byHeading(html: string): { title: string; body: string }[] {
  const re = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/g
  const hs = [...html.matchAll(re)]
  return hs.map((m, k) => ({ title: textOf(m[1]), body: html.slice(m.index! + m[0].length, hs[k + 1]?.index ?? html.length) }))
}

const findSection = (secs: { title: string; body: string }[], title: string) =>
  secs.find((s) => s.title.toLowerCase() === title.toLowerCase())?.body

const kebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Nom de fichier d'une image sans dossier, extension ni empreinte (`.eb2d7d89`). */
function imageName(url: string): string {
  const file = url.split(/[?#]/)[0].split('/').pop() ?? ''
  return file.replace(/\.(?:webp|png|jpe?g)$/i, '').replace(/\.[0-9a-f]{6,}$/i, '')
}

// ───────────────────────── objets (icônes) ─────────────────────────

/** Objet d'après l'adresse de son icône. */
function itemFromUrl(url: string): { group: string; id: string } | null {
  const icon = /\/ItemIcons\/([^/]+)\/([^/?#]+?)\.(?:webp|png)/i.exec(url)
  if (icon) return { group: icon[1], id: icon[2] }
  if (/\/Card(?:Previews|Renders3D)\//i.test(url)) return { group: 'Card', id: imageName(url) }
  const other = /\/([^/]+)\/([^/?#]+?)\.(?:webp|png)/i.exec(url)
  return other ? { group: other[1], id: imageName(url) } : null
}

/** Tous les `common-item-icon` d'un morceau (icône + quantité). */
function parseItems(html: string): PzItem[] {
  const out: PzItem[] = []
  for (const c of chunks(html, /<span class="common-item-icon(?:\s[^"]*)?"/)) {
    const url = /url\((?:&quot;|["'])?([^)"'&\s]+)/.exec(c.slice(0, 600))?.[1]
    const it = url ? itemFromUrl(url) : null
    if (!it) continue
    const amount = /common-item-icon__amount">([^<]*)</.exec(c)?.[1] ?? ''
    const n = parsePzNumber(amount)
    out.push({ ...it, amount: n?.value ?? 0, ...(n?.approx ? { approx: true } : {}) })
  }
  return out
}

// ───────────────────────── détection ─────────────────────────

/** Adresse de la page d'après les métadonnées d'enregistrement (jamais d'après ses liens). */
function savedUrl(all: string): string | null {
  const head = all.slice(0, 20000)
  const hit = /^Snapshot-Content-Location:\s*(\S+)/im.exec(head)?.[1]
    ?? /saved from url=\(\d+\)(\S+)/i.exec(head)?.[1]
    ?? /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i.exec(head)?.[1]
    ?? /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(head)?.[1]
    ?? /<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)/i.exec(head)?.[1]
  return hit ?? null
}

function kindFromUrl(url: string): PzPageKind | null {
  const m = /\/players\/[^/?#\s]+\/([^?#\s]*)/.exec(url)
  if (!m) return null
  const rest = m[1].replace(/\/+$/, '')
  if (rest === '') return 'home'
  if (rest === 'stats') return 'stats'
  if (rest === 'themed-collections') return 'themed'
  if (rest === 'wishlist') return 'wishlist'
  if (/^sets\/[^/]+$/.test(rest)) return 'set'
  return null
}

/** Quelle page du profil est-ce ? (adresse enregistrée en priorité, sinon repères du contenu). */
export function detectPzPage(raw: string): PzPageKind | null {
  const { all, main } = prepare(raw)
  const url = savedUrl(all)
  const byUrl = url ? kindFromUrl(url) : null
  if (byUrl) return byUrl
  if (main.includes('player-expansion-collection-card')) return 'set'
  if (main.includes('player-themed-collections')) return 'themed'
  if (main.includes('player-wishlist-card-list')) return 'wishlist'
  if (main.includes('player-stats__tile')) return 'stats'
  if (/<h2[^>]*>\s*Card Stats\s*<\/h2>/i.test(main) && /<h2[^>]*>\s*Currencies\s*<\/h2>/i.test(main)) return 'home'
  return null
}

// ───────────────────────── en-tête du joueur ─────────────────────────

function parseHeader(all: string): { name: string; level: number | null; friendId: string | null; syncedAt: string | null } {
  const name = /player-detail-header__name">([^<]*)</.exec(all)
  const lvl = /player-detail-header__level">\s*Lv\.\s*(\d+)/.exec(all) ?? /Lv\.\s*(\d+)/.exec(all)
  const fid = /Friend ID:\s*(?:<\/span>)?\s*(\d{4}-\d{4}-\d{4}-\d{4})/.exec(all)
  const sync = /Last synced:\s*([\d/]+)/.exec(all)
  return {
    name: name ? decode(name[1]).trim() : '',
    level: lvl ? Number(lvl[1]) : null,
    friendId: fid ? fid[1] : null,
    syncedAt: sync ? parsePzDate(sync[1]) : null,
  }
}

// ───────────────────────── accueil ─────────────────────────

export function parsePzHome(raw: string): PzHome {
  const { all, main } = prepare(raw)
  const secs = byHeading(main)
  const rarityProgress = chunks(findSection(secs, 'Card Stats') ?? '', /<div class="grid text-center/).flatMap((c) => {
    const code = /rarity-icon--rarity-([A-Z]+)/.exec(c)?.[1]
    const ratio = /(\d[\d\s]*)\/(\d[\d\s]*)</.exec(c)
    if (!code || !ratio) return []
    return [{ code, ...(PZ_RARITY[code] ? { rarity: PZ_RARITY[code] } : {}), owned: num(ratio[1]), total: num(ratio[2]) }]
  })
  const packPoints = chunks(findSection(secs, 'Pack Points') ?? '', /<div class="expansion-icon/).flatMap((c) => {
    const code = /LOGO_expansion_([A-Za-z0-9-]+?)_/.exec(c)?.[1] ?? /expansion-icon--id-([A-Za-z0-9-]+)/.exec(c)?.[1]
    const price = /product-price-bar__price">([^<]*)</.exec(c)?.[1]
    return code && price !== undefined ? [{ setCode: code, points: num(price) }] : []
  })
  const trophies = chunks(findSection(secs, 'Trophies') ?? '', /<div class="trophy-summary(?:\s[^"]*)?"/).flatMap((c) => {
    const id = /\/Trophy\/([^/"')\s]+?)\.(?:webp|png)/.exec(c)?.[1]
    if (!id) return []
    const label = /trophy-summary__text">([^<]*)</.exec(c)?.[1] ?? ''
    return [{ id, label: decode(label).trim(), locked: /^<div class="[^"]*trophy-summary--is-locked/.test(c) }]
  })
  return {
    ...parseHeader(all),
    rarityProgress,
    currencies: parseItems(findSection(secs, 'Currencies') ?? ''),
    tickets: parseItems(findSection(secs, 'Tickets') ?? ''),
    hourglasses: parseItems(findSection(secs, 'Hourglasses') ?? ''),
    packPoints,
    trophies,
  }
}

// ───────────────────────── stats ─────────────────────────

function parseRank(text: string): PzRank | null {
  const m = /#\s*([\d\s]+?)\s+of\s+([\d\s]+?)\s*·\s*top\s+([\d.,]+)\s*%/i.exec(text)
  return m ? { rank: num(m[1]), of: num(m[2]), topPct: Number(m[3].replace(',', '.')) } : null
}

function parseTiles(html: string): PzCounter[] {
  return chunks(html, /<div class="player-stats__tile(?:\s[^"]*)?"/).flatMap((c) => {
    const rawValue = /tile-value">([\s\S]*?)<\/div>/.exec(c)?.[1]
    const label = /tile-label">([\s\S]*?)<\/div>/.exec(c)?.[1]
    if (rawValue === undefined || label === undefined) return []
    const n = parsePzNumber(textOf(rawValue))
    if (!n) return []
    const lab = textOf(label)
    const sub = /player-stats__rank">([\s\S]*?)<\/div>/.exec(c)?.[1]
    const subText = sub ? textOf(sub) : ''
    const rank = subText ? parseRank(subText) : null
    return [{
      key: kebab(lab), label: lab, value: n.value,
      ...(n.approx ? { approx: true } : {}),
      ...(rank ? { rank } : subText ? { detail: subText } : {}),
    }]
  })
}

function parseBars(html: string): { label: string; labelHtml: string; value: number; secondary: string; row: string }[] {
  return chunks(html, /<div class="player-stats__bar-row/).flatMap((row) => {
    const labelHtml = /player-stats__bar-label">([\s\S]*?)<\/div>\s*<div class="player-stats__bar-value"/.exec(row)?.[1]
    const value = /player-stats__bar-value">\s*([^<]*)</.exec(row)?.[1]
    if (labelHtml === undefined || value === undefined) return []
    const sec = /player-stats__bar-secondary">([^<]*)</.exec(row)?.[1]
    return [{ label: textOf(labelHtml), labelHtml, value: num(value), secondary: sec ? decode(sec).trim() : '', row }]
  })
}

function toBar(b: ReturnType<typeof parseBars>[number]): PzBar {
  const unique = /([\d\s  ]+)\s+unique/.exec(b.secondary)
  const cards = /([\d\s  ]+)\s+cards?\b/.exec(b.secondary)
  return {
    label: b.label, value: b.value,
    ...(b.secondary ? { secondary: b.secondary } : {}),
    ...(unique ? { unique: num(unique[1]) } : {}),
    ...(cards ? { cards: num(cards[1]) } : {}),
  }
}

/** Dernier `<span>` du libellé = nom affiché (après l'icône). */
const lastSpanText = (html: string) => {
  const all = [...html.matchAll(/<span>([^<]*)<\/span>/g)]
  return all.length ? decode(all[all.length - 1][1]).trim() : textOf(html)
}

export function parsePzStats(raw: string): PzStats {
  const { main } = prepare(raw)
  const secs = byHeading(main)
  const asOf = /as of\s+(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(main)
  // tuiles de tête : avant le premier titre h2 (« Battles »)
  const firstH2 = main.search(/<h2\b/)
  const counters = parseTiles(firstH2 >= 0 ? main.slice(0, firstH2) : main)
  const battles = parseTiles(findSection(secs, 'Battles') ?? '')
  const bars = (title: string) => parseBars(findSection(secs, title) ?? '')

  const packsBySet = bars('Packs opened by set').map((b) => {
    const logo = /LOGO_expansion_([A-Za-z0-9-]+?)_/.exec(b.row)?.[1]
    const href = /\/sets\/([A-Za-z0-9-]+)\//.exec(b.row)?.[1]
    const setCode = logo ?? (href ? href.charAt(0).toUpperCase() + href.slice(1) : '')
    const bar = toBar(b)
    return { setCode, name: lastSpanText(b.labelHtml), packs: b.value, cards: bar.cards ?? 0, unique: bar.unique ?? 0 }
  })
  const packsByPack = bars('Packs opened by pack').map((b) => ({
    packIcon: /\/(PACK_ICON_[^/"'.]+)\./.exec(b.row)?.[1] ?? '',
    name: lastSpanText(b.labelHtml),
    packs: b.value,
  }))
  const byRarity = bars('Cards by rarity').map((b) => {
    const code = /rarity-icon--rarity-([A-Z]+)/.exec(b.row)?.[1] ?? ''
    return { ...toBar(b), label: lastSpanText(b.labelHtml), code, ...(PZ_RARITY[code] ? { rarity: PZ_RARITY[code] } : {}) }
  })
  return {
    asOf: asOf ? parsePzDate(asOf[1]) : null,
    counters, battles, packsBySet, packsByPack, byRarity,
    byType: bars('Cards by type').map((b) => ({ ...toBar(b), label: lastSpanText(b.labelHtml) })),
    trainers: bars('Trainers').map(toBar),
    special: bars('Special cards').map(toBar),
  }
}

// ───────────────────────── collections thématiques ─────────────────────────

function parseThemedCards(html: string): PzThemedCard[] {
  return chunks(html, /<figure\b[^>]*player-themed-collections__slot/).flatMap((c) => {
    const image = /<img[^>]*\bsrc="([^"]+)"/.exec(c)?.[1]
    if (!image) return []
    const href = /href="[^"]*?(\/cards\/[a-z0-9-]+\/-?\d+\/)/i.exec(c)?.[1]
    const name = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(c)?.[1] ?? ''
    return [{ ...(href ? { href } : {}), image: imageName(image), name: textOf(name), owned: /slot--owned/.test(c.slice(0, 300)) }]
  })
}

export function parsePzThemed(raw: string): PzThemed {
  const { main } = prepare(raw)
  const secStarts = chunks(main, /<section class="player-themed-collections__expansion"/)
  const firstSection = main.search(/<section class="player-themed-collections__expansion"/)
  const head = firstSection >= 0 ? main.slice(0, firstSection) : main

  const sections: PzThemed['sections'] = []
  const collections: PzThemedCollection[] = []
  for (const sec of secStarts) {
    const setCode = /LOGO_expansion_([A-Za-z0-9-]+?)_/.exec(sec)?.[1] ?? null
    const name = textOf(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(sec)?.[1] ?? '')
    const prog = /([\d\s]+)\/\s*([\d\s]+)\s*completed/i.exec(textOf(/expansion-progress">([\s\S]*?)<\/div>/.exec(sec)?.[1] ?? ''))
    const cols = chunks(sec, /<div class="theme-collection-mission-card[^"]*player-themed-collections__collection--(?:completed|incomplete)"/)
    sections.push({ setCode, name, completed: prog ? num(prog[1]) : 0, total: prog ? num(prog[2]) : 0 })
    for (const c of cols) {
      const completed = /^<div class="[^"]*collection--completed"/.test(c)
      const title = textOf(/__title">([\s\S]*?)<\/div>/.exec(c)?.[1] ?? '')
      const metaAt = c.indexOf('player-themed-collections__meta')
      const rewards = parseItems(metaAt >= 0 ? c.slice(0, metaAt) : c)
      const cards = parseThemedCards(c)
      const miss = /(\d+)\s+cards?\s+missing/i.exec(c)
      const count = /__count">\s*([\d\s]+?)\s*Cards?\s*</i.exec(c)
      collections.push({
        title, setCode, completed,
        missing: completed ? 0 : miss ? Number(miss[1]) : cards.filter((k) => !k.owned).length,
        cardCount: count ? num(count[1]) : null,
        secret: /player-themed-collections__secret/.test(c),
        rewards, cards,
      })
    }
  }

  const stat = /stat-value">\s*(\d[\d\s]*?)\s*<span class="player-themed-collections__of">\s*\/\s*(\d[\d\s]*?)\s*</.exec(head)
  const missing = /stat-value">\s*(\d[\d\s]*?)\s*<\/div>\s*<div class="[^"]*stat-label">\s*Missing cards/i.exec(head)
  const done = collections.filter((c) => c.completed).length
  return {
    completed: stat ? num(stat[1]) : done,
    total: stat ? num(stat[2]) : collections.length,
    missingCards: missing ? num(missing[1]) : collections.reduce((n, c) => n + c.missing, 0),
    sections, collections,
  }
}

// ───────────────────────── souhaits ─────────────────────────

export function parsePzWishlist(raw: string): PzWishlist {
  const { main } = prepare(raw)
  const images = chunks(main, /<div class="player-wishlist-card-list__item/).flatMap((c) => {
    const src = /<img[^>]*\bsrc="([^"]+)"/.exec(c)?.[1]
    return src ? [imageName(src)] : []
  })
  return { images }
}
