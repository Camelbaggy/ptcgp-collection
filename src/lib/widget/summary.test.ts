import { describe, expect, it } from 'vitest'
import { ownedMap } from '../calc'
import type { Booster, Card, PackSlotRates, Rarity } from '../types'
import { widgetKey, widgetSummary } from './summary'

const mk = (id: string, rarity: Rarity, boosterIds: string[]): Card => ({ id, setId: 'S', number: 0, name: id, rarity, boosterIds })
const cards: Card[] = [mk('a', 'D1', ['B1']), mk('b', 'D1', ['B1']), mk('c', 'D1', ['B2']), mk('d', 'D1', ['B2']), mk('p', 'P', ['PR'])]
const boosters: Booster[] = [
  { id: 'B1', setId: 'S', name: 'Un' }, { id: 'B2', setId: 'S', name: 'Deux' },
  { id: 'PR', setId: 'S', name: 'Promo', entryOnly: true },
]
const slot = (boosterId: string): PackSlotRates => ({ boosterId, packType: 'normal', packTypeRate: 100, slots: [{ slot: 1, rates: { D1: 100 } }] })
const rates = [slot('B1'), slot('B2'), slot('PR')]
const img = (id: string) => `https://x/${id}.webp`

describe('widgetSummary', () => {
  it('complétion et boosters triés comme l\'accueil, sans booster de saisie seule', () => {
    const s = widgetSummary(cards, boosters, rates, ownedMap([{ cardId: 'a', quantity: 2 }]), img)
    expect(s.owned).toBe(1)
    expect(s.total).toBe(5)
    expect(s.pct).toBeCloseTo(0.2)
    expect(s.pct2).toBeCloseTo(0.2)
    expect(s.boosters.map((b) => b.id)).toEqual(['B2', 'B1'])
    expect(s.boosters[0]).toMatchObject({ label: 'S · Deux', missing: 2, image: 'https://x/B2.webp' })
    expect(s.boosters[0].pNew).toBeGreaterThan(s.boosters[1].pNew)
  })
  it('booster complet : absent de la liste', () => {
    const s = widgetSummary(cards, boosters, rates, ownedMap([{ cardId: 'a', quantity: 1 }, { cardId: 'b', quantity: 1 }]), img)
    expect(s.boosters.map((b) => b.id)).toEqual(['B2'])
  })
  it('clé stable tant que l\'affichage ne change pas', () => {
    const o = ownedMap([{ cardId: 'a', quantity: 1 }])
    const k1 = widgetKey(widgetSummary(cards, boosters, rates, o, img))
    expect(widgetKey(widgetSummary(cards, boosters, rates, ownedMap([{ cardId: 'a', quantity: 1 }]), img))).toBe(k1)
    expect(widgetKey(widgetSummary(cards, boosters, rates, ownedMap([{ cardId: 'a', quantity: 1 }, { cardId: 'c', quantity: 1 }]), img))).not.toBe(k1)
  })
})
