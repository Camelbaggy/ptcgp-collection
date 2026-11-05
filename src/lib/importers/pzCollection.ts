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
}

/** Raretés de Pokémon-Zone → les nôtres (vérifié sur C1). */
export const PZ_RARITY: Record<string, Rarity> = {
  C: 'D1', U: 'D2', R: 'D3', RR: 'D4', AR: 'E1', SR: 'E2', SAR: 'E2', IM: 'E3', S: 'S1', SSR: 'S2', UR: 'C1',
}

const CARD_START = /<div class="player-expansion-collection-card(?: player-expansion-collection-card--[a-z-]+)?">/g

const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

export function parsePzCollection(html: string): PzCollectionPage {
  const starts: number[] = []
  for (const m of html.matchAll(CARD_START)) starts.push(m.index!)
  const rows: PzCardRow[] = []
  for (let i = 0; i < starts.length; i++) {
    const body = html.slice(starts[i], starts[i + 1] ?? html.length)
    const link = /\/cards\/([a-z0-9-]+)\/(-?\d+)\//i.exec(body)
    if (!link) continue
    const count = /__count">\s*(\d+)\s*</.exec(body)
    const name = /__name-text">([^<]*)</.exec(body)
    const img = /\bc(PK|TR)_\d+_(\d+)_\d+_[^"/]*?_([A-Z]+)\.(?:webp|png|jpe?g)/.exec(body)
    const rar = /rarity-icon--rarity-([A-Z]+)/.exec(body)?.[1] ?? img?.[3]
    rows.push({
      slug: link[1].toLowerCase(),
      number: Number(link[2]),
      count: count ? Number(count[1]) : 0,
      nameEn: name ? decode(name[1]).trim() : '',
      ...(img ? { entityKind: img[1] as 'PK' | 'TR', entityId: Number(img[2]) } : {}),
      ...(rar && PZ_RARITY[rar] ? { rarity: PZ_RARITY[rar] } : {}),
    })
  }
  const saved = /pokemon-zone\.com\/players\/[^/"\s]+\/sets\/([A-Za-z0-9-]+)\//.exec(html)?.[1]
  let setSlug = saved ? saved.toLowerCase() : null
  if (!setSlug && rows.length) {
    const freq = new Map<string, number>()
    for (const r of rows) freq.set(r.slug, (freq.get(r.slug) ?? 0) + 1)
    setSlug = [...freq].sort((a, b) => b[1] - a[1])[0][0]
  }
  return { setSlug, rows }
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

  // 1er passage : numéro identique et même carte ; ces cartes ne sont plus proposées ensuite
  const found: (Card | undefined)[] = page.rows.map((row) => {
    const direct = byId.get(`${setIdFromSlug(row.slug, setIds)}-${row.number}`)
    return direct && sameEntity(direct, row) && (!row.rarity || direct.rarity === row.rarity) ? direct : undefined
  })
  const used = new Set(found.flatMap((c) => (c ? [c.id] : [])))
  // 2e passage : par entité (rééditions rangées sous leur carte d'origine)
  page.rows.forEach((row, i) => {
    if (found[i] || row.entityId === undefined) return
    let cands = (byEntity.get(`${row.entityKind}${row.entityId}`) ?? []).filter((c) => !used.has(c.id))
    if (row.rarity) cands = cands.filter((c) => c.rarity === row.rarity)
    if (cands.length > 1) {
      const local = cands.filter(inSet)
      if (local.length) cands = local
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
