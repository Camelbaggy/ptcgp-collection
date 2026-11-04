// Pure parsers for the Serebii event pages (no I/O, no deps): used by scripts/fetch-events.mjs and unit-tested
// against real pages saved in scripts/fixtures/serebii/.
//
// ASSUMPTION (time): Serebii only gives dates ("October 15th - October 28th 2026"). PTCGP switches day at
// 06:00 UTC, so an event starts on its start date at 06:00 UTC and ends on its end date at 06:00 UTC.
// Adjust RESET_HOUR_UTC if this proves wrong; the app only consumes ISO instants.

export type EventType = 'special' | 'drop' | 'wonderpick' | 'emblem' | 'massoutbreak' | 'expansion'

export interface GameEvent {
  id: string
  type: EventType
  name: string
  /** ISO instants (UTC). */
  start: string
  end: string
  /** Path relative to public/ (e.g. "events/<id>.webp"), set only when the image was downloaded. */
  image?: string
  /** Serebii page of the event. */
  url?: string
  /** Featured cards (drop / wonderpick), our card ids, best effort. */
  cardIds?: string[]
  /** Wonder Pick bonus-pick options (subset of cardIds). */
  bonusCardIds?: string[]
  /** Short English summary of what the event gives (promo packs, shop cost). */
  rewards?: string[]
  setId?: string
}

/** Raw row of a Serebii event list. */
export interface RawEvent { slug: string; name: string; start: string; end: string; imageSrc?: string; url: string }

export interface Release { setId?: string; name: string; date: string }

export const SEREBII = 'https://www.serebii.net'
export const RESET_HOUR_UTC = 6

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ecirc: 'ê', ocirc: 'ô', ccedil: 'ç', rsquo: '’', lsquo: '‘' }
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m)
}

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
const month = (name: string) => MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3)))
const iso = (y: number, m: number, d: number, plusDays = 0) => new Date(Date.UTC(y, m, d + plusDays, RESET_HOUR_UTC)).toISOString()

/**
 * "October 15th - October 28th 2026", "October 30th 2026 - November 13th 2025" (typo on the site), "March 7h 2026".
 * Start year defaults to the end year (previous year if that would put the start after the end);
 * an end before the start is bumped by a year.
 */
export function parseDuration(text: string): { start: string; end: string } | null {
  const m = /([A-Za-z]{3,9})\s+(\d{1,2})\w*(?:\s+(\d{4}))?\s*-\s*([A-Za-z]{3,9})\s+(\d{1,2})\w*\s+(\d{4})/.exec(text)
  if (!m) return null
  const [sm, sd, em, ed] = [month(m[1]), Number(m[2]), month(m[4]), Number(m[5])]
  if (sm < 0 || em < 0) return null
  let ey = Number(m[6])
  let sy = m[3] ? Number(m[3]) : ey
  const key = (y: number, mo: number, d: number) => y * 10000 + mo * 100 + d
  if (!m[3] && key(sy, sm, sd) > key(ey, em, ed)) sy -= 1
  if (key(ey, em, ed) < key(sy, sm, sd)) ey = sy + (em < sm ? 1 : 0)
  return { start: iso(sy, sm, sd), end: iso(ey, em, ed) }
}

const slugOf = (href: string) => (href.split('/').pop() ?? '').replace(/\.shtml$/, '')
const absolute = (p: string) => (/^https?:/.test(p) ? p : p.startsWith('/') ? SEREBII + p : `${SEREBII}/tcgpocket/${p}`)

/** Parses a Serebii event table (events / dropevents / wonderpickevents / emblemevents / massoutbreakevents). */
export function parseEventList(html: string): RawEvent[] {
  const out: RawEvent[] = []
  for (const row of html.match(/<tr>\s*<td class="cen"[\s\S]*?<\/tr>/g) ?? []) {
    const href = /<a href="([^"]+)"/.exec(row)?.[1]
    const img = /<img[^>]*\ssrc="([^"]+)"/.exec(row)?.[1]
    const name = /<u>([\s\S]*?)<\/u>/.exec(row)?.[1]
    const dur = /<td class="fooinfo">(?:(?!<td)[\s\S])*?<\/td>\s*<\/tr>$/.exec(row)?.[0]
    const range = dur ? parseDuration(stripTags(dur)) : null
    if (!href || !name || !range) continue
    const slug = slugOf(href)
    out.push({ slug, name: stripTags(name), ...range, imageSrc: img ? absolute(img) : undefined, url: absolute(href.startsWith('events/') ? href : `events/${slug}.shtml`) })
  }
  return out
}

