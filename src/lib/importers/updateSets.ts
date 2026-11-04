import type { Booster, Card, CardSet, PackSlotRates, Rarity } from '../types'
import { fromPublicDataset, toSetId, type PublicCard, type PublicSet } from './publicSource'
import { PUBLIC_RARITY_MAP } from './rarity'

/**
 * Pure diff/merge used by scripts/update-sets.mjs: brings the shipped reference data
 * (public/data/{sets,boosters,cards,rates}.json) up to date with the community dataset
 * (flibustier/pokemon-tcg-pocket-database). No I/O here.
 */

export interface RefData {
  sets: CardSet[]
  boosters: Booster[]
  cards: Card[]
  rates: PackSlotRates[]
  slugs: Record<string, string>
}

/** dist/pullRates.json of the community dataset: set code -> pack name -> slots. */
export type PublicPullRates = Record<string, Record<string, {
  appearance_rate: number
  cards?: number
  slots: Record<string, Record<string, number>>
}>>

/** French data fetched from TCGdex for one set (all optional: the host may be unreachable). */
export interface FrenchSetInfo { name?: string; cards?: Map<number, string> | Record<number, string> }

export interface PublicInput {
  sets: PublicSet[]
  cards: PublicCard[]
  pullRates?: PublicPullRates
  /** keyed by our set id */
  french?: Record<string, FrenchSetInfo | undefined>
}

export interface NewSetReport {
  id: string
  name: string
  cards: number
  boosters: number
  reprints: number
  rates: 'public' | 'placeholder' | 'none'
}
export interface UpdateReport {
  newSets: NewSetReport[]
  /** New cards added to sets that already existed, by set id. */
  newCards: Record<string, number>
  /** Existing cards that gained booster links (reprints). */
  relinkedCards: number
  /** Existing cards whose English name was replaced by a French one. */
  translatedCards: number
  /** Cards (new) still carrying an English name. */
  untranslatedCards: number
  warnings: string[]
}
export interface UpdateResult { data: RefData; report: UpdateReport; changed: boolean }

// ---------- helpers ----------

/** Pokekalos slug: lowercase, no accents, anything non-alphanumeric -> "-" ("L'Île Fabuleuse" -> "l-ile-fabuleuse"). */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[œŒ]/g, 'oe')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const norm = (s: string) => slugify(s).replace(/-/g, ' ')

const ELEMENT_FR: Record<string, string> = {
  grass: 'Plante', fire: 'Feu', water: 'Eau', lightning: 'Électrique', psychic: 'Psy', fighting: 'Combat',
  darkness: 'Obscurité', metal: 'Métal', dragon: 'Dragon', colorless: 'Incolore',
}
const TYPE_FR: Record<string, string> = { supporter: 'Supporter', item: 'Objet', tool: 'Outil', stadium: 'Stade', fossil: 'Objet' }
const STAGE_FR: Record<string, string> = { Basic: 'Base', Stage1: 'Niveau 1', Stage2: 'Niveau 2' }

/** The importer yields English type/stage; shipped data uses French labels and no explicit image path. */
function localize(c: Card): Card {
  const out: Card = { ...c, image: '' }
  if (out.type) out.type = ELEMENT_FR[out.type.toLowerCase()] ?? TYPE_FR[out.type.toLowerCase()] ?? out.type
  if (out.stage) out.stage = STAGE_FR[out.stage] ?? out.stage
  delete out.finish
  return out
}

const RARITY_ORDER: Rarity[] = ['D1', 'D2', 'D3', 'D4', 'E1', 'E2', 'E3', 'S1', 'S2', 'C1', 'P']
const PACK_TYPE: Record<string, string> = {
  'regular pack': 'normal', 'rare pack': 'rare', 'regular pack +1': 'plus1', 'themed rare pack': 'rare-s2',
}

/**
 * Convert the public pull rates of one set into PackSlotRates for the given boosters (same rates for all of
 * them: the source is per set). Null when a rarity code is unknown (finish variants of deluxe packs).
 */
