import type { EventType, GameEvent } from '../../lib/events/parse'
import type { IconName } from '../../components/Icon'

export const TYPE_INFO: Record<EventType, { label: string; icon: IconName }> = {
  special: { label: 'Spécial', icon: 'sparkle' },
  drop: { label: 'Drop', icon: 'gift' },
  wonderpick: { label: 'Wonder Pick', icon: 'cards' },
  emblem: { label: 'Emblème', icon: 'medal' },
  massoutbreak: { label: 'Invasion', icon: 'bolt' },
  expansion: { label: 'Extension', icon: 'pack' },
  shop: { label: 'Boutique', icon: 'cart' },
}
export const TYPE_ORDER: EventType[] = ['expansion', 'special', 'drop', 'wonderpick', 'emblem', 'massoutbreak', 'shop']

/** « 2 j 5 h », « 5 h 12 min », « 12 min » (jamais négatif). */
export function duration(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000))
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60
  if (d > 0) return h > 0 ? `${d} j ${h} h` : `${d} j`
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`
  return `${Math.max(1, m)} min`
}

export const phase = (e: GameEvent, now: number): 'live' | 'soon' | 'past' => {
  const s = Date.parse(e.start), x = Date.parse(e.end)
  return now < s ? 'soon' : now < x ? 'live' : 'past'
}

export const timeLabel = (e: GameEvent, now: number): string => {
  const p = phase(e, now)
  return p === 'live' ? `se termine dans ${duration(Date.parse(e.end) - now)}`
    : p === 'soon' ? `commence dans ${duration(Date.parse(e.start) - now)}`
    : 'terminé'
}

/** Nombre de jours calendaires (heure locale) jusqu'à la date. */
export function daysUntil(iso: string, now: number): number {
  const a = new Date(now), b = new Date(iso)
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()), db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((db - da) / 86400000)
}

const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
/** Dans le fuseau local de l'appareil. */
export const dateTimeFr = (iso: string) => fmt.format(new Date(iso))
export const dayFr = (iso: string) => fmtDay.format(new Date(iso))
export const rangeFr = (e: { start: string; end: string }) => `${dateTimeFr(e.start)} → ${dateTimeFr(e.end)}`

const rel = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })
/** « il y a 5 minutes », « hier »… */
export function agoFr(iso: string, now = Date.now()): string {
  const s = (Date.parse(iso) - now) / 1000
  const a = Math.abs(s)
  if (a < 60) return 'à l’instant'
  if (a < 3600) return rel.format(Math.round(s / 60), 'minute')
  if (a < 86400) return rel.format(Math.round(s / 3600), 'hour')
  return rel.format(Math.round(s / 86400), 'day')
}