/** Next expansions announced on the home page: a link to /tcgpocket/<set>/ followed by a future date. Conservative; [] if none. */
export function parseHomeReleases(html: string, today: Date): Release[] {
  const out: Release[] = []
  const re = /<a href="\/tcgpocket\/[^"/]+\/">([^<]{3,60})<\/a>[^<]{0,40}?(?:coming|release[sd]?|available|on)\W+([A-Za-z]{3,9})\s+(\d{1,2})\w*\s+(\d{4})/gi
  for (const m of html.matchAll(re)) {
    const mo = month(m[2])
    if (mo < 0) continue
    const date = `${m[4]}-${String(mo + 1).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`
    if (Date.parse(date + 'T00:00:00Z') >= today.getTime() - 86400000) out.push({ name: decodeEntities(m[1].trim()), date })
  }
  return out
}

export interface Pages { events: string; drop: string; wonderpick: string; emblem: string; massoutbreak: string }

const TYPED: [Exclude<keyof Pages, 'events'>, EventType][] = [['drop', 'drop'], ['wonderpick', 'wonderpick'], ['emblem', 'emblem'], ['massoutbreak', 'massoutbreak']]

/** Fallback when an event is only in the global list: the slug usually says what it is ("...dropevent", "...emblemevent"). */
function typeFromSlug(slug: string): EventType {
  if (/dropevent/.test(slug)) return 'drop'
  if (/wonderpick/.test(slug)) return 'wonderpick'
  if (/emblemevent/.test(slug)) return 'emblem'
  if (/massoutbreak/.test(slug)) return 'massoutbreak'
  return 'special'
}

/**
 * Merges the five lists. The type of an event is the page whose list contains it (by page slug);
 * events only present in the global list are "special" (missions, campaigns...).
 * Events ending before `cutoff` are dropped. Ids are stable: `<type>-<serebii slug>`.
 */
