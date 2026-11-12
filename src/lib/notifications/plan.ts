/**
 * Notifications locales de l'appli Android : calcul pur de ce qu'il faut prévoir (aucun accès au plugin ni à la base).
 * Trois sortes : fin d'un évènement (regroupées par moment), sortie d'une extension, rappel de mise à jour de la collection.
 * Toutes les heures sont celles du téléphone. Rien n'est envoyé entre 22 h et 7 h : une fin d'évènement qui tomberait
 * la nuit est avancée à 21 h la veille.
 */
import type { GameEvent } from '../events/parse'

export type NotifEventKind = 'wonderpick' | 'missions' | 'shop' | 'gold'
export type EventLead = 'eve' | '6h' | 'both'
export type ReminderDays = 3 | 7 | 14

export interface NotifSettings {
  /** Interrupteur général (permission Android demandée en l'activant). */
  enabled: boolean
  events: { on: boolean; when: EventLead; kinds: NotifEventKind[] }
  expansion: { on: boolean; eve: boolean }
  reminder: { on: boolean; days: ReminderDays }
}

export const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  enabled: false,
  events: { on: true, when: 'eve', kinds: ['wonderpick', 'missions'] },
  expansion: { on: true, eve: false },
  reminder: { on: true, days: 7 },
}

export const EVENT_KIND_LABEL: Record<NotifEventKind, string> = {
  wonderpick: 'Pioches miracles',
  missions: 'Missions et évènements',
  shop: 'Boutiques',
  gold: 'Offres Poké Lingots',
}

/** Relit des réglages enregistrés (anciens, partiels ou abîmés) en complétant par les valeurs par défaut. */
export function normalizeSettings(raw: unknown): NotifSettings {
  const d = DEFAULT_NOTIF_SETTINGS
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof NotifSettings, unknown>>
  const o = <T extends object>(x: unknown): Partial<T> => (x && typeof x === 'object' ? x as Partial<T> : {})
  const ev = o<NotifSettings['events']>(r.events), ex = o<NotifSettings['expansion']>(r.expansion), re = o<NotifSettings['reminder']>(r.reminder)
  const kinds = Array.isArray(ev.kinds) ? ev.kinds.filter((k): k is NotifEventKind => k in EVENT_KIND_LABEL) : d.events.kinds
  return {
    enabled: r.enabled === true,
    events: {
      on: typeof ev.on === 'boolean' ? ev.on : d.events.on,
      when: ev.when === 'eve' || ev.when === '6h' || ev.when === 'both' ? ev.when : d.events.when,
      kinds,
    },
    expansion: { on: typeof ex.on === 'boolean' ? ex.on : d.expansion.on, eve: typeof ex.eve === 'boolean' ? ex.eve : d.expansion.eve },
    reminder: { on: typeof re.on === 'boolean' ? re.on : d.reminder.on, days: re.days === 3 || re.days === 7 || re.days === 14 ? re.days : d.reminder.days },
  }
}

/** Catégorie d'un évènement pour le filtre « Quels évènements » (null : extension, jamais notifiée comme fin). */
export function eventKind(e: GameEvent & { group?: string }): NotifEventKind | null {
  if (e.type === 'expansion') return null
  if (e.group === 'gold') return 'gold'
  if (e.type === 'wonderpick') return 'wonderpick'
  if (e.type === 'shop') return 'shop'
  return 'missions'
}

export type PlannedKind = 'event' | 'expansion' | 'reminder'
export interface PlannedNotif {
  id: number
  /** Instant d'envoi (ms). */
  at: number
  kind: PlannedKind
  title: string
  body: string
  /** Page ouverte quand on touche la notification (`#/…`). */
  route: string
}

export interface PlanInput {
  now: number
  settings: NotifSettings
  /** Évènements Pokémon-Zone et sorties d'extensions (liste fusionnée de l'écran Évènements). */
  events: (GameEvent & { group?: string })[]
  /** Nom affiché (français) d'un évènement. */
  label: (e: GameEvent) => string
  /** Cartes de l'évènement encore manquantes (0 si aucune ou inconnu). */
  missing: (e: GameEvent) => number
  /** Date de la dernière saisie dans la collection (pack, échange, partage, mise à jour), null si aucune. */
  lastUpdate: number | null
}

const H = 3600000, DAY = 24 * H
/** Horizon de planification et plafond : l'appli replanifie à chaque ouverture. */
export const HORIZON_DAYS = 30
export const MAX_NOTIFS = 40
const QUIET_START = 22, QUIET_END = 7, EVENING = 21, REMINDER_HOUR = 19

/** Décale une heure tombant entre 22 h et 7 h à 21 h la veille au soir (jamais plus tard que prévu). */
export function avoidNight(at: number): number {
  const d = new Date(at)
  const h = d.getHours()
  if (h >= QUIET_START) { d.setHours(EVENING, 0, 0, 0); return d.getTime() }
  if (h < QUIET_END) { d.setDate(d.getDate() - 1); d.setHours(EVENING, 0, 0, 0); return d.getTime() }
  return at
}

const dayIndex = (ms: number) => { const d = new Date(ms); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY }
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

/** « 7 h », « 7 h 30 ». */
export function hourLabel(ms: number): string {
  const d = new Date(ms)
  const m = d.getMinutes()
  return m ? `${d.getHours()} h ${String(m).padStart(2, '0')}` : `${d.getHours()} h`
}

/** Jour de `target` vu depuis `from` : « aujourd’hui », « demain », « lundi ». */
export function relDay(target: number, from: number): string {
  const n = dayIndex(target) - dayIndex(from)
  return n <= 0 ? 'aujourd’hui' : n === 1 ? 'demain' : WEEKDAYS[new Date(target).getDay()]
}