export function ratesFromPublic(set: PublicPullRates[string] | undefined, boosterIds: string[]): PackSlotRates[] | null {
  if (!set || !boosterIds.length) return null
  const packs: Omit<PackSlotRates, 'boosterId'>[] = []
  for (const [name, p] of Object.entries(set)) {
    const slots = Object.entries(p.slots)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, rates], i) => {
        const acc: Partial<Record<Rarity, number>> = {}
        for (const [code, v] of Object.entries(rates)) {
          const r = PUBLIC_RARITY_MAP[code.toUpperCase()]
          if (!r || r === 'P') return null
          acc[r] = Math.round(((acc[r] ?? 0) + v) * 1e6) / 1e6
        }
        const sorted = Object.fromEntries(RARITY_ORDER.filter((r) => acc[r] !== undefined).map((r) => [r, acc[r]!]))
        return { slot: i + 1, rates: sorted as Partial<Record<Rarity, number>> }
      })
    if (slots.some((s) => s === null)) return null
    packs.push({
      packType: PACK_TYPE[name.toLowerCase()] ?? (slugify(name) || 'normal'),
      packTypeRate: p.appearance_rate,
      slots: slots as { slot: number; rates: Partial<Record<Rarity, number>> }[],
    })
  }
  if (!packs.length) return null
  return boosterIds.flatMap((boosterId) => packs.map((p) => ({ boosterId, ...structuredClone(p) })))
}

const strip = <T extends object>(x: T): T => {
  const { updatedAt: _u, by: _b, deleted: _d, ...rest } = x as T & { updatedAt?: string; by?: string; deleted?: boolean }
  return rest as T
}

/**
 * Placeholder rates for new boosters: structure of the most recent comparable set (same series letter first,
 * no per-finish/pool rules such as deluxe packs), copied from its first booster.
 */
export function placeholderRates(
  newBoosterIds: string[], ref: Pick<RefData, 'sets' | 'boosters' | 'rates'>, newSetId: string,
): PackSlotRates[] {
  const bySet = new Map<string, PackSlotRates[]>()
  const setOf = new Map(ref.boosters.map((b) => [b.id, b.setId]))
  for (const r of ref.rates) {
    const s = setOf.get(r.boosterId)
    if (s) bySet.set(s, [...(bySet.get(s) ?? []), r])
  }
  const plain = (rows: PackSlotRates[]) =>
    rows.some((r) => r.packType === 'normal') &&
    !rows.some((r) => r.slots.some((s) => s.byFinish || s.poolCardIds || s.excludeCardIds))
  const cands = ref.sets
    .filter((s) => s.id !== newSetId && !/^(P-|SP)/.test(s.id) && plain(bySet.get(s.id) ?? []))
    .sort((a, b) => b.order - a.order)
  const letter = newSetId.charAt(0)
  const pick = cands.find((s) => s.id.charAt(0) === letter) ?? cands[0]
  if (!pick) return []
  const rows = bySet.get(pick.id)!
  const first = rows[0]!.boosterId
  const src = rows.filter((r) => r.boosterId === first)
  return newBoosterIds.flatMap((boosterId) => src.map((r) => ({ ...structuredClone(strip(r)), boosterId })))
}

function frName(f: FrenchSetInfo | undefined, n: number): string | undefined {
  const m = f?.cards
  return m instanceof Map ? m.get(n) : m?.[n]
}

/** Set ids for which French data from TCGdex is worth fetching: new sets, and sets mostly untranslated. */
export function setsNeedingFrench(ref: RefData, pub: Pick<PublicInput, 'sets' | 'cards'>): string[] {
  const known = new Set(ref.sets.map((s) => s.id))
  const out: string[] = []
  for (const e of pub.sets) {
    const id = toSetId(e.code)
    if (!pub.cards.some((c) => c.set === e.code)) continue
    if (!known.has(id)) { out.push(id); continue }
    const cs = ref.cards.filter((c) => c.setId === id)
    if (cs.length >= 2 && cs.filter((c) => c.nameEn && c.name === c.nameEn).length / cs.length > 0.6) out.push(id)
  }
  return out
}

/** Pack names of a multi-pack set: drop the set's English name prefix ("Dual Fusion Pikachu" -> "Pikachu"). */
function packLabel(pack: string, setEn: string | undefined): string {
  if (setEn && pack.toLowerCase().startsWith(setEn.toLowerCase() + ' ')) return pack.slice(setEn.length + 1).trim()
  return pack.trim()
}

