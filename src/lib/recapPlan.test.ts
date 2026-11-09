import { describe, expect, it } from 'vitest'
import { buildPacks, countMismatches, isDoubtful, lastCounts, sortRecapBoosters } from './recapPlan'

describe('recapPlan', () => {
  it('trie les boosters par numéro, stable', () => {
    const r = sortRecapBoosters([{ index: 3, k: 'a' }, { index: 1, k: 'b' }, { index: 3, k: 'c' }, { index: 2, k: 'd' }])
    expect(r.map((b) => b.k)).toEqual(['b', 'd', 'a', 'c'])
  })
  it('construit un pack par booster coché, sans cartes ignorées', () => {
    const p = buildPacks([['A1-1', '', 'A1-2'], ['A1-3'], [''], ['A1-4']], [true, false, true, true], 'A1-X')
    expect(p).toEqual([{ boosterId: 'A1-X', cardIds: ['A1-1', 'A1-2'] }, { boosterId: 'A1-X', cardIds: ['A1-4'] }])
  })
  it('garde le dernier nombre lu par carte', () => {
    const m = lastCounts([['a', 'b'], ['a', 'c']], [[1, null], [2, 5]], [true, true])
    expect([...m]).toEqual([['a', 2], ['c', 5]])
    expect(lastCounts([['a'], ['a']], [[1], [2]], [true, false]).get('a')).toBe(1)
  })
  it('liste les écarts de quantité', () => {
    const r = countMismatches(new Map([['a', 2], ['b', 1], ['c', 3]]), new Map([['a', 2], ['b', 2]]))
    expect(r).toEqual([{ cardId: 'b', game: 1, local: 2 }, { cardId: 'c', game: 3, local: 0 }])
  })
  it('détecte les cartes douteuses', () => {
    const c = (name: string, dist: number) => ({ card: { name }, dist })
    expect(isDoubtful([], 0.12)).toBe(true)
    expect(isDoubtful([c('A', 0.2)], 0.12)).toBe(true)
    expect(isDoubtful([c('A', 0.05), c('B', 0.06)], 0.12)).toBe(true)
    expect(isDoubtful([c('A', 0.05), c('A', 0.06), c('B', 0.2)], 0.12)).toBe(false)
  })
})
