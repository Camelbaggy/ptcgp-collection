// Shared event types + helpers. Events come from Pokémon-Zone pages imported by the user (see pokemonZone.ts);
// expansion dates also come from public/data/releases.json (releaseEvents).
// PTCGP switches day at 06:00 UTC: release days from releases.json are placed at that hour.

export type EventType = 'special' | 'drop' | 'wonderpick' | 'emblem' | 'massoutbreak' | 'expansion' | 'shop'

export interface GameEvent {
  id: string
  type: EventType
  name: string
  /** ISO instants (UTC). */
  start: string
  end: string
  /** Path relative to public/ (e.g. "events/<id>.webp"), set only when the image was downloaded. */
  image?: string
  /** Source page of the event. */
  url?: string
  /** Featured cards (drop / wonderpick), our card ids, best effort. */
  cardIds?: string[]
  /** Wonder Pick bonus-pick options (subset of cardIds). */
  bonusCardIds?: string[]
  /** Short English summary of what the event gives (promo packs, shop cost). */
  rewards?: string[]
  setId?: string
}

export interface Release { setId?: string; name: string; date: string }

export const RESET_HOUR_UTC = 6

export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ecirc: 'ê', ocirc: 'ô', ccedil: 'ç', rsquo: '’', lsquo: '‘' }
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m)
}

const iso = (y: number, m: number, d: number, plusDays = 0) => new Date(Date.UTC(y, m, d + plusDays, RESET_HOUR_UTC)).toISOString()

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

