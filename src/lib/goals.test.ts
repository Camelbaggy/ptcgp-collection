import { describe, expect, it } from 'vitest'
import type { Card, PackSlotRates, Rarity } from './types'
import { collectorStats, estimateGoal, goalCards, goalProgress, packsPerDay, type Goal } from './goals'

const card = (id: string, rarity: Rarity, boosterIds: string[] = ['A1-X']): Card =>
  ({ id, setId: id.split('-')[0], number: Number(id.split('-')[1]), name: id, nameEn: id, type: 'Grass', rarity, boosterIds } as Card)
const goal = (g: Partial<Goal>): Goal => ({ id: 'g', rarities: [], copies: 1, createdAt: '2026-11-12', ...g })

// Un booster : un seul emplacement qui donne toujours une D1, parmi 2 cartes D1.
const rates: PackSlotRates[] = [{ boosterId: 'A1-X', packType: 'normal', packTypeRate: 100, slots: [{ slot: 1, rates: { D1: 100 } }] }]

describe('objectifs', () => {
  const cards = [card('A1-1', 'D1'), card('A1-2', 'D1'), card('A1-3', 'E1'), card('B1-1', 'D1', ['B1-Y'])]

  it('filtre par extension et rareté', () => {
    expect(goalCards(goal({ setId: 'A1', rarities: ['D1'] }), cards).map((c) => c.id)).toEqual(['A1-1', 'A1-2'])
    expect(goalCards(goal({}), cards)).toHaveLength(4)
    expect(goalCards(goal({ boosterId: 'B1-Y' }), cards).map((c) => c.id)).toEqual(['B1-1'])
  })

  it('progression : 1 ou 2 exemplaires', () => {
    const owned = new Map([['A1-1', 1], ['A1-2', 3]])
    const p1 = goalProgress(goal({ setId: 'A1', rarities: ['D1'] }), cards, owned)
    expect(p1).toMatchObject({ total: 2, done: 2, pct: 1, missingCopies: 0 })
    const p2 = goalProgress(goal({ setId: 'A1', rarities: ['D1'], copies: 2 }), cards, owned)
    expect(p2.done).toBe(1)
    expect(p2.missing).toEqual([{ card: cards[0], need: 1 }])
  })

  it('collectionneur : une carte = loi géométrique, deux cartes indépendantes à 1/2 = 8/3', () => {
    expect(collectorStats([0.25]).mean).toBeCloseTo(4, 3)
    expect(collectorStats([0.5, 0.5]).mean).toBeCloseTo(8 / 3, 3)
    expect(collectorStats([]).mean).toBe(0)
  })

  it('estimation : 2 D1 équiprobables, tirage unique par pack ⇒ 3 packs', () => {
    const p = goalProgress(goal({ setId: 'A1', rarities: ['D1'] }), cards, new Map())
    const e = estimateGoal(p.missing, cards, rates)
    // chaque carte : 1/2 par pack ; les deux ne sont pas indépendantes mais l'approximation reste proche
    expect(e.mean).toBeGreaterThan(2.5)
    expect(e.mean).toBeLessThan(3.5)
    expect(e.p90).toBeGreaterThan(e.mean)
    expect(e.byBooster).toHaveLength(1)
    expect(e.unreachable).toEqual([])
  })

  it('estimation : cartes sans booster ou sans taux écartées', () => {
    const lonely = card('A1-9', 'D1', [])
    const noRate = card('B1-1', 'D1', ['B1-Y'])
    const e = estimateGoal([{ card: lonely, need: 1 }, { card: noRate, need: 1 }], [lonely, noRate], rates)
    expect(e.mean).toBe(0)
    expect(e.unreachable).toHaveLength(2)
  })

  it('rythme : packs par jour sur 30 jours', () => {
    expect(packsPerDay(['2026-11-10', '2026-11-12', '2026-09-01'], '2026-11-12')).toBeCloseTo(2 / 30)
  })
})
