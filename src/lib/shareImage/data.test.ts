import { describe, expect, it } from 'vitest'
import { buildShareData, MAX_SETS } from './data'
import type { Card, CardSet } from '../types'

const set = (id: string, order: number): CardSet => ({ id, name: id, nameEn: id, releaseDate: '', order }) as CardSet
const card = (id: string, setId: string): Card => ({ id, setId, number: 1, name: id, nameEn: id, rarity: 'D1', boosterIds: [] }) as unknown as Card

describe('buildShareData', () => {
  it('totaux, extensions récentes d\'abord, extensions sans carte et promos ignorées', () => {
    const sets = [set('A1', 1), set('A2', 2), set('P', 3), set('P-A', 4)]
    const cards = [card('A1-1', 'A1'), card('A1-2', 'A1'), card('A2-1', 'A2'), card('P-A-1', 'P-A')]
    const owned = new Map([['A1-1', 2], ['A2-1', 1]])
    const d = buildShareData(sets, cards, owned, 42, new Date('2026-11-12T10:00:00Z'))
    expect(d.owned).toBe(2)
    expect(d.total).toBe(4)
    expect(d.pct).toBeCloseTo(2 / 4)
    expect(d.pct2).toBeCloseTo(1 / 4)
    expect(d.packs).toBe(42)
    expect(d.sets.map((s) => s.id)).toEqual(['A2', 'A1'])
    expect(d.sets[1].pct).toBe(0.5)
    expect(d.date).toContain('2026')
  })
  it('limite le nombre d\'extensions', () => {
    const sets = Array.from({ length: 20 }, (_, i) => set('S' + i, i))
    const cards = sets.map((s) => card(s.id + '-1', s.id))
    expect(buildShareData(sets, cards, new Map(), 0, new Date()).sets).toHaveLength(MAX_SETS)
  })
})
