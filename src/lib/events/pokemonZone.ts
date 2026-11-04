// Pure parser for Pokémon-Zone schedule pages saved by the user (Ctrl+S on /schedule/ and /schedule/upcoming/).
// String/regex based on purpose (no DOM needed: runs in vitest "node" and in the browser, no dependency).
// Only the structure of the listing is used: group headings `<h3 id="<Month>_<Year>_<Group>">` followed by event blocks
// (`shops_*`, `missions_*`, `picks_*`, `event_*`, `poke_gold_offer_*`, `mission-group`), each with a name and a
// `banner-date__dates` span carrying data-start / data-end.
import { decodeEntities, type EventType, type GameEvent } from './parse'
import { translateEventName } from './translate'

export type EventSource = 'serebii' | 'pokemon-zone'

/** Event imported from a Pokémon-Zone page. `nameFr` is a best-effort translation (the UI recomputes it with card/set names). */
export interface ImportedEvent extends GameEvent {
  source: 'pokemon-zone'
  nameFr: string
  /** Pokémon-Zone section: shops, missions, picks, battles, emblem, expansion, gold. */
  group: string
  updatedAt?: string
  by?: string
  /** Details (all optional: rows imported before they existed still render). */
  missions?: EventMission[]
  shopItems?: ShopItem[]
  offers?: GoldOffer[]
  battle?: BattleInfo
}

/** Reward / item: `item` is the icon file name (`POKEGOLD`, `EMBLEM_100600_PIKACHU`...), see `itemLabelFr`. */
export interface EventReward { item: string; amount: number; bonus?: boolean; chance?: string }
export interface EventMission { text: string; target?: number; reward?: EventReward }
export interface ShopItem { name: string; price?: number; currency?: string; kind?: string; cardId?: string }
export interface GoldOffer { name: string; price?: string; items: EventReward[]; start: string; end: string }
export interface BattleInfo {
  difficulty?: string
  rules?: string
  /** Total wins needed -> reward. */
  milestones?: { wins: number; reward: EventReward }[]
  perBattle?: EventReward[]
  firstTime?: EventReward[]
}

export interface PzOptions {
  /** Known card ids (`A1-12`): unknown ones are dropped. Without it, all mapped ids are kept. */
  cardIds?: Set<string>
  /** Known set ids, used to name upcoming expansions and map slugs. */
  setIds?: string[]
  /** Context for the French translation. */
  ctx?: Parameters<typeof translateEventName>[1]
}

/** FNV-1a 32 bits, base 36. */
export function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}

