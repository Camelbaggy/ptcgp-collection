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

/**
 * Featured cards of an event page (best effort): links / thumbnails to the Serebii card database
 * (`/tcgpocket/dex/<set-slug>/<n>.shtml` or `.../th/<set-slug>/<nnn>.jpg`), mapped to our ids with the
 * set's English name (alphanumerics only, "Promo-A" = "promoa") and the card number; unknown ids are dropped.
 */
export function parseEventCards(html: string, sets: { id: string; nameEn?: string }[], cardIds: Set<string>): string[] {
  const setBySlug = new Map(sets.filter((s) => s.nameEn).map((s) => [alnum(s.nameEn!), s.id]))
  const out = new Set<string>()
  for (const m of html.matchAll(/\/tcgpocket\/dex\/(?:th\/)?([a-z0-9'-]+)\/0*(\d{1,3})\.(?:shtml|jpg|png)/gi)) {
    const setId = setBySlug.get(alnum(m[1]))
    const id = setId && `${setId}-${Number(m[2])}`
    if (id && cardIds.has(id)) out.add(id)
  }
  return [...out]
}
