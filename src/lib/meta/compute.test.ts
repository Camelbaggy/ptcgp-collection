import { describe, expect, it } from 'vitest'
import fixture from './fixtures/standings.json'
import matchFixture from './fixtures/matches.json'
import { SCORE_PARAMS, computeMeta, consensusList, deckNameFr, deckScore, isStandardRules, selectTournaments, shrunkRate, tierOf, windowStats, type LlPairing, type LlStanding, type MetaFile, type TournamentData } from './compute'

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
  it('shrinks win rates towards 50 % with little evidence', () => {
    expect(shrunkRate(8, 10, 20)).toBeLessThan(0.8)
    expect(shrunkRate(8, 10, 20)).toBeGreaterThan(0.5)
    expect(shrunkRate(800, 1000, 20)).toBeGreaterThan(shrunkRate(8, 10, 20))
    expect(shrunkRate(0, 0, 25)).toBe(0.5)
  })
  it('score is bounded, and grows with share, win rate and positioning', () => {
    const base = { share: 0.02, wins: 100, games: 200, posWins: 50, posGames: 100 }
    expect(deckScore({ ...base, share: 0, wins: 0, games: 0, posWins: 0, posGames: 0 })).toBeCloseTo(SCORE_PARAMS.base, 6)
    expect(deckScore({ ...base, share: 0.05 })).toBeGreaterThan(deckScore(base))
    expect(deckScore({ ...base, wins: 130 })).toBeGreaterThan(deckScore(base))
    expect(deckScore({ ...base, posWins: 70 })).toBeGreaterThan(deckScore(base))
    expect(deckScore({ ...base, share: 1, wins: 200, posWins: 100 })).toBe(100)
    expect(deckScore({ share: 0, wins: 0, games: 300, posWins: 0, posGames: 300 })).toBe(0)
  })
  it('tiers follow the thresholds, sleepers need < 100 matches, a score >= 55 and 10 wins', () => {
    expect(tierOf(85, 300, 180, 20)).toBe(0)
    expect(tierOf(85, 300, 180, 3)).toBe(1) // not clearly ahead
    expect(tierOf(70, 300, 180)).toBe(1); expect(tierOf(60, 300, 160)).toBe(2); expect(tierOf(30, 300, 120)).toBe(3)
    expect(tierOf(60, 99, 12)).toBe('S'); expect(tierOf(60, 99, 9)).toBeNull(); expect(tierOf(54, 99, 40)).toBeNull()
    expect(tierOf(90, 99, 60)).toBe('S') // never a numbered tier under 100 matches
  })
  it('counts only decided matches between two known, different archetypes', () => {
    const st = (player: string, id: string): LlStanding => ({ player, name: player, deck: { id, name: id.toUpperCase() } })
    const standings = [st('a', 'x'), st('b', 'y'), st('c', 'y'), st('d', 'x'), st('e', 'x')]
    const pairings: LlPairing[] = [
      { winner: 'a', player1: 'a', player2: 'b' }, // x beats y
      { winner: 'c', player1: 'd', player2: 'c' }, // y beats x
      { winner: 'a', player1: 'a', player2: 'd' }, // mirror
      { winner: 0, player1: 'a', player2: 'c' }, // tie
      { winner: -1, player1: 'a', player2: 'c' }, // double loss
      { winner: 'a', player1: 'a' }, // bye
      { winner: -1, player1: 'a' }, // no result
      { winner: 'zz', player1: 'zz', player2: 'a' }, // unknown opponent
      { winner: 'e', player1: 'e', player2: 'b' }, // x beats y
    ]
    const r = windowStats([{ tournament: { id: 't', date: '2026-11-01T00:00:00Z', players: 5 }, standings, pairings }], NOW, 7)
    expect(r.window.matches).toBe(3)
    const x = r.stats.get('X')!, y = r.stats.get('Y')!
    expect([x.wins, x.losses, x.games]).toEqual([2, 1, 3])
    expect([y.wins, y.losses, y.games]).toEqual([1, 2, 3])
    expect(x.share).toBeCloseTo(3 / 5, 6)
    expect(x.posGames).toBe(3) // both decks are >= 3 % of the field
    expect(x.matchups).toEqual([{ op: 'Y', wins: 2, games: 3 }])
    expect(y.matchups).toEqual([{ op: 'X', wins: 1, games: 3 }])
  })
  it('lists matchups against the most played archetypes, symmetric and without the mirror', () => {
    const fxs = matchFixture as unknown as TournamentData[]
    const r = windowStats(fxs, Date.parse('2026-11-02T12:00:00Z'), 7)
    const byShare = [...r.stats].sort((a, b) => b[1].players - a[1].players || a[0].localeCompare(b[0])).map(([k]) => k)
    for (const [k, s] of r.stats) {
      const ops = s.matchups!.map((m) => m.op)
      expect(ops).not.toContain(k)
      expect(ops).toEqual(byShare.filter((o) => o !== k).slice(0, ops.length))
      expect(ops.length).toBe(Math.min(20, r.stats.size - 1))
      expect(s.matchups!.reduce((n, m) => n + m.games, 0)).toBeLessThanOrEqual(s.games)
      for (const m of s.matchups!) {
        const back = r.stats.get(m.op)!.matchups!.find((x) => x.op === k)
        if (back) expect([back.games, back.wins]).toEqual([m.games, m.games - m.wins])
      }
    }
  })
  it('matches an independent recount on the fixture tournaments', () => {
    const fxs = matchFixture as unknown as TournamentData[]
    const now = Date.parse('2026-11-02T12:00:00Z')
    const r = windowStats(fxs, now, 7)
    let n = 0
    const wins = new Map<string, number>(), games = new Map<string, number>()
    for (const { standings, pairings } of fxs) {
      const d = new Map(standings.map((s) => [s.player!, s.deck?.name ?? '']))
      for (const m of pairings!) {
        if (!m.player2 || typeof m.winner !== 'string') continue
        const a = d.get(m.player1!), b = d.get(m.player2)
        if (!a || !b || a === b) continue
        n++
        const w = m.winner === m.player1 ? a : b, l = w === a ? b : a
        wins.set(w, (wins.get(w) ?? 0) + 1); games.set(w, (games.get(w) ?? 0) + 1); games.set(l, (games.get(l) ?? 0) + 1)
      }
    }
    expect(n).toBeGreaterThan(100)
    expect(r.window.matches).toBe(n)
    for (const [k, s] of r.stats) { expect(s.games).toBe(games.get(k) ?? 0); expect(s.wins).toBe(wins.get(k) ?? 0); expect(s.score).toBeGreaterThanOrEqual(0); expect(s.score).toBeLessThanOrEqual(100) }
    expect(r.window.players).toBe(fxs.reduce((a, t) => a + t.standings.filter((s) => s.deck?.id).length, 0))
  })
  it('computes a file with windows, sorted decks and a 24 h score change', () => {
    const fxs = matchFixture as unknown as TournamentData[]
    const now = Date.parse('2026-11-02T12:00:00Z')
    const m = computeMeta(fxs, cards, now)
    expect(m.version).toBe(2)
    const scores = m.decks.map((d) => d.stats['7d']?.score ?? -1)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    expect(m.decks.every((d) => d.stats['7d']?.delta === undefined)).toBe(true)
    const prev: MetaFile = { ...m, generatedAt: new Date(now - 86400000).toISOString(), decks: m.decks.map((d) => ({ ...d, stats: { '7d': { ...d.stats['7d']!, score: d.stats['7d']!.score - 2 } } })) }
    const m2 = computeMeta(fxs, cards, now, prev)
    expect(m2.decks[0].stats['7d']!.delta).toBeCloseTo(2, 1)
    const names = new Set(m.decks.map((d) => d.name)) // every matchup opponent has its deck entry (name, icons)
    for (const d of m.decks) for (const mu of d.stats['7d']?.matchups ?? []) expect(names.has(mu.op)).toBe(true)
  })
  it('windows exclude old tournaments', () => {
    const m = computeMeta(data, cards, Date.parse('2026-11-10T12:00:00Z'))
    expect(m.windows['3d'].players).toBe(0)
    expect(m.windows['14d'].players).toBe(fx.standings.length)
    expect(m.decks.every((d) => !d.stats['3d'])).toBe(true)
  })
  it('builds a 20-card consensus with ids <set>-<number>', () => {
    // Give the fixture usernames and 120 decided matches so that Suicune Baxcalibur reaches a numbered tier.
    const standings = fx.standings.map((s, i) => ({ ...s, player: 'p' + i }))
    const mine = standings.filter((s) => s.deck?.id === 'suicune-ex-a4a-baxcalibur-b2a')
    const others = standings.filter((s) => s.deck?.id && s.deck.id !== 'suicune-ex-a4a-baxcalibur-b2a')
    const pairings = Array.from({ length: 120 }, (_, k) => ({ winner: mine[k % mine.length].player!, player1: mine[k % mine.length].player!, player2: others[k % others.length].player! }))
    const m = computeMeta([{ tournament: fx.tournament, standings, pairings }], cards, NOW)
    const top = m.decks.find((d) => d.id === 'suicune-ex-a4a-baxcalibur-b2a')!
    expect(top.stats['7d']!.tier).not.toBeNull()
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
  it('selects finished, non-custom tournaments of any size', () => {
    const t = (id: string, date: string, players: number, format: string | null = null, name = 'Weekly') => ({ id, date, players, format, name })
    const r = selectTournaments([t('a', '2026-11-04T10:00:00Z', 50), t('b', '2026-11-03T10:00:00Z', 6), t('c', '2026-11-03T10:00:00Z', 50, 'CUSTOM'), t('d', '2026-11-03T10:00:00Z', 50), t('e', '2026-10-01T10:00:00Z', 50), t('f', '2026-11-03T10:00:00Z', 50, null, 'Custom rules cup')], NOW, { days: 7 })
    expect(r.map((x) => x.id)).toEqual(['b', 'd'])
  })
  it('rejects tournaments with banned cards or custom format in their details', () => {
    expect(isStandardRules({ format: null, bannedCards: [] })).toBe(true)
    expect(isStandardRules({ format: null, bannedCards: [{ name: 'Hydreigon' }] })).toBe(false)
    expect(isStandardRules({ format: 'CUSTOM' })).toBe(false)
    expect(isStandardRules(null)).toBe(true)
  })
})