/** Pokémon-Zone set slug -> our set id (`a3b` -> `A3b`, `promo-b` -> `P-B`). */
export function setIdFromSlug(slug: string, known?: string[]): string {
  const s = slug.toLowerCase()
  const hit = known?.find((k) => k.toLowerCase() === s)
  if (hit) return hit
  const p = /^promo-([a-z])$/.exec(s)
  if (p) return 'P-' + p[1].toUpperCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const text = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
const toIso = (s: string): string | null => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(s.trim())
  if (!m) return null
  const tz = m[3] ? (m[3] === 'Z' ? 'Z' : m[3].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')) : 'Z'
  const t = Date.parse(`${m[1]}T${m[2]}${tz}`)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

function dates(chunk: string): { start: string; end: string } | null {
  const m = /banner-date__dates[^>]*?data-start="([^"]+)"(?:[^>]*?data-end="([^"]+)")?/.exec(chunk)
  const start = m && toIso(m[1])
  if (!start) return null
  return { start, end: (m[2] && toIso(m[2])) || start }
}

function cardsIn(chunk: string, o: PzOptions): string[] {
  const out = new Set<string>()
  for (const m of chunk.matchAll(/pokemon-zone\.com\/cards\/([a-z0-9-]+)\/(\d{1,4})\//gi)) {
    const id = `${setIdFromSlug(m[1], o.setIds)}-${Number(m[2])}`
    if (!o.cardIds || o.cardIds.has(id)) out.add(id)
  }
  return [...out]
}

/** File name (no extension / hash) of the first icon of a chunk: `.../Currency/POKEGOLD.webp?x` -> `POKEGOLD`. */
function iconKey(chunk: string): string | undefined {
  const m = /image-url:\s*url\(\s*['"]?([^)'"]+)/.exec(chunk)
  if (!m) return undefined
  const f = m[1].split('?')[0].split('/').pop()!.replace(/\.webp$/i, '').replace(/\.[0-9a-f]{8}$/, '')
  return f || undefined
}
const amountIn = (chunk: string): number => {
  const m = /common-item-icon__amount">\s*([\d,]+)/.exec(chunk) ?? /item-amount">\s*([\d,]+)/.exec(chunk)
  return m ? Number(m[1].replace(/,/g, '')) : 1
}

function rewardsOf(chunk: string): EventReward[] {
  const out: EventReward[] = []
  for (const part of chunk.split(/<div class="icon-list__item/).slice(1)) {
    const item = iconKey(part)
    if (!item) continue
    const chance = /common-item-icon__amount">\s*[\d,]+\s*<\/span>(?:\s*<\/span>)*\s*<span[^>]*>\s*([\d.]+%)/.exec(part)
    out.push({ item, amount: amountIn(part), ...(chance ? { chance: chance[1] } : {}) })
  }
  return out
}

function missionsOf(chunk: string): EventMission[] {
  const out: EventMission[] = []
  for (const part of chunk.split('<div class="mission-list-card ').slice(1)) {
    const t = /mission-list-card__text">([\s\S]*?)<\/div>/.exec(part)
    const txt = t ? text(t[1]) : ''
    if (!txt) continue
    const target = /progress-bar__text">\s*\d+\s*\/\s*(\d+)/.exec(part)
    const item = iconKey(part)
    out.push({ text: txt, ...(target ? { target: Number(target[1]) } : {}), ...(item ? { reward: { item, amount: amountIn(part) } } : {}) })
  }
  return out
}

function shopItemsOf(chunk: string, o: PzOptions): ShopItem[] {
  const out: ShopItem[] = []
  for (const part of chunk.split('<div class="shop-group-card__item">').slice(1)) {
    const n = /shop-group-card__content-name">([\s\S]*?)<\/div>/.exec(part)
    const name = n ? text(n[1]) : ''
    if (!name) continue
    const price = /product-price-bar__price">\s*([\d,]+)/.exec(part)
    const cur = /product-price-bar--icon-url:\s*url\(\s*['"]?([^)'"]+)/.exec(part)
    const kind = /content--type-([a-z_]+)/.exec(part)
    const card = cardsIn(part, o)[0]
    out.push({
      name, ...(price ? { price: Number(price[1].replace(/,/g, '')) } : {}),
      ...(cur?.[1] ? { currency: cur[1].split('?')[0].split('/').pop()!.replace(/\.webp$/i, '') } : {}),
      ...(kind ? { kind: kind[1] } : {}), ...(card ? { cardId: card } : {}),
    })
  }
  return out
}

function goldOffer(chunk: string, name: string, when: { start: string; end: string }): GoldOffer {
  const price = /gold-shop-product-card__price">[\s\S]*?product-price-bar__price">\s*([^<]*?)\s*</.exec(chunk)
  const items: EventReward[] = []
  for (const part of chunk.split('<div class="gold-shop-product-card__item">').slice(1)) {
    const item = iconKey(part)
    if (!item) continue
    items.push({ item, amount: amountIn(part), ...(/item-bonus/.test(part) ? { bonus: true } : {}) })
  }
  return { name, ...(price?.[1] ? { price: price[1] } : {}), items, ...when }
}

function battleOf(kind: string, chunk: string): BattleInfo | undefined {
  if (kind === 'event') {
    const diff = /solo-battle-group-card__difficulty[^>]*>([\s\S]*?)<\/span>/.exec(chunk)
    const first = /First Time Rewards<\/div>\s*<div class="icon-list">([\s\S]*?)<div class="solo-battle-group-card__battle-content"/.exec(chunk)
    const firstTime = first ? rewardsOf(first[1]) : []
    const b: BattleInfo = { ...(diff ? { difficulty: text(diff[1]) } : {}), ...(firstTime.length ? { firstTime } : {}) }
    return Object.keys(b).length ? b : undefined
  }
  if (kind !== 'emblem') return undefined
  const milestones: NonNullable<BattleInfo['milestones']> = []
  const rw = /<div class="mission-group__rewards">([\s\S]*?)<div class="mission-group__date"/.exec(chunk)
  for (const part of (rw?.[1] ?? '').split('<div class="mission-group__reward">').slice(1)) {
    const n = /mission-group__reward-count">\s*(\d+)/.exec(part)
    const item = iconKey(part)
    if (n && item) milestones.push({ wins: Number(n[1]), reward: { item, amount: amountIn(part) } })
  }
  const pb = /pvp-emblem-event__per-battle">([\s\S]*?)(?=<div class="rule-ban-list|$)/.exec(chunk)
  const perBattle = pb ? rewardsOf(pb[1]) : []
  const rules = /rule-ban-list__summary">([\s\S]*?)<\/(?:div|p|span)>/.exec(chunk)
  const b: BattleInfo = {
    ...(milestones.length ? { milestones } : {}), ...(perBattle.length ? { perBattle } : {}), ...(rules ? { rules: text(rules[1]) } : {}),
  }
  return Object.keys(b).length ? b : undefined
}

const NAME_RES: Record<string, RegExp> = {
  shops: /<h3 class="mb-1">([\s\S]*?)<\/h3>/,
  missions: /<div class="fs-3 font-bold">([\s\S]*?)<\/div>/,
  picks: /<div class="fs-3 font-bold">([\s\S]*?)<\/div>/,
  event: /solo-battle-group-card__heading-title">([\s\S]*?)<\/div>/,
  emblem: /mission-group__name[^>]*>([\s\S]*?)<\/h3>/,
  gold: /gold-shop-product-card__name">([\s\S]*?)<\/div>/,
}

/** "X Shop - Reissue Drop Event" -> "X Shop" when the suffix only repeats the title. */
function cleanName(raw: string): string {
  const n = text(raw)
  const m = /^(.+?) - (.+)$/.exec(n)
  if (m && m[1].toLowerCase().includes(m[2].toLowerCase())) return m[1]
  return n
}

function typeOf(kind: string, name: string): EventType {
  if (kind === 'gold') return 'shop'
  if (kind === 'picks') return 'wonderpick'
  if (kind === 'emblem' && /Emblem/i.test(name)) return 'emblem'
  if (/missions?$/i.test(name)) return 'special'
  if (/Wonder Pick/i.test(name)) return 'wonderpick'
  if (/Drop Event/i.test(name)) return 'drop'
  if (/Mass Outbreak/i.test(name)) return 'massoutbreak'
  if (/Emblem Event/i.test(name)) return 'emblem'
  return 'special'
}

const MARKER = /<div id="(shops|missions|picks|event|poke_gold_offer)_[^"]*"|<div class="mission-group[ "]/g
const GROUP_H3 = /<h3 id="[A-Za-z]+_\d{4}_[^"]+">/g
const FAR = Date.parse('2100-01-01T00:00:00Z')

function clean(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/\s+/g, ' ')
}

function upcomingExpansions(h: string, o: PzOptions): ImportedEvent[] {
  const out: ImportedEvent[] = []
  for (const m of h.matchAll(/<a href="https?:\/\/www\.pokemon-zone\.com\/sets\/([a-z0-9-]+)\/"[^>]*>\s*<div class="expansion-pack-set-card\b([\s\S]*?)<\/a>/gi)) {
    const d = /Releases[\s\S]*?data-start="([^"]+)"/.exec(m[2])
    const start = d && toIso(d[1])
    if (!start) continue
    const setId = setIdFromSlug(m[1], o.setIds)
    const known = !o.setIds || o.setIds.includes(setId)
    const title = /expansion-pack-set-card__title">\s*([\s\S]*?)\s*<span class="tag/.exec(m[2])
    const label = (title ? text(title[1]) : setId).replace(/\s*Preview$/i, '') || setId
    out.push({
      id: `pz-expansion-${hash(setId + start)}`, type: 'expansion', name: known ? label : setId, nameFr: known ? label : setId,
      start, end: start, source: 'pokemon-zone', group: 'expansion', ...(known && o.setIds ? { setId } : {}),
    })
  }
  return out
}

/** Parses one saved Pokémon-Zone schedule page. Events with the same name+start are merged (cards unioned). */
export function parsePokemonZoneSchedule(html: string, opts: PzOptions = {}): ImportedEvent[] {
  const h = clean(html)
  const byId = new Map<string, ImportedEvent>()
  const add = (e: ImportedEvent) => {
    const prev = byId.get(e.id)
    if (!prev) { byId.set(e.id, e); return }
    prev.cardIds = [...new Set([...(prev.cardIds ?? []), ...(e.cardIds ?? [])])]
    if (!prev.cardIds.length) delete prev.cardIds
    if (e.end > prev.end) prev.end = e.end
  }
  for (const e of upcomingExpansions(h, opts)) add(e)

  const heads = [...h.matchAll(GROUP_H3)].map((m) => m.index!)
  const tailCut = (() => { const i = h.search(/<div class="article-content-menu|<footer/); return i < 0 ? h.length : i })()
  for (let g = 0; g < heads.length; g++) {
    const sec = h.slice(heads[g], g + 1 < heads.length ? heads[g + 1] : Math.max(heads[g], tailCut))
    const marks = [...sec.matchAll(MARKER)]
    for (let i = 0; i < marks.length; i++) {
      const chunk = sec.slice(marks[i].index!, i + 1 < marks.length ? marks[i + 1].index! : sec.length)
      const kind = marks[i][1] === 'poke_gold_offer' ? 'gold' : marks[i][1] ?? 'emblem'
      const nm = NAME_RES[kind].exec(chunk)
      const when = dates(chunk)
      if (!nm || !when) continue
      const name = cleanName(nm[1])
      if (!name || /^daily missions$/i.test(name)) continue
      if (Date.parse(when.end) >= FAR) continue // permanent offers
      const cardIds = kind === 'event' || kind === 'gold' ? [] : cardsIn(chunk, opts)
      const type = typeOf(kind, name)
      const missions = kind === 'missions' ? missionsOf(chunk) : []
      const shopItems = kind === 'shops' ? shopItemsOf(chunk, opts) : []
      const offers = kind === 'gold' ? [goldOffer(chunk, name, when)] : []
      const battle = battleOf(kind, chunk)
      add({
        id: `pz-${hash(name + '|' + when.start)}`, type, name, nameFr: translateEventName(name, opts.ctx), ...when,
        source: 'pokemon-zone', group: kind === 'emblem' ? 'battles' : kind, ...(cardIds.length ? { cardIds } : {}),
        ...(missions.length ? { missions } : {}), ...(shopItems.length ? { shopItems } : {}), ...(offers.length ? { offers } : {}),
        ...(battle ? { battle } : {}),
      })
    }
  }
  // Card-less shops (items, accessories) are only worth keeping when they merged into a bigger event.
  return mergeRelated([...byId.values()]).filter((e) => !(e.group === 'shops' && !e.cardIds?.length && !e.missions?.length))
}

const uniq = <T,>(list: T[], key: (x: T) => string): T[] => {
  const seen = new Set<string>()
  return list.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true })
}
const rk = (r?: EventReward) => (r ? `${r.item}x${r.amount}` : '')

/** Base name of an event: shop / missions / daily missions suffixes stripped, for matching the parts of one event. */
export function baseName(name: string): string {
  return name
    .replace(/\s+\(missions\)$/i, '')
    .replace(/\s+(?:Daily )?Missions$/i, '')
    .replace(/\s+Shop(?: - (?:Cards|Items|Accessories))?$/i, '')
    .replace(/\bSeries\s+/i, '')
    .replace(/\s+/g, ' ').trim().toLowerCase()
}

const RANK: Record<string, number> = { picks: 0, event: 0, battles: 1, missions: 2, shops: 3 }

function combine(parts: ImportedEvent[], over: Partial<ImportedEvent> = {}): ImportedEvent {
  const sorted = [...parts].sort((a, b) => (RANK[a.group] ?? 4) - (RANK[b.group] ?? 4) || a.start.localeCompare(b.start))
  const p = sorted[0]
  const pick = <K extends keyof ImportedEvent>(k: K) => sorted.map((e) => e[k]).find((v) => v != null)
  const cardIds = [...new Set(sorted.flatMap((e) => e.cardIds ?? []))]
  const bonus = [...new Set(sorted.flatMap((e) => e.bonusCardIds ?? []))]
  const missions = uniq(sorted.flatMap((e) => e.missions ?? []), (m) => `${m.text}|${rk(m.reward)}|${m.target ?? ''}`)
  const shopItems = uniq(sorted.flatMap((e) => e.shopItems ?? []), (i) => `${i.name}|${i.price ?? ''}|${i.currency ?? ''}|${i.cardId ?? ''}`)
  const offers = uniq(sorted.flatMap((e) => e.offers ?? []), (o) => `${o.name}|${o.start}|${o.end}`)
  const typed = sorted.find((e) => e.type !== 'special')
  const out: ImportedEvent = {
    ...p, type: p.type === 'special' && typed ? typed.type : p.type,
    start: parts.map((e) => e.start).reduce((a, b) => (a < b ? a : b)),
    end: parts.map((e) => e.end).reduce((a, b) => (a > b ? a : b)),
    ...(pick('image') ? { image: pick('image') } : {}), ...(pick('url') ? { url: pick('url') } : {}),
    ...(pick('battle') ? { battle: pick('battle') } : {}),
    ...over,
  }
  for (const [k, v] of [['cardIds', cardIds], ['bonusCardIds', bonus], ['missions', missions], ['shopItems', shopItems], ['offers', offers]] as const)
    if (v.length) (out as unknown as Record<string, unknown>)[k] = v; else delete (out as unknown as Record<string, unknown>)[k]
  return out
}

/** Clusters of events (sorted by start) whose date ranges overlap (touching ends do not count). */
function clusters(list: ImportedEvent[]): ImportedEvent[][] {
  const out: ImportedEvent[][] = []
  let end = ''
  for (const e of [...list].sort((a, b) => a.start.localeCompare(b.start))) {
    const last = out[out.length - 1]
    if (last && (e.start < end || (e.start === e.end && e.start <= end))) { last.push(e); if (e.end > end) end = e.end } else { out.push([e]); end = e.end }
  }
  return out
}

/**
 * Merges the parts of one event: "<X> Shop", "<X>" and "<X> Missions" with overlapping dates become one event (cards, missions,
 * shop items united, dates = union); all Poké Gold offers of an overlapping period become one "Poké Gold Offers" event.
 * Idempotent, works on rows saved before details existed.
 */
export function mergeRelated(events: ImportedEvent[]): ImportedEvent[] {
  const out: ImportedEvent[] = []
  const byBase = new Map<string, ImportedEvent[]>()
  const gold: ImportedEvent[] = []
  for (const e of events) {
    if (e.type === 'expansion') { out.push(e); continue }
    if (e.group === 'gold') {
      gold.push(e.offers?.length ? e : { ...e, offers: [{ name: e.name, items: [], start: e.start, end: e.end }] })
      continue
    }
    const k = baseName(e.name)
    byBase.set(k, [...(byBase.get(k) ?? []), e])
  }
  for (const list of byBase.values()) for (const c of clusters(list)) out.push(c.length === 1 ? c[0] : combine(c))
  for (const c of clusters(gold)) {
    const start = c.map((e) => e.start).reduce((a, b) => (a < b ? a : b))
    out.push(combine(c, { id: `pz-gold-${hash(start)}`, name: 'Poké Gold Offers', nameFr: 'Offres Poké Lingots', type: 'shop', group: 'gold' }))
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
}

/** Merge several parse results (several files); same id: cards unioned, last wins for the rest; then related parts are merged. */
export function mergeImports(lists: ImportedEvent[][]): ImportedEvent[] {
  const m = new Map<string, ImportedEvent>()
  for (const e of lists.flat()) {
    const p = m.get(e.id)
    m.set(e.id, p ? combine([e, p], { id: e.id, name: e.name, group: e.group, type: e.type }) : e)
  }
  return mergeRelated([...m.values()])
}
