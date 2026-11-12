import { describe, expect, it } from 'vitest'
import type { DeckStats, MetaDeck, MetaFile } from './compute'
import type { PmTierList } from '../pocketMads/types'
import { PM_STALE_HOURS, chooseMetaSource, homeTierList } from './source'

const H = 3600_000
const NOW = Date.parse('2026-11-12T09:00:00Z')
const st = (score: number, tier: DeckStats['tier']): DeckStats => ({ share: 0.05, players: 10, wins: 60, losses: 40, games: 100, winRate: 0.6, posGames: 0, posWinRate: 0, score, tier })
const deck = (id: string, s?: DeckStats): MetaDeck => ({ id, name: id, nameFr: id, icons: [], iconCardIds: [], lists: 0, consensus: [], flex: [], stats: s ? { '7d': s } : {} })
const meta: MetaFile = {
  generatedAt: '2026-11-12T06:00:00Z', source: 'Limitless',
  windows: {} as MetaFile['windows'],
  decks: [deck('a', st(60, 2)), deck('b', st(75, 1)), deck('c', st(70, 1)), deck('d', st(20, null)), deck('e')],
}
const pm = (ageH: number): PmTierList => ({ fetchedAt: new Date(NOW - ageH * H).toISOString(), tiers: [] })

describe('source de la tier list Méta', () => {
  it('PocketMads tant que sa lecture est récente', () => {
    expect(chooseMetaSource(pm(5), meta, NOW)).toEqual({ source: 'pm' })
  })
  it('calcul Holothèque si PocketMads est périmé, jamais lu ou en échec', () => {
    expect(chooseMetaSource(pm(PM_STALE_HOURS + 1), meta, NOW)).toEqual({ source: 'home', reason: 'stale', pmAgeHours: PM_STALE_HOURS + 1 })
    expect(chooseMetaSource(null, meta, NOW)).toEqual({ source: 'home', reason: 'none', pmAgeHours: undefined })
    expect(chooseMetaSource(pm(1), meta, NOW, true).reason).toBe('error')
  })
  it('garde la vieille liste PocketMads faute de calcul maison', () => {
    expect(chooseMetaSource(pm(100), null, NOW)).toEqual({ source: 'pm' })
    expect(chooseMetaSource(pm(100), { ...meta, decks: [deck('d', st(20, null))] }, NOW)).toEqual({ source: 'pm' })
    expect(chooseMetaSource(null, null, NOW)).toEqual({ source: null })
  })
  it('tier list maison : tiers fixes, tri par score, decks sans tier écartés', () => {
    const t = homeTierList(meta)
    expect(t.tiers.map((x) => x.key)).toEqual(['0', '1', '2', '3', 'S'])
    expect(t.tiers[1].decks.map((d) => d.id)).toEqual(['b', 'c'])
    expect(t.tiers[2].decks[0]).toMatchObject({ id: 'a', score: 60, winRate: 0.6, games: 100 })
    expect(t.tiers.flatMap((x) => x.decks).some((d) => d.id === 'd' || d.id === 'e')).toBe(false)
    expect(t.fetchedAt).toBe(meta.generatedAt)
  })
})
