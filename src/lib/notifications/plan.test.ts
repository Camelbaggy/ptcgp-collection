import { beforeAll, describe, expect, it } from 'vitest'
import type { GameEvent } from '../events/parse'
import {
  avoidNight, DEFAULT_NOTIF_SETTINGS, eventKind, hourLabel, nextReminderAt, normalizeSettings, planNotifications,
  relDay, type NotifSettings, type PlanInput,
} from './plan'

beforeAll(() => { process.env.TZ = 'Europe/Paris' })

const H = 3600000, DAY = 24 * H
const ON: NotifSettings = { ...DEFAULT_NOTIF_SETTINGS, enabled: true }
// mardi 10 novembre 2026, 12 h à Paris (11 h UTC)
const NOW = Date.parse('2026-11-10T11:00:00Z')

const ev = (id: string, type: GameEvent['type'], start: string, end: string, extra: Partial<GameEvent & { group: string }> = {}) =>
  ({ id, type, name: id, start, end, ...extra })

function input(over: Partial<PlanInput> = {}): PlanInput {
  return { now: NOW, settings: ON, events: [], label: (e) => e.name, missing: () => 0, lastUpdate: null, ...over }
}

describe('helpers', () => {
  it('formats hours and relative days in local time', () => {
    expect(hourLabel(Date.parse('2026-11-11T06:00:00Z'))).toBe('7 h')
    expect(hourLabel(Date.parse('2026-11-11T06:30:00Z'))).toBe('7 h 30')
    expect(relDay(Date.parse('2026-11-11T06:00:00Z'), NOW)).toBe('demain')
    expect(relDay(NOW + H, NOW)).toBe('aujourd’hui')
    expect(relDay(Date.parse('2026-11-16T06:00:00Z'), NOW)).toBe('lundi')
  })
  it('moves night times to 21 h the evening before', () => {
    expect(new Date(avoidNight(Date.parse('2026-11-11T00:00:00Z'))).toISOString()).toBe('2026-11-10T20:00:00.000Z') // 1 h → 21 h veille
    expect(new Date(avoidNight(Date.parse('2026-11-10T22:00:00Z'))).toISOString()).toBe('2026-11-10T20:00:00.000Z') // 23 h → 21 h
    const ok = Date.parse('2026-11-11T06:00:00Z') // 7 h
    expect(avoidNight(ok)).toBe(ok)
  })
  it('classifies events', () => {
    expect(eventKind(ev('a', 'wonderpick', '', ''))).toBe('wonderpick')
    expect(eventKind(ev('a', 'shop', '', '', { group: 'gold' }))).toBe('gold')
    expect(eventKind(ev('a', 'shop', '', ''))).toBe('shop')
    expect(eventKind(ev('a', 'drop', '', ''))).toBe('missions')
    expect(eventKind(ev('a', 'expansion', '', ''))).toBeNull()
  })
  it('normalizes stored settings', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_NOTIF_SETTINGS)
    expect(normalizeSettings({ enabled: true, events: { when: 'x', kinds: ['shop', 'bad'] }, reminder: { days: 5 } })).toEqual({
      ...DEFAULT_NOTIF_SETTINGS, enabled: true, events: { ...DEFAULT_NOTIF_SETTINGS.events, kinds: ['shop'] },
    })
  })
})

