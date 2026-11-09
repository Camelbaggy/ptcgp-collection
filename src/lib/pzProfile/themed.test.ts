import { describe, expect, it } from 'vitest'
import type { Card } from '../types'
import { computeLiveThemed, resolvePzHref } from './themed'
import type { PzThemed, PzThemedCollection } from './types'

const card = (id: string, entityId: number): Card => {
  const i = id.lastIndexOf('-')
  return { id, setId: id.slice(0, i), number: Number(id.slice(i + 1)), name: id, nameEn: id, type: '', stage: '', rarity: 'D1', boosterIds: [], entityId, entityKind: 'PK' } as unknown as Card
}
const cards = [card('A1-1', 1), card('A1-2', 2), card('A1-3', 3)]
const img = (n: number) => `cPK_10_00000${n}_00_X_C.webp`
const col = (title: string, cs: [number, boolean][], extra: Partial<PzThemedCollection> = {}): PzThemedCollection => ({
  title, setCode: 'A1', completed: false, missing: 0, cardCount: cs.length, secret: false, rewards: [],
  cards: cs.map(([n, owned]) => ({ image: img(n), name: 'N' + n, owned })), ...extra,
})
const data: PzThemed = {
  completed: 5, total: 8, missingCards: 3,
  sections: [{ setCode: 'A1', name: 'Puissance génétique', completed: 5, total: 8 }],
  collections: [col('a', [[1, false], [2, false]]), col('b', [[2, false], [3, true]]), col('c', [], { completed: true })],
}

describe('computeLiveThemed', () => {
  it('compte les cartes manquantes distinctes', () => {
    const r = computeLiveThemed(data, cards, new Map())
    expect(r.incomplete).toBe(2)
    expect(r.cardsToFindCount).toBe(2)
    expect(r.completedNow).toBe(5)
  })
  it('une carte obtenue depuis l\'import compte, et une collection complétée devient terminée', () => {
    const r = computeLiveThemed(data, cards, new Map([['A1-1', 1], ['A1-2', 2]]))
    expect(r.doneSince).toBe(2)
    expect(r.completedNow).toBe(7)
    expect(r.incomplete).toBe(0)
    expect(r.cardsToFindCount).toBe(0)
    expect(r.sections[0].completedNow).toBe(7)
  })
  it('garde l\'état de la page pour une image inconnue', () => {
    const d: PzThemed = { ...data, collections: [col('x', [[9, false]])] }
    const r = computeLiveThemed(d, cards, new Map())
    expect(r.collections[0].cards[0].card).toBeNull()
    expect(r.cardsToFindCount).toBe(1)
    expect(r.cardsToFind).toHaveLength(0)
  })
  it('préfère le lien /cards/<set>/<n>/', () => {
    expect(resolvePzHref('/cards/a1/2/', cards)?.id).toBe('A1-2')
    expect(resolvePzHref('/cards/zz/2/', cards)).toBeNull()
    const d: PzThemed = { ...data, collections: [{ ...col('x', [[1, false]]), cards: [{ href: '/cards/a1/3/', image: img(1), name: 'n', owned: false }] }] }
    expect(computeLiveThemed(d, cards, new Map()).collections[0].cards[0].card?.id).toBe('A1-3')
  })
})