export function buildEvents(pages: Partial<Pages>, cutoff: Date): (GameEvent & { imageSrc?: string; slug: string })[] {
  const byType = new Map<string, EventType>()
  const rows = new Map<string, RawEvent>()
  for (const [key, type] of TYPED) {
    for (const r of parseEventList(pages[key] ?? '')) { byType.set(r.slug, type); rows.set(r.slug, r) }
  }
  for (const r of parseEventList(pages.events ?? '')) if (!rows.has(r.slug)) rows.set(r.slug, r)
  const out: (GameEvent & { imageSrc?: string; slug: string })[] = []
  for (const r of rows.values()) {
    if (Date.parse(r.end) < cutoff.getTime()) continue
    const type = byType.get(r.slug) ?? typeFromSlug(r.slug)
    out.push({ id: `${type}-${r.slug}`.replace(/[^A-Za-z0-9_-]+/g, '_'), type, name: r.name, start: r.start, end: r.end, url: r.url, imageSrc: r.imageSrc, slug: r.slug })
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
}

/** Expansion releases -> events (start = end = release day at the reset hour). Duplicates by date+name/setId are merged, first wins. */
export function releaseEvents(releases: Release[], cutoff: Date): GameEvent[] {
  const seen = new Set<string>()
  const out: GameEvent[] = []
  for (const r of releases) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(r.date)
    if (!m) continue
    const at = iso(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    if (Date.parse(at) < cutoff.getTime()) continue
    const k = `${r.date}|${r.setId ?? ''}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ id: `expansion-${r.setId ?? r.date}`, type: 'expansion', name: r.name, start: at, end: at, ...(r.setId ? { setId: r.setId } : {}) })
  }
  return out
}

const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Serebii set slug (`/tcgpocket/<slug>/<nnn>.shtml`, read off the real nav / card links) -> our set id. */
export const SEREBII_SET_SLUGS: Record<string, string> = {
  geneticapex: 'A1', mythicalisland: 'A1a', 'space-timesmackdown': 'A2', triumphantlight: 'A2a', shiningrevelry: 'A2b',
  celestialguardians: 'A3', extradimensionalcrisis: 'A3a', eeveegrove: 'A3b', wisdomofseaandsky: 'A4', secludedsprings: 'A4a',
  deluxepackex: 'A4b', megarising: 'B1', crimsonblaze: 'B1a', fantasticalparade: 'B2', paldeanwonders: 'B2a', megashine: 'B2b',
  pulsingaura: 'B3', paradoxdrive: 'B3a', everydaywonders: 'B3b', ruleroftheskies: 'B4', "teamrocket'sambition": 'B4a',
  deluxepackmega: 'B4b', dualfusion: 'C1', firstpartners: 'SP1', 'promo-a': 'P-A', 'promo-b': 'P-B', 'promo-c': 'P-C',
}

export interface EventDetails {
  /** Obtainable / featured cards: new cards of the event, drop & event-shop rewards, Wonder Pick options (our ids, deduped). */
  cardIds: string[]
  /** Wonder Pick "bonus pick" options that are not already regular options. */
  bonusCardIds: string[]
  /** Short human summary (English, as on Serebii): event promo packs, shop exchange cost. */
  rewards: string[]
}

type SetRef = { id: string; nameEn?: string }
const CARD_RE = /\/tcgpocket\/(?:th\/)?([^/"'<>\s][^/"<>\s]*?)\/0*(\d{1,3})\.(?:shtml|jpg|png)/gi

function cardsIn(html: string, sets: SetRef[], cardIds: Set<string>): string[] {
  const byName = new Map(sets.filter((s) => s.nameEn).map((s) => [alnum(s.nameEn!), s.id]))
  const out = new Set<string>()
  for (const m of html.matchAll(CARD_RE)) {
    const slug = decodeURIComponent(m[1]).toLowerCase()
    const setId = SEREBII_SET_SLUGS[slug] ?? byName.get(alnum(slug))
    const id = setId && `${setId}-${Number(m[2])}`
    if (id && cardIds.has(id)) out.add(id)
  }
  return [...out]
}

/** Section anchors of an event page, in page order. Cards that matter live in the first five; battles (opponent decks) are ignored. */
const H2 = String.raw`<h2>(?:<a [^>]*></a>)?\s*`
const SECTIONS: [key: 'new' | 'pick' | 'bonus' | 'packs' | 'missions' | 'exchange' | 'battles' | 'cosmetics', re: RegExp][] = [
  ['new', new RegExp(H2 + 'New Cards in Event')],
  ['pick', new RegExp(H2 + 'Possible Wonder Pick Options')],
  ['bonus', new RegExp(H2 + 'Possible Bonus Pick Options')],
  ['packs', new RegExp(H2 + 'Event Promo Packs')],
  ['missions', new RegExp(H2 + 'Special Missions in Event')],
  ['exchange', new RegExp(H2 + 'Event Item Exchanges')],
  ['battles', new RegExp(H2 + 'Event Battles')],
  ['cosmetics', new RegExp(H2 + 'New Cosmetics in Event')],
]

/**
 * Details of a Serebii drop / Wonder Pick event page. The page is a series of tables introduced by a title cell
 * ("New Cards in Event", "Possible Wonder Pick Options", "Possible Bonus Pick Options", "Event Item Exchanges"...);
 * cards are links `/tcgpocket/<set-slug>/<nnn>.shtml` (set slug in SEREBII_SET_SLUGS, else matched on the set's English name).
 * Opponents' decks ("Event Battles") are deliberately ignored: only cards you can get are returned. Unknown ids are dropped.
 */
export function parseEventDetails(html: string, sets: SetRef[], cardIds: Set<string>): EventDetails {
  const at = SECTIONS.map(([key, re]) => ({ key, i: html.search(re) })).filter((a) => a.i >= 0).sort((a, b) => a.i - b.i)
  const sec = (key: string) => {
    const k = at.findIndex((a) => a.key === key)
    return k < 0 ? '' : html.slice(at[k].i, k + 1 < at.length ? at[k + 1].i : at[k].i + 20000)
  }
  const main = new Set<string>()
  for (const k of ['new', 'pick', 'exchange']) for (const id of cardsIn(sec(k), sets, cardIds)) main.add(id)
  const bonusCardIds = cardsIn(sec('bonus'), sets, cardIds).filter((id) => !main.has(id))
  const rewards: string[] = []
  const packs = sec('packs')
  for (const r of packs.match(/<tr[\s\S]*?(?=<tr|$)/g) ?? []) {
    const name = /<a href="\/tcgpocket\/promo\/[^"]*"><u>([^<]+)<\/u><\/a>/.exec(r)?.[1]
    const n = /<td class="cen">\s*(\d+)\s*<\/td>/.exec(r)?.[1]
    if (name && !rewards.some((x) => x.startsWith(decodeEntities(name.trim())))) rewards.push(decodeEntities(name.trim()) + (n ? ` (${n} cards)` : ''))
  }
  const cost = /([\d]+\s+[A-Za-z' ]+Ticket)\s*<\/td>/.exec(sec('exchange'))?.[1]
  if (cost) rewards.push(`${cost.trim()} per card`)
  return { cardIds: [...main, ...bonusCardIds], bonusCardIds, rewards }
}

/** Featured cards of an event page (see parseEventDetails), our card ids. */
export function parseEventCards(html: string, sets: SetRef[], cardIds: Set<string>): string[] {
  return parseEventDetails(html, sets, cardIds).cardIds
}
