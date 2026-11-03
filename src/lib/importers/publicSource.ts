import type { Booster, Card, CardSet } from '../types'
import { mapPublicRarity } from './rarity'
import type { ImportedSet } from './types'

/** One entry of dist/cards.json or dist/cards.extra.json (pokemon-tcg-pocket-database, MIT). */
export interface PublicCard {
  set: string // "A1", "B4b", "PROMO-A", "SP1"
  number: number // can be <= 0 for a few special cards (SP1)
  name: string // English name
  rarity?: string // C U R RR AR SR SAR IM S SSR UR AN
  image?: string
  packs?: string[]
  element?: string | null // grass, fire...
  type?: string | null // pokemon, supporter, item, tool, stadium
  stage?: string | number | null // basic, 1, 2
}
/** One entry of dist/sets.json (values of the per-series object). */
export interface PublicSet {
  code: string
  releaseDate?: string
  count?: number
  name: Record<string, string>
  packs?: string[]
}
export type PublicSetsFile = Record<string, PublicSet[]>

export const PUBLIC_DATA_BASE =
  'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist'
export const TCGDEX_API = 'https://api.tcgdex.net/v2'

/** Public set code -> our set id ("PROMO-A" -> "P-A"). */
export function toSetId(code: string): string {
  const m = /^PROMO-(.+)$/i.exec(code)
  return m ? `P-${m[1].toUpperCase()}` : code
}

/** Our card id: "<setId>-<number>" (A1-1, A4b-12, P-A-5). No zero padding. */
export function cardId(setId: string, number: number): string {
  return `${setId}-${number}`
}

/** Booster id: "<setId>-<name>" with whitespace collapsed to nothing-special (kept readable). */
export function boosterId(setId: string, name: string): string {
  return `${setId}-${name.trim().replace(/\s+/g, ' ')}`
}

