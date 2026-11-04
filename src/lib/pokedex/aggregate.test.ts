import { describe, expect, it } from 'vitest'
import { buildDexRows, summarize } from './aggregate'
import type { DexEntry } from './types'
import type { Card } from '../types'

const E = (dex: number, formId: number, nameEn: string, formKind: DexEntry['formKind'], label?: string): DexEntry =>
  ({ dex, formId, gen: 1, nameFr: nameEn, nameEn, formKind, types: [1], ...(label ? { formLabelEn: label } : {}) })
const entries = [
  E(3, 3, 'Venusaur', 'base'), E(3, 10033, 'Venusaur', 'mega', 'Mega'),
  E(6, 6, 'Charizard', 'base'), E(6, 10034, 'Charizard', 'mega', 'Mega X'), E(6, 10035, 'Charizard', 'mega', 'Mega Y'),
  E(25, 25, 'Pikachu', 'base'),
]
const C = (id: string, nameEn: string, rarity: Card['rarity'], extra: Partial<Card> & { entityKind?: string } = {}): Card =>
  ({ id, setId: id.split('-')[0], number: 1, name: nameEn, nameEn, rarity, boosterIds: [], ...extra }) as Card

const cards = [
  C('A1-3', 'Venusaur', 'D3'), C('A1-4', 'Venusaur ex', 'D4'), C('A1a-9', 'Mega Venusaur ex', 'E2'),
  C('A1-6', 'Mega Charizard X ex', 'D4'), C('A1-7', 'Mega Charizard Y ex', 'D4'), C('A1-8', 'Charizard', 'D3'),
  C('A1-100', 'Potion', 'D1', { entityKind: 'TR' }),
  C('A1-200', 'Pikachu', 'D1'), C('A1-201', 'Pikachu', 'E1'),
  C('A1-300', 'Inconnu', 'D1'),
]

describe('buildDexRows', () => {
  const owned = new Map([['A1-3', 2], ['A1-6', 1], ['A1-201', 1]])
  const { rows, unmatched } = buildDexRows(entries, cards, owned)
  const row = (formId: number) => rows.find((r) => r.entry.formId === formId)!
  it('répartit les cartes par forme', () => {
    expect(row(3).total).toBe(2)
    expect(row(10033).total).toBe(1)
    expect(row(10034).cards.map((c) => c.id)).toEqual(['A1-6'])
    expect(row(10035).cards.map((c) => c.id)).toEqual(['A1-7'])
    expect(row(6).total).toBe(1)
  })
  it('compte par rareté et possédées (cartes différentes)', () => {
    expect(row(3).byRarity).toEqual({ D3: { total: 1, owned: 1 }, D4: { total: 1, owned: 0 } })
    expect(row(3).owned).toBe(1)
    expect(row(25).rarityKinds).toBe(2)
    expect(row(25).owned).toBe(1)
  })
  it('exclut les Dresseurs, signale les non reconnues', () => {
    expect(rows.flatMap((r) => r.cards).some((c) => c.id === 'A1-100')).toBe(false)
    expect(unmatched.map((c) => c.id)).toEqual(['A1-300'])
  })
  it('résume comme la ligne 1 du Sheet', () => {
    const s = summarize(rows)
    expect(s).toMatchObject({ entries: 6, withCards: 6, withOwned: 3, totalCards: 8, ownedCards: 3 })
    expect(s.byRarity.D4).toEqual({ total: 3, owned: 1 })
    expect(s.byRarity.D1).toEqual({ total: 1, owned: 0 })
  })
})