const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? 's' : ''}`

function listNames(names: string[], max = 4): string {
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max - 1).join(', ')} et ${names.length - max + 1} autres`
}

interface EndSlot { at: number; lead: 'eve' | '6h'; events: GameEvent[] }

function eventEndNotifs(i: PlanInput, until: number): Omit<PlannedNotif, 'id'>[] {
  const s = i.settings.events
  if (!s.on || !s.kinds.length) return []
  const leads: ('eve' | '6h')[] = s.when === 'both' ? ['eve', '6h'] : [s.when]
  const slots = new Map<number, EndSlot>()
  const seen = new Set<string>()
  for (const e of i.events) {
    const k = eventKind(e)
    if (!k || !s.kinds.includes(k)) continue
    const start = Date.parse(e.start), end = Date.parse(e.end)
    if (!(end > start) || end <= i.now) continue
    for (const lead of leads) {
      const at = avoidNight(end - (lead === 'eve' ? DAY : 6 * H))
      // pas avant le début de l'évènement, pas dans le passé, pas au-delà de l'horizon
      if (at < start || at <= i.now || at > until) continue
      // « les deux » qui tombent au même moment après le décalage de nuit : une seule fois
      const key = `${e.id}|${at}`
      if (seen.has(key)) continue
      seen.add(key)
      const slot = slots.get(at) ?? { at, lead, events: [] }
      slot.events.push(e)
      slots.set(at, slot)
    }
  }
  return [...slots.values()].map(({ at, events }) => {
    const ends = events.map((e) => Date.parse(e.end))
    const sameEnd = ends.every((x) => x === ends[0])
    const when = `${relDay(ends[0], at)} à ${hourLabel(ends[0])}`
    if (events.length === 1) {
      const e = events[0]
      const left = ends[0] - at
      const miss = i.missing(e)
      const title = left <= 12 * H ? `Plus que ${Math.round(left / H)} h : ${i.label(e)}` : `Dernier jour : ${i.label(e)}`
      const body = `Se termine ${when}.` + (miss > 0 ? ` Il te manque ${plural(miss, 'carte')} de cet évènement.` : '')
      return { at, kind: 'event' as const, title, body, route: '#/evenements' }
    }
    const title = sameEnd ? `${events.length} évènements se terminent ${when}` : `${events.length} évènements se terminent bientôt`
    const sorted = [...events].sort((a, b) => Date.parse(a.end) - Date.parse(b.end))
    return { at, kind: 'event' as const, title, body: listNames(sorted.map(i.label)), route: '#/evenements' }
  })
}

function expansionNotifs(i: PlanInput, until: number): Omit<PlannedNotif, 'id'>[] {
  const s = i.settings.expansion
  if (!s.on) return []
  const out: Omit<PlannedNotif, 'id'>[] = []
  const seenDay = new Set<number>()
  for (const e of i.events) {
    if (e.type !== 'expansion') continue
    const at = Date.parse(e.start)
    if (!(at > i.now) || at > until + DAY) continue
    const day = dayIndex(at)
    if (seenDay.has(day)) continue // même sortie vue par Pokémon-Zone et par releases.json
    seenDay.add(day)
    const name = i.label(e)
    const generic = !name || /^prochaine extension$/i.test(name)
    if (at <= until) {
      out.push({
        at, kind: 'expansion', route: '#/evenements',
        title: generic ? 'Nouvelle extension disponible' : `Nouvelle extension : ${name}`,
        body: `${generic ? 'La nouvelle extension' : name} sort aujourd’hui dans Pokémon TCG Pocket.`,
      })
    }
    const eve = avoidNight(at - DAY)
    if (s.eve && eve > i.now && eve <= until) {
      out.push({
        at: eve, kind: 'expansion', route: '#/evenements',
        title: generic ? 'Nouvelle extension demain' : `Demain : ${name}`,
        body: `Sortie ${relDay(at, eve)} à ${hourLabel(at)}.`,
      })
    }
  }
  return out
}

/** Prochain rappel : dernière saisie + k × délai (k ≥ 1), à 19 h, strictement après maintenant. */
export function nextReminderAt(lastUpdate: number, days: number, now: number): number {
  const first = new Date(lastUpdate + days * DAY)
  first.setHours(REMINDER_HOUR, 0, 0, 0)
  let at = first.getTime()
  for (let k = 0; at <= now && k < 1000; k++) {
    const d = new Date(at)
    d.setDate(d.getDate() + days)
    at = d.getTime()
  }
  return at
}

function reminderNotifs(i: PlanInput, until: number): Omit<PlannedNotif, 'id'>[] {
  const s = i.settings.reminder
  if (!s.on || i.lastUpdate == null || !Number.isFinite(i.lastUpdate)) return []
  const at = nextReminderAt(i.lastUpdate, s.days, i.now)
  if (at > until) return []
  const idle = Math.round((dayIndex(at) - dayIndex(i.lastUpdate)))
  return [{
    at, kind: 'reminder', route: '#/ajout?onglet=massive',
    title: `Ta collection n’a pas bougé depuis ${plural(idle, 'jour')}`,
    body: 'Ajoute tes derniers boosters ou synchronise-la avec Pokémon-Zone pour garder tes stats et tes échanges à jour.',
  }]
}

/** Toutes les notifications à prévoir, triées par date, numérotées à partir de 1. */
export function planNotifications(i: PlanInput): PlannedNotif[] {
  if (!i.settings.enabled) return []
  const until = i.now + HORIZON_DAYS * DAY
  return [...eventEndNotifs(i, until), ...expansionNotifs(i, until), ...reminderNotifs(i, until)]
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_NOTIFS)
    .map((n, k) => ({ ...n, id: k + 1 }))
}