/** For an existing set: public pack name -> existing booster id, learned from cards that exist on both sides. */
function learnPackMap(
  entry: PublicSet, pubRows: PublicCard[], setCards: Card[], setBoosters: Booster[], genId: (p: string) => string,
): Map<string, string> {
  const votes = new Map<string, Map<string, number>>()
  const byNumber = new Map(setCards.map((c) => [c.number, c]))
  for (const p of pubRows) {
    const mine = byNumber.get(p.number)
    if (!mine || p.packs?.length !== 1 || mine.boosterIds.length !== 1) continue
    const v = votes.get(p.packs[0]!) ?? new Map<string, number>()
    v.set(mine.boosterIds[0]!, (v.get(mine.boosterIds[0]!) ?? 0) + 1)
    votes.set(p.packs[0]!, v)
  }
  const out = new Map<string, string>()
  const packs = new Set<string>([...(entry.packs ?? []), ...pubRows.flatMap((r) => r.packs ?? [])])
  for (const pack of packs) {
    const v = votes.get(pack)
    const best = v && [...v.entries()].sort((a, b) => b[1] - a[1])[0]
    let target = best?.[0]
    if (!target) {
      const np = norm(packLabel(pack, entry.name.en))
      target = setBoosters.find((b) => {
        const nb = norm(b.name)
        const ni = norm(b.id.slice(b.id.indexOf('-') + 1))
        return np === nb || np === ni || (ni.length > 2 && np.includes(ni)) || (nb.length > 2 && np.includes(nb))
      })?.id
    }
    if (!target && setBoosters.length === 1) target = setBoosters[0]!.id
    if (target) out.set(genId(pack), target)
  }
  return out
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

/** Diff the community dataset against the shipped data and return the updated data + a report. Pure. */
export function mergePublicData(ref: RefData, pub: PublicInput): UpdateResult {
  const report: UpdateReport = {
    newSets: [], newCards: {}, relinkedCards: 0, translatedCards: 0, untranslatedCards: 0, warnings: [],
  }
  const sets = ref.sets.map((s) => ({ ...s }))
  const boosters = ref.boosters.map((b) => ({ ...b }))
  const cards = new Map(ref.cards.map((c) => [c.id, { ...c }]))
  const rates = ref.rates.map((r) => ({ ...r }))
  const slugs = { ...ref.slugs }
  let changed = false

  const ordered = [...pub.sets].sort(
    (a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '') || a.code.localeCompare(b.code),
  )
  for (const entry of ordered) {
    const setId = toSetId(entry.code)
    const rows = pub.cards.filter((c) => c.set === entry.code)
    const existing = sets.find((s) => s.id === setId)
    if (!rows.length) {
      if (!existing) report.warnings.push(`Extension ${entry.code} annoncée sans carte : ignorée pour l'instant.`)
      continue
    }
    const fr = pub.french?.[setId]
    const special = /^(P-|SP\d)/i.test(setId)
    const nextOrder = Math.max(0, ...sets.map((s) => s.order)) + 1
    const setName = existing?.name ?? fr?.name ?? entry.name.fr ?? entry.name.en ?? entry.code
    const imp = fromPublicDataset(entry, pub.cards, {
      allSets: pub.sets, allCards: pub.cards, frenchNames: fr?.cards as Map<number, string> | undefined,
      existingCards: [...cards.values()], order: existing?.order ?? nextOrder,
    })

    // pack (generated booster id) -> final booster id
    const genId = (p: string) => imp.boosters.find((b) => b.name === p)?.id ?? `${setId}-${p}`
    let idMap: Map<string, string>
    let newBoosters: Booster[] = []
    if (existing) {
      const own = boosters.filter((b) => b.setId === setId)
      idMap = learnPackMap(entry, rows, [...cards.values()].filter((c) => c.setId === setId), own, genId)
      const unmapped = imp.boosters.filter((b) => !idMap.has(b.id) && !own.some((o) => o.id === b.id))
      if (unmapped.length && !special)
        report.warnings.push(`${setId} : pack(s) non reconnu(s) (${unmapped.map((b) => b.name).join(', ')}) : à vérifier à la main.`)
      for (const b of own) idMap.set(b.id, b.id)
    } else {
      idMap = new Map()
      const gen = special ? [] : imp.boosters
      const single = gen.length <= 1
      newBoosters = (single && !special ? [{ id: `${setId}-Unique`, setId, name: setName }] : gen.map((b) => {
        const label = packLabel(b.name, entry.name.en)
        return { id: `${setId}-${label}`, setId, name: label }
      }))
      if (!single) report.warnings.push(`${setId} : noms de boosters laissés en anglais (${newBoosters.map((b) => b.name).join(', ')}).`)
      gen.forEach((b, i) => idMap.set(b.id, (single ? newBoosters[0]! : newBoosters[i]!).id))
    }
    const finalIds = new Set([...boosters, ...newBoosters].filter((b) => b.setId === setId).map((b) => b.id))
    const remap = (c: Card, base?: Card): Card => {
      let ids = [...new Set(c.boosterIds.map((i) => idMap.get(i) ?? (finalIds.has(i) ? i : '')).filter(Boolean))]
      if (!ids.length && !special && !base) ids = [...finalIds]
      return { ...c, boosterIds: ids }
    }

    // New cards
    const fresh = imp.cards.filter((c) => !cards.has(c.id)).map((c) => localize(remap(c)))
    for (const c of fresh) {
      cards.set(c.id, c)
      if (c.nameEn && c.name === c.nameEn) report.untranslatedCards++
    }
    // Reprints: existing cards gaining boosters (never removing any)
    let relinked = 0
    for (const u of imp.updatedCards ?? []) {
      const cur = cards.get(u.id)
      if (!cur) continue
      const ids = [...new Set([...cur.boosterIds, ...remap(u, cur).boosterIds])]
      if (!sameSet(ids, cur.boosterIds)) { cards.set(u.id, { ...cur, boosterIds: ids }); relinked++ }
    }
    report.relinkedCards += relinked
    // Late French names for existing cards
    if (existing && fr?.cards) {
      for (const c of [...cards.values()]) {
        if (c.setId !== setId || !c.nameEn || c.name !== c.nameEn) continue
        const n = frName(fr, c.number)
        if (n && n !== c.name) { cards.set(c.id, { ...c, name: n }); report.translatedCards++ }
      }
    }

    if (existing) {
      if (fresh.length) report.newCards[setId] = fresh.length
      if (fresh.length || relinked) changed = true
      continue
    }

    // New set
    changed = true
    const set: CardSet = {
      id: setId, name: setName, nameEn: entry.name.en, order: nextOrder,
      ...(entry.releaseDate ? { releaseDate: entry.releaseDate } : {}),
    }
    if (!fr?.name && !entry.name.fr && !special) report.warnings.push(`${setId} : nom français de l'extension introuvable, nom anglais utilisé.`)
    sets.push(set)
    slugs[setId] ??= slugify(setName)
    let ratesFrom: NewSetReport['rates'] = 'none'
    const ids = newBoosters.map((b) => b.id)
    let newRates = ratesFromPublic(pub.pullRates?.[entry.code], ids)
    if (newRates) ratesFrom = 'public'
    else if (ids.length) {
      newRates = placeholderRates(ids, { sets, boosters, rates }, setId)
      if (newRates.length) ratesFrom = 'placeholder'
    }
    rates.push(...(newRates ?? []))
    const estimated = ratesFrom !== 'public'
    for (const b of newBoosters) boosters.push(estimated ? { ...b, ratesEstimated: true } : b)
    report.newSets.push({
      id: setId, name: setName, cards: fresh.length, boosters: newBoosters.length, reprints: relinked, rates: ratesFrom,
    })
  }

  if (report.untranslatedCards)
    report.warnings.push(`${report.untranslatedCards} carte(s) neuve(s) sans nom français (nom anglais conservé ; sera traduit dès que TCGdex le publie).`)
  const finalCards = [...cards.values()] // Map keeps insertion order: existing cards first, new ones appended
  if (report.translatedCards) changed = true
  return { data: { sets, boosters, cards: finalCards, rates, slugs }, report, changed }
}
