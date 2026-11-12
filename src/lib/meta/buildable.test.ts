import { describe, expect, it } from 'vitest'
import type { Card, PackSlotRates } from '../types'
import { buildContext, deckBuild } from './buildable'

const mk = (id: string, nameEn: string, boosterIds: string[], rarity: Card['rarity'] = 'D1'): Card =>
  ({ id, setId: 'A1', number: 1, name: nameEn, nameEn, type: 'Eau', stage: 'Base', rarity, boosterIds }) as Card
const rates: PackSlotRates[] = [{ boosterId: 'A1-X', packType: 'normal', packTypeRate: 100, slots: [{ slot: 1, rates: { D1: 100 } }] }]

describe('deckBuild', () => {
  const cards = [mk('A1-1', 'Alpha', ['A1-X']), mk('A1-2', 'Alpha', ['A1-X']), mk('A1-3', 'Beta', ['A1-X']), mk('P-1', 'Promo', [])]
  it('compte par nom, toutes impressions confondues', () => {
    const ctx = buildContext(cards, new Map([['A1-1', 1], ['A1-2', 1]]), rates)
    const b = deckBuild([{ cardId: 'A1-1', count: 2, inclusion: 1 }, { cardId: 'A1-3', count: 2, inclusion: 1 }], ctx)
    expect(b.missing).toBe(2)
    expect(b.cards.map((c) => c.card.id)).toEqual(['A1-3'])
    expect(b.booster?.boosterId).toBe('A1-X')
    expect(b.booster?.p).toBeCloseTo(1 / 3)
  })
  it('deck complet', () => {
    const ctx = buildContext(cards, new Map([['A1-1', 2]]), rates)
    const b = deckBuild([{ cardId: 'A1-1', count: 2, inclusion: 1 }], ctx)
    expect(b.missing).toBe(0)
    expect(b.booster).toBeUndefined()
  })
  it('carte hors booster : manquante mais pas obtenable', () => {
    const ctx = buildContext(cards, new Map(), rates)
    const b = deckBuild([{ cardId: 'P-1', count: 1, inclusion: 1 }], ctx)
    expect(b.cards[0].obtainable).toBe(false)
    expect(b.booster).toBeUndefined()
  })
})
