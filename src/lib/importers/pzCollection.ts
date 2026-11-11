import type { Booster, Card, Rarity } from '../types'
import { setIdFromSlug } from '../events/pokemonZone'

/**
 * Import de la page « collection d'une extension » de Pokémon-Zone
 * (pokemon-zone.com/players/<id>/sets/<SET>/), enregistrée par l'utilisateur (Ctrl+S).
 * Chaque carte y est un bloc `player-expansion-collection-card` avec le lien
 * `/cards/<slug>/<n>/…`, l'image `cPK_10_<entité>_<variante>_<NOM>_<rareté>` et le nombre
 * d'exemplaires dans `__count` (absent pour une carte non obtenue).
 */
export interface PzCardRow {
  slug: string
  number: number
  count: number
  nameEn: string
  entityKind?: 'PK' | 'TR'
  entityId?: number
  rarity?: Rarity
}

export interface PzCollectionPage {
  /** Extension de la page (`C1`), d'après l'adresse enregistrée ou les liens des cartes. */
  setSlug: string | null
  rows: PzCardRow[]
  /** Bouton « Load More » encore présent : la page n'affiche qu'une partie des cartes. */
  hasMore: boolean
  /** Identifiant du joueur sur Pokémon-Zone (adresse de la page), pour y revenir depuis l'appli. */
  playerId?: string
}

const PLAYER_ID = /^[A-Za-z0-9_-]{1,40}$/

/** Identifiant du joueur dans une adresse de profil Pokémon-Zone (`…/players/<id>/…`). */
export function pzPlayerFromUrl(url: string): string | null {
  const m = /pokemon-zone\.com\/players\/([^/?#\s]+)/i.exec(url)
  return m && PLAYER_ID.test(m[1]) ? m[1] : null
}

/** Code d'une extension sur Pokémon-Zone (`P-A` → `PROMO-A`). */
export const pzSetCode = (setId: string): string => (/^P-([A-Z])$/.test(setId) ? `PROMO-${setId.slice(2)}` : setId)

/** Page d'une extension sur le profil Pokémon-Zone (`P-A` → `PROMO-A`). */
export function pzSetUrl(playerId: string, setId: string): string {
  const code = pzSetCode(setId)
  return `https://www.pokemon-zone.com/players/${encodeURIComponent(playerId)}/sets/${encodeURIComponent(code)}/`
}

/** Raretés de Pokémon-Zone → les nôtres (vérifié sur C1). */
export const PZ_RARITY: Record<string, Rarity> = {
  C: 'D1', U: 'D2', R: 'D3', RR: 'D4', AR: 'E1', SR: 'E2', SAR: 'E2', IM: 'E3', S: 'S1', SSR: 'S2', UR: 'C1',
}

const CARD_START = /<div class="player-expansion-collection-card(?: player-expansion-collection-card--[a-z-]+)?">/g

export const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** Pages .mht/.mhtml enregistrées en « quoted-printable » (certains navigateurs). */
export function decodeMht(text: string): string {
  if (!/Content-Transfer-Encoding:\s*quoted-printable/i.test(text.slice(0, 4000))) return text
  const bytes = text.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
  // les « =C3=A9 » sont des octets UTF-8 : on les relit comme tels quand tout tient sur un octet
  if (/[\u0080-\u00ff]/.test(bytes) && [...bytes].every((c) => c.charCodeAt(0) < 256)) {
    try { return new TextDecoder('utf-8').decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0))) } catch { /* garde la lecture octet par octet */ }
  }
  return bytes
}

