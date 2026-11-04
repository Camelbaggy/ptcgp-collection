import { describe, expect, it } from 'vitest'
import fixture from './fixtures/standings.json'
import { computeMeta, consensusList, deckNameFr, selectTournaments, tierOf, wilsonLower, type LlStanding, type TournamentData } from './compute'

const fx = fixture as unknown as TournamentData
const cards = [
  { id: 'A4a-1', name: 'Suicune', nameEn: 'Suicune' },
  { id: 'B2a-1', name: 'Glaivodo', nameEn: 'Baxcalibur' },
  { id: 'B1a-14', name: 'Méga-Dracaufeu Y', nameEn: 'Mega Charizard Y' },
  { id: 'A4a-2', name: 'Entei', nameEn: 'Entei' },
]
const NOW = Date.parse('2026-11-04T12:00:00Z')
const data = [{ tournament: fx.tournament, standings: fx.standings }]

describe('meta compute', () => {
  it('wilson bound is below the observed rate and grows with sample size', () => {
    expect(wilsonLower(0.6, 20)).toBeLessThan(0.6)
    expect(wilsonLower(0.6, 500)).toBeGreaterThan(wilsonLower(0.6, 20))
    expect(wilsonLower(0.5, 0)).toBe(0)
  })
  it('tiers follow the thresholds', () => {
    expect(tierOf(2.1)).toBe('S'); expect(tierOf(1.5)).toBe('A'); expect(tierOf(1)).toBe('B'); expect(tierOf(0.6)).toBe('C'); expect(tierOf(0.1)).toBe('D')
  })
  it('computes shares that sum to <= 1 and ties count half', () => {
    const m = computeMeta(data, cards, NOW)
    const d7 = m.decks.map((d) => d.stats['7d']!).filter(Boolean)
    expect(d7.reduce((a, s) => a + s.share, 0)).toBeLessThanOrEqual(1.0001)
    const t = m.decks[0].stats['7d']!
    expect(t.winRate).toBeCloseTo((t.wins + t.ties / 2) / (t.wins + t.losses + t.ties), 6)
    expect(m.windows['7d'].players).toBe(fx.standings.length)
  })
  it('windows exclude old tournaments', () => {
    const m = computeMeta(data, cards, Date.parse('2026-11-10T12:00:00Z'))
    expect(m.windows['3d'].players).toBe(0)
    expect(m.windows['14d'].players).toBe(fx.standings.length)
    expect(m.decks.every((d) => !d.stats['3d'])).toBe(true)
  })
  it('builds a 20-card consensus with ids <set>-<number>', () => {
    const m = computeMeta(data, cards, NOW)
    const top = m.decks.find((d) => d.id === 'suicune-ex-a4a-baxcalibur-b2a')!
    expect(top.consensus.reduce((a, c) => a + c.count, 0)).toBe(20)
    expect(top.consensus.every((c) => /^[A-Za-z0-9-]+-\d+$/.test(c.cardId))).toBe(true)
    expect(top.consensus[0].inclusion).toBeGreaterThanOrEqual(top.consensus[top.consensus.length - 1].inclusion)
    expect(top.flex.every((c) => c.inclusion >= 0.3 && c.inclusion <= 0.7)).toBe(true)
    expect(top.nameFr).toBe('Suicune-ex Glaivodo')
    expect(top.iconCardIds.length).toBe(2)
  })
  it('merges printings by name and uses the modal count', () => {
    const mk = (set: string, count: number): LlStanding => ({ decklist: { pokemon: [], trainer: [{ count, set, number: '7', name: 'Professor\'s Research' }] } })
    const c = consensusList([mk('P-A', 2), mk('A1', 2), mk('P-A', 1)])
    expect(c.consensus).toHaveLength(1)
    expect(c.consensus[0].count).toBe(2)
    expect(c.consensus[0].cardId).toBe('P-A-7')
  })
  it('translates deck names', () => {
    const fr = new Map([['mega charizard y', 'Méga-Dracaufeu Y'], ['entei', 'Entei']])
    expect(deckNameFr('Mega Charizard Y ex Entei ex', new Set(), fr).nameFr).toBe('Méga-Dracaufeu Y-ex Entei-ex')
  })
  it('selects finished, big enough, non-custom tournaments', () => {
    const t = (id: string, date: string, players: number, format: string | null = null) => ({ id, date, players, format })
    const r = selectTournaments([t('a', '2026-11-04T10:00:00Z', 50), t('b', '2026-11-03T10:00:00Z', 10), t('c', '2026-11-03T10:00:00Z', 50, 'CUSTOM'), t('d', '2026-11-03T10:00:00Z', 50), t('e', '2026-10-01T10:00:00Z', 50)], NOW)
    expect(r.map((x) => x.id)).toEqual(['d'])
  })
})