export function flattenSets(file: PublicSetsFile): PublicSet[] {
  return Object.values(file).flat()
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const STAGE: Record<string, string> = { basic: 'Basic', '1': 'Stage1', '2': 'Stage2' }

export interface FromPublicOptions {
  /** Display order (default: rank by release date among `allSets`, else 1). */
  order?: number
  allSets?: PublicSet[]
  /** Whole public card list (needed with existingCards to detect reprints). */
  allCards?: PublicCard[]
  /** French card names by number (e.g. from TCGdex), merged into Card.name. */
  frenchNames?: Map<number, string> | Record<number, string>
  /** French booster names by English name. */
  frenchBoosterNames?: Record<string, string>
  /**
   * Cards already in the app. A card of this set that is a reprint (same artwork file as a card of an
   * earlier set, e.g. A4b/B4b deluxe packs) is not created: the existing card gets this set's boosters
   * added, and is returned in `updatedCards`.
   */
  existingCards?: Card[]
  /** Preferred name language for the set (default "fr"). */
  lang?: string
}

/** Convert the public dataset (sets + cards of one set) into our model. Pure. */
export function fromPublicDataset(
  setEntry: PublicSet,
  allCards: PublicCard[],
  opts: FromPublicOptions = {},
): ImportedSet {
  const warnings: string[] = []
  const lang = opts.lang ?? 'fr'
  const setId = toSetId(setEntry.code)
  const rows = allCards.filter((c) => c.set === setEntry.code)
  if (!rows.length) warnings.push(`Aucune carte trouvée pour l'extension ${setEntry.code}.`)

  let order = opts.order
  if (order === undefined) {
    const sorted = [...(opts.allSets ?? [setEntry])].sort(
      (a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '') || a.code.localeCompare(b.code),
    )
    const idx = sorted.findIndex((s) => s.code === setEntry.code)
    order = idx >= 0 ? idx + 1 : 1
  }
  const set: CardSet = {
    id: setId,
    name: setEntry.name[lang] ?? setEntry.name.en ?? setEntry.code,
    nameEn: setEntry.name.en,
    releaseDate: setEntry.releaseDate,
    order,
  }

  // Boosters: those declared by the set, plus any seen on cards.
  const packNames: string[] = [...(setEntry.packs ?? [])]
  for (const c of rows) for (const p of c.packs ?? []) if (!packNames.includes(p)) packNames.push(p)
  const boosters: Booster[] = packNames.map((p) => ({
    id: boosterId(setId, p),
    setId,
    name: opts.frenchBoosterNames?.[p] ?? p,
  }))
  // Promo sets list many "Vol." packs: cards without packs are NOT spread over them.
  const isPromo = setId.startsWith('P-')
  const special = isPromo || /^SP\d/i.test(setId) // promo-like: rarity P, no booster
  const allIds = boosters.map((b) => b.id)

  const fr = opts.frenchNames
  const frName = (n: number) => (fr instanceof Map ? fr.get(n) : fr?.[n])

  // Reprint detection: same artwork file in an earlier set (by release date) that the app already has.
  const existingById = new Map((opts.existingCards ?? []).map((c) => [c.id, c]))
  const firstByImage = new Map<string, { set: string; number: number }>()
  if (opts.existingCards?.length && opts.allCards) {
    const rel = new Map((opts.allSets ?? []).map((x) => [x.code, x.releaseDate ?? '']))
    const sorted = [...opts.allCards].sort(
      (a, b) => (rel.get(a.set) ?? '').localeCompare(rel.get(b.set) ?? '') || a.set.localeCompare(b.set) || a.number - b.number,
    )
    for (const c of sorted) if (c.image && !firstByImage.has(c.image)) firstByImage.set(c.image, c)
  }
  const updated = new Map<string, Card>()

  const used = new Set<number>()
  const cards: Card[] = []
  const ordered = [...rows].sort(
    (a, b) => Number(a.number <= 0) - Number(b.number <= 0) || a.number - b.number,
  )
  for (const c of ordered) {
    const number = c.number
    if (used.has(number)) {
      warnings.push(`Numéro ${number} en double pour « ${c.name} » : ignoré.`)
      continue
    }
    used.add(number)
    const orig = c.image ? firstByImage.get(c.image) : undefined
    if (orig && orig.set !== c.set && !special) {
      const origId = cardId(toSetId(orig.set), orig.number)
      const base = updated.get(origId) ?? existingById.get(origId)
      if (base) {
        const add = c.packs?.length ? c.packs.map((p) => boosterId(setId, p)) : allIds
        updated.set(origId, { ...base, boosterIds: [...new Set([...base.boosterIds, ...add])] })
        continue
      }
    }
    const id = cardId(setId, number)
    const card: Card = {
      id,
      setId,
      number,
      name: frName(c.number) ?? c.name,
      rarity: special ? 'P' : mapPublicRarity(c.rarity),
      boosterIds: special ? [] : c.packs?.length ? c.packs.map((p) => boosterId(setId, p)) : allIds,
      image: `cards/${setId}/${id}.webp`,
    }
    card.nameEn = c.name
    if (c.element) card.type = capitalize(c.element)
    else if (c.type && c.type !== 'pokemon') card.type = capitalize(c.type)
    if (c.stage !== undefined && c.stage !== null) card.stage = STAGE[String(c.stage)] ?? String(c.stage)
    if (isPromo && c.rarity) card.finish = c.rarity
    cards.push(card)
  }
  cards.sort((a, b) => a.number - b.number)
  if (updated.size) warnings.push(`${updated.size} réimpression(s) rattachée(s) à des cartes existantes.`)
  return { set, boosters, cards, warnings, updatedCards: [...updated.values()] }
}

/** Parse a TCGdex `GET /v2/fr/sets/<id>` response into French names by card number. */
export function frenchNamesFromTcgdex(resp: unknown): Map<number, string> {
  const out = new Map<number, string>()
  const cards = (resp as { cards?: { localId?: string; name?: string }[] })?.cards ?? []
  for (const c of cards) {
    const n = Number.parseInt(c.localId ?? '', 10)
    if (Number.isFinite(n) && c.name) out.set(n, c.name)
  }
  return out
}

/** Our set id -> TCGdex set id (same, but promos are "P-A"). */
export const toTcgdexSetId = (setId: string) => setId

export interface FetchOptions {
  fetchImpl?: typeof fetch
  baseUrl?: string
  /** Try to get French card names from TCGdex (default true; failure is only a warning). */
  french?: boolean
  /** Cards already in the app, to merge reprints (A4b, B4b...) into existing ids. */
  existingCards?: Card[]
  signal?: AbortSignal
}

async function getJson<T>(url: string, o: FetchOptions): Promise<T> {
  const f = o.fetchImpl ?? fetch
  const res = await f(url, { signal: o.signal })
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`)
  return (await res.json()) as T
}

/** List sets known to the public source (for a picker in "Nouvelle extension"). */
export async function fetchPublicSetList(o: FetchOptions = {}): Promise<PublicSet[]> {
  const file = await getJson<PublicSetsFile>(`${o.baseUrl ?? PUBLIC_DATA_BASE}/sets.json`, o)
  return flattenSets(file)
}

/**
 * Fetch one set (e.g. "B4b", "P-A" or "PROMO-A") from the public source (online).
 * Source: pokemon-tcg-pocket-database (MIT) on raw.githubusercontent.com (CORS-enabled),
 * French names optionally from api.tcgdex.net.
 */
export async function fetchSetFromDataset(setCode: string, o: FetchOptions = {}): Promise<ImportedSet> {
  const base = o.baseUrl ?? PUBLIC_DATA_BASE
  const code = /^P-(.+)$/i.test(setCode) ? `PROMO-${setCode.slice(2).toUpperCase()}` : setCode
  const [sets, cards] = await Promise.all([
    fetchPublicSetList(o),
    getJson<PublicCard[]>(`${base}/cards.extra.json`, o),
  ])
  const entry = sets.find((s) => s.code.toLowerCase() === code.toLowerCase())
  if (!entry) throw new Error(`Extension « ${setCode} » inconnue de la source publique.`)
  let frenchNames: Map<number, string> | undefined
  let warn: string | undefined
  if (o.french !== false) {
    try {
      frenchNames = frenchNamesFromTcgdex(
        await getJson(`${TCGDEX_API}/fr/sets/${encodeURIComponent(toSetId(entry.code))}`, o),
      )
    } catch {
      warn = 'Noms français indisponibles (TCGdex injoignable) : noms anglais utilisés.'
    }
  }
  const res = fromPublicDataset(entry, cards.filter((c) => c.set === entry.code || o.existingCards?.length), { allSets: sets, allCards: cards, frenchNames, existingCards: o.existingCards })
  if (warn) res.warnings.push(warn)
  return res
}

export interface PublicSourceInfo {
  id: string
  label: string
  description: string
  /** Example set ids accepted by this source. */
  example: string
}

/** Public sources usable by the "Nouvelle extension" screen. */
export function listPublicSources(): PublicSourceInfo[] {
  return [
    {
      id: 'pokemon-tcg-pocket-database',
      label: 'Base communautaire PTCGP (MIT) + TCGdex pour les noms FR',
      description: 'Cartes, raretés et boosters de toutes les extensions (A1…, B…, C1, P-A…).',
      example: 'B4b',
    },
  ]
}

/**
 * Entry point for the UI: fetch a set (e.g. "B4b", "P-A") from the public source. Needs network.
 * Also accepts the legacy form fetchPublicSet(sourceId, setId, options).
 */
export async function fetchPublicSet(setId: string, o?: FetchOptions): Promise<ImportedSet>
export async function fetchPublicSet(sourceId: string, setId: string, o?: FetchOptions): Promise<ImportedSet>
export async function fetchPublicSet(a: string, b?: string | FetchOptions, c?: FetchOptions): Promise<ImportedSet> {
  const [code, o] = typeof b === 'string' ? [b, c ?? {}] : [a, b ?? {}]
  if (typeof b === 'string' && a !== 'pokemon-tcg-pocket-database') throw new Error(`Source inconnue : ${a}`)
  if (!code.trim()) throw new Error("Renseignez l'identifiant de l'extension (ex. B4b).")
  return fetchSetFromDataset(code.trim(), o)
}