describe('planNotifications', () => {
  it('plans nothing when disabled', () => {
    const events = [ev('w', 'wonderpick', '2026-11-08T06:00:00Z', '2026-11-12T06:00:00Z')]
    expect(planNotifications(input({ settings: { ...ON, enabled: false }, events, lastUpdate: NOW }))).toEqual([])
  })

  it('warns the day before an event ends, with missing cards', () => {
    const events = [ev('Pioche Évoli', 'wonderpick', '2026-11-08T06:00:00Z', '2026-11-12T06:00:00Z')]
    const [n, ...rest] = planNotifications(input({ events, missing: () => 2 }))
    expect(rest).toEqual([])
    expect(new Date(n.at).toISOString()).toBe('2026-11-11T06:00:00.000Z')
    expect(n).toMatchObject({ id: 1, kind: 'event', title: 'Dernier jour : Pioche Évoli', body: 'Se termine demain à 7 h. Il te manque 2 cartes de cet évènement.', route: '#/evenements' })
  })

  it('groups events ending at the same time and filters kinds', () => {
    const end = '2026-11-12T06:00:00Z'
    const events = [
      ev('A', 'wonderpick', '2026-11-08T06:00:00Z', end),
      ev('B', 'drop', '2026-11-08T06:00:00Z', end),
      ev('Boutique', 'shop', '2026-11-08T06:00:00Z', end),
      ev('Gold', 'shop', '2026-11-08T06:00:00Z', end, { group: 'gold' }),
    ]
    const out = planNotifications(input({ events }))
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ title: '2 évènements se terminent demain à 7 h', body: 'A, B' })
  })

  it('6 h before an end at 7 h is moved to 21 h the evening before', () => {
    const events = [ev('A', 'drop', '2026-11-08T06:00:00Z', '2026-11-12T06:00:00Z')]
    const out = planNotifications(input({ events, settings: { ...ON, events: { ...ON.events, when: '6h' } } }))
    expect(out).toHaveLength(1)
    expect(new Date(out[0].at).toISOString()).toBe('2026-11-11T20:00:00.000Z')
    expect(out[0].title).toBe('Plus que 10 h : A')
    expect(out[0].body).toBe('Se termine demain à 7 h.')
  })

  it('"both" gives two notifications, skips past ones and those before the start', () => {
    const events = [
      ev('A', 'drop', '2026-11-08T06:00:00Z', '2026-11-13T06:00:00Z'),
      ev('Passé', 'drop', '2026-11-01T06:00:00Z', '2026-11-10T06:00:00Z'),
      ev('Court', 'drop', '2026-11-12T06:00:00Z', '2026-11-12T18:00:00Z'), // dure 12 h : la veille est avant le début
    ]
    const out = planNotifications(input({ events, settings: { ...ON, events: { ...ON.events, when: 'both' } } }))
    expect(out.map((n) => [new Date(n.at).toISOString(), n.title])).toEqual([
      ['2026-11-12T12:00:00.000Z', 'Plus que 6 h : Court'],
      ['2026-11-12T06:00:00.000Z', 'Dernier jour : A'],
      ['2026-11-12T20:00:00.000Z', 'Plus que 10 h : A'],
    ].sort((a, b) => a[0].localeCompare(b[0])))
  })

  it('announces an expansion on release day, once even if listed twice, and optionally the day before', () => {
    const events = [
      ev('Prochaine extension', 'expansion', '2026-12-16T06:00:00Z', '2026-12-16T06:00:00Z'),
      ev('Méga Évolution', 'expansion', '2026-12-16T06:00:00Z', '2026-12-16T06:00:00Z'),
    ]
    const out = planNotifications(input({ events, now: Date.parse('2026-12-01T10:00:00Z'), settings: { ...ON, expansion: { on: true, eve: true } } }))
    expect(out.map((n) => [new Date(n.at).toISOString(), n.title, n.body])).toEqual([
      ['2026-12-15T06:00:00.000Z', 'Nouvelle extension demain', 'Sortie demain à 7 h.'],
      ['2026-12-16T06:00:00.000Z', 'Nouvelle extension disponible', 'La nouvelle extension sort aujourd’hui dans Pokémon TCG Pocket.'],
    ])
  })

  it('names a known expansion', () => {
    const events = [ev('Méga Évolution', 'expansion', '2026-11-20T06:00:00Z', '2026-11-20T06:00:00Z')]
    expect(planNotifications(input({ events }))[0].title).toBe('Nouvelle extension : Méga Évolution')
  })

  it('reminds N days after the last update at 19 h, then every N days', () => {
    const last = Date.parse('2026-11-05T09:00:00Z')
    expect(new Date(nextReminderAt(last, 7, NOW)).toISOString()).toBe('2026-11-12T18:00:00.000Z')
    expect(new Date(nextReminderAt(last, 3, NOW)).toISOString()).toBe('2026-11-11T18:00:00.000Z') // 8/11 passé → 11/11
    const [n] = planNotifications(input({ lastUpdate: last }))
    expect(n).toMatchObject({ kind: 'reminder', title: 'Ta collection n’a pas bougé depuis 7 jours', route: '#/ajout?onglet=massive' })
    expect(planNotifications(input({ lastUpdate: null }))).toEqual([])
  })

  it('stays within the horizon and the cap', () => {
    const far = [ev('Loin', 'drop', '2026-11-08T06:00:00Z', '2027-03-01T06:00:00Z')]
    expect(planNotifications(input({ events: far }))).toEqual([])
    const many = Array.from({ length: 60 }, (_, k) => ev(`E${k}`, 'drop', '2026-11-08T06:00:00Z', new Date(NOW + (k + 2) * DAY / 2 + 2 * H).toISOString()))
    const out = planNotifications(input({ events: many }))
    expect(out.length).toBeLessThanOrEqual(40)
    expect(out.map((n) => n.id)).toEqual(out.map((_, k) => k + 1))
  })
})
