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
      if (kind === 'shops' && !cardIds.length) continue // accessories, items, boosters: nothing to collect
      const type = typeOf(kind, name)
      add({
        id: `pz-${hash(name + '|' + when.start)}`, type, name, nameFr: translateEventName(name, opts.ctx), ...when,
        source: 'pokemon-zone', group: kind === 'emblem' ? 'battles' : kind, ...(cardIds.length ? { cardIds } : {}),
      })
    }
  }
  return [...byId.values()].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
}

/** Merge several parse results (several files); same id: cards unioned, last wins for the rest. */
export function mergeImports(lists: ImportedEvent[][]): ImportedEvent[] {
  const m = new Map<string, ImportedEvent>()
  for (const e of lists.flat()) {
    const p = m.get(e.id)
    m.set(e.id, p ? { ...e, cardIds: [...new Set([...(p.cardIds ?? []), ...(e.cardIds ?? [])])] } : e)
    if (!m.get(e.id)!.cardIds?.length) delete m.get(e.id)!.cardIds
  }
  return [...m.values()].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
}