/** Une carte de la page, à partir de son lien, son nombre d'exemplaires, son nom, son image et sa rareté. */
function rowFromParts(href: string, count: number, name: string, img: string, rarityCode?: string): PzCardRow | null {
  const link = /\/cards\/([a-z0-9-]+)\/(-?\d+)\//i.exec(href)
  if (!link) return null
  const ent = /\bc(PK|TR)_\d+_(\d+)_\d+_[^"/]*?_([A-Z]+)(?:\.[0-9a-f]{6,})?\.(?:webp|png|jpe?g)/.exec(img)
  const rar = rarityCode || ent?.[3]
  return {
    slug: link[1].toLowerCase(),
    number: Number(link[2]),
    count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
    nameEn: name.trim(),
    ...(ent ? { entityKind: ent[1] as 'PK' | 'TR', entityId: Number(ent[2]) } : {}),
    ...(rar && PZ_RARITY[rar] ? { rarity: PZ_RARITY[rar] } : {}),
  }
}

function slugFromRows(rows: PzCardRow[]): string | null {
  if (!rows.length) return null
  const freq = new Map<string, number>()
  for (const r of rows) freq.set(r.slug, (freq.get(r.slug) ?? 0) + 1)
  return [...freq].sort((a, b) => b[1] - a[1])[0][0]
}

export function parsePzCollection(raw: string): PzCollectionPage {
  const html = decodeMht(raw)
  const starts: number[] = []
  for (const m of html.matchAll(CARD_START)) starts.push(m.index!)
  const rows: PzCardRow[] = []
  for (let i = 0; i < starts.length; i++) {
    const body = html.slice(starts[i], starts[i + 1] ?? html.length)
    const href = /\/cards\/[a-z0-9-]+\/-?\d+\//i.exec(body)?.[0]
    if (!href) continue
    const count = /__count">\s*(\d+)\s*</.exec(body)
    const name = /__name-text">([^<]*)</.exec(body)
    const img = /\bc(?:PK|TR)_\d+_\d+_\d+_[^"/]*?\.(?:webp|png|jpe?g)/.exec(body)?.[0] ?? ''
    const row = rowFromParts(href, count ? Number(count[1]) : 0, name ? decode(name[1]) : '', img, /rarity-icon--rarity-([A-Z]+)/.exec(body)?.[1])
    if (row) rows.push(row)
  }
  const saved = /pokemon-zone\.com\/players\/[^/"\s]+\/sets\/([A-Za-z0-9-]+)\//.exec(html)?.[1]
  const setSlug = saved ? saved.toLowerCase() : slugFromRows(rows)
  // le bouton reste dans la page une fois tout chargé, mais masqué (« d-none »)
  const hasMore = [...html.matchAll(/class="([^"]*data-infinite-scroller__more[^"]*)"/g)].some((m) => !/\bd-none\b/.test(m[1]))
  const playerId = pzPlayerFromUrl(/pokemon-zone\.com\/players\/[^/"\s]+\/sets\//.exec(html)?.[0] ?? '')
  return { setSlug, rows, hasMore, ...(playerId ? { playerId } : {}) }
}

/**
 * Données envoyées par le favori « Envoyer vers Holothèque » (voir `pzBookmarklet`) :
 * v1 `{ v: 1, player, set, more, rows }` (une extension) ou v2 `{ v: 2, player, pages: [{ set, more, rows }] }`,
 * chaque carte étant `[lien, exemplaires, nom, image, rareté]`. Une page par extension.
 */
export function parsePzPayload(json: string): PzCollectionPage[] | null {
  try {
    const d = JSON.parse(json) as { v?: number; player?: string; set?: string; more?: boolean; rows?: unknown[]; pages?: unknown[] }
    const playerId = typeof d?.player === 'string' && PLAYER_ID.test(d.player) ? d.player : undefined
    const one = (p: { set?: unknown; more?: unknown; rows?: unknown }): PzCollectionPage | null => {
      if (!Array.isArray(p?.rows)) return null
      const rows = p.rows.flatMap((r) => {
        if (!Array.isArray(r)) return []
        const [href, count, name, img, rar] = r as [string, number, string, string, string]
        const row = rowFromParts(String(href ?? ''), Number(count), String(name ?? ''), String(img ?? ''), rar ? String(rar) : undefined)
        return row ? [row] : []
      })
      const set = typeof p.set === 'string' && /^[a-z0-9-]+$/i.test(p.set) ? p.set.toLowerCase() : slugFromRows(rows)
      return { setSlug: set, rows, hasMore: !!p.more, ...(playerId ? { playerId } : {}) }
    }
    if (d?.v === 1) { const p = one(d); return p ? [p] : null }
    if ((d?.v === 2 || d?.v === 3) && Array.isArray(d.pages)) return d.pages.flatMap((p) => { const x = one(p as object); return x ? [x] : [] })
    return null
  } catch { return null }
}

export type PzHtmlKind = 'home' | 'stats' | 'themed' | 'wishlist'

/** Pages du profil jointes par le favori (v3) : contenu `<main>` de chacune. */
export function pzPayloadHtml(json: string): Partial<Record<PzHtmlKind, string>> {
  try {
    const d = JSON.parse(json) as { v?: number; html?: Record<string, unknown> }
    if (d?.v !== 3 || !d.html || typeof d.html !== 'object') return {}
    const out: Partial<Record<PzHtmlKind, string>> = {}
    for (const k of ['home', 'stats', 'themed', 'wishlist'] as const) if (typeof d.html[k] === 'string') out[k] = d.html[k] as string
    return out
  } catch { return {} }
}

/** Taille maximale du JSON décompressé (le plus gros envoi réel fait quelques Mo). */
export const PZ_MAX_INFLATED = 32 * 1024 * 1024

/** Données compressées du favori (`pzz=` : deflate-raw puis base64url) → texte JSON. */
export async function inflatePzPayload(b64url: string): Promise<string> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  // Plafond : on interrompt la décompression au-delà de PZ_MAX_INFLATED octets (lien piégé / « bombe »).
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > PZ_MAX_INFLATED) { await reader.cancel(); throw new Error('Données du favori trop volumineuses.') }
    chunks.push(value)
  }
  const all = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { all.set(c, off); off += c.length }
  return new TextDecoder().decode(all)
}

export interface PzMatch { row: PzCardRow; card: Card }
export interface PzResolved {
  setId: string | null
  matches: PzMatch[]
  /** Cartes de la page qu'on n'a pas su relier à une de nos cartes. */
  unknown: PzCardRow[]
}

/**
 * Relie chaque carte de la page à une des nôtres : d'abord par son numéro (`C1-5`) si l'entité
 * correspond, sinon par l'entité du jeu (nom de fichier de l'image) et la rareté, en préférant
 * les cartes vendues dans les boosters de l'extension (rééditions des packs Deluxe).
 */
export function resolvePzCollection(page: PzCollectionPage, cards: Card[], boosters: Booster[], setIds: string[]): PzResolved {
  const setId = page.setSlug ? setIdFromSlug(page.setSlug, setIds) : null
  const byId = new Map(cards.map((c) => [c.id, c]))
  const byEntity = new Map<string, Card[]>()
  for (const c of cards) {
    if (c.entityId === undefined || !c.entityKind) continue
    const k = `${c.entityKind}${c.entityId}`
    const l = byEntity.get(k)
    if (l) l.push(c); else byEntity.set(k, [c])
  }
  const setBoosters = new Set(boosters.filter((b) => b.setId === setId).map((b) => b.id))
  const inSet = (c: Card) => c.setId === setId || c.boosterIds.some((b) => setBoosters.has(b))
  const sameEntity = (c: Card, r: PzCardRow) => r.entityId === undefined || c.entityId === undefined || (c.entityId === r.entityId && c.entityKind === r.entityKind)

  // 1er passage : numéro identique et même entité ; ces cartes ne sont plus proposées ensuite
  const found: (Card | undefined)[] = page.rows.map((row) => {
    const direct = byId.get(`${setIdFromSlug(row.slug, setIds)}-${row.number}`)
    if (!direct || !sameEntity(direct, row)) return undefined
    return row.entityId !== undefined || !row.rarity || direct.rarity === row.rarity ? direct : undefined
  })
  const used = new Set(found.flatMap((c) => (c ? [c.id] : [])))
  // 2e passage : par entité. Les rééditions d'un pack Deluxe sont rangées sous leur carte
  // d'origine (autre extension, vendue dans les boosters de celle-ci) ; leur rareté peut
  // différer de l'originale, elle ne sert qu'à départager.
  page.rows.forEach((row, i) => {
    if (found[i] || row.entityId === undefined) return
    let cands = (byEntity.get(`${row.entityKind}${row.entityId}`) ?? [])
      .filter((c) => !used.has(c.id) && !(c.setId === setId && c.setId === setIdFromSlug(row.slug, setIds)))
    const local = cands.filter(inSet)
    if (local.length) cands = local
    if (cands.length > 1 && row.rarity) {
      const same = cands.filter((c) => c.rarity === row.rarity)
      if (same.length) cands = same
    }
    if (cands.length > 1) {
      const notPromo = cands.filter((c) => c.rarity !== 'P')
      if (notPromo.length) cands = notPromo
    }
    if (cands.length === 1) { found[i] = cands[0]; used.add(cands[0].id) }
  })
  const matches: PzMatch[] = []
  const unknown: PzCardRow[] = []
  page.rows.forEach((row, i) => {
    const card = found[i]
    if (card) matches.push({ row, card }); else unknown.push(row)
  })
  return { setId, matches, unknown }
}
