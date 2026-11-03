import { describe, expect, it } from 'vitest'
import {
  cardId, fetchPublicSet, fetchSetFromDataset, fromPublicDataset, frenchNamesFromTcgdex, importFromText, mapPublicRarity,
  parseCardList, parseRarityToken, toSetId, type PublicCard, type PublicSet,
} from './index'

const setA1: PublicSet = {
  code: 'A1', releaseDate: '2024-10-30', count: 4,
  name: { en: 'Genetic Apex', fr: 'Puissance Génétique' }, packs: ['Charizard', 'Mewtwo', 'Pikachu'],
}
const cards: PublicCard[] = [
  { set: 'A1', number: 1, name: 'Bulbasaur', rarity: 'C', packs: ['Mewtwo'], element: 'grass', type: 'pokemon', stage: 'basic' },
  { set: 'A1', number: 3, name: 'Venusaur ex', rarity: 'RR', packs: ['Mewtwo'], element: 'grass', stage: 2 },
  { set: 'A1', number: 200, name: 'Potion', rarity: 'U', type: 'item' },
  { set: 'A1', number: 283, name: 'Mew', rarity: 'IM', packs: ['Charizard', 'Mewtwo', 'Pikachu'] },
  { set: 'B1', number: 1, name: 'Other', rarity: 'C' },
]

describe('rarity', () => {
  it('maps public codes', () => {
    expect(mapPublicRarity('C')).toBe('D1')
    expect(mapPublicRarity('RR')).toBe('D4')
    expect(mapPublicRarity('UR')).toBe('C1')
    expect(mapPublicRarity('SSR')).toBe('S2')
    expect(mapPublicRarity('???')).toBe('P')
  })
  it('parses symbols and words', () => {
    expect(parseRarityToken('◊◊◊')).toBe('D3')
    expect(parseRarityToken('♦♦♦♦')).toBe('D4')
    expect(parseRarityToken('☆')).toBe('E1')
    expect(parseRarityToken('★★★')).toBe('E3')
    expect(parseRarityToken('👑')).toBe('C1')
    expect(parseRarityToken('Crown')).toBe('C1')
    expect(parseRarityToken('2 stars')).toBe('E2')
    expect(parseRarityToken('3 diamonds')).toBe('D3')
    expect(parseRarityToken('E2')).toBe('E2')
    expect(parseRarityToken('Bulbasaur')).toBeNull()
  })
})

describe('public source', () => {
  it('converts a set', () => {
    const r = fromPublicDataset(setA1, cards, { allSets: [setA1] })
    expect(r.set).toMatchObject({ id: 'A1', name: 'Puissance Génétique', nameEn: 'Genetic Apex', order: 1 })
    expect(r.boosters.map((b) => b.id)).toEqual(['A1-Charizard', 'A1-Mewtwo', 'A1-Pikachu'])
    expect(r.cards).toHaveLength(4)
    expect(r.cards[0]).toMatchObject({ id: 'A1-1', rarity: 'D1', type: 'Grass', stage: 'Basic', boosterIds: ['A1-Mewtwo'], image: 'cards/A1/A1-1.webp' })
    expect(r.cards[1]).toMatchObject({ id: 'A1-3', rarity: 'D4', stage: 'Stage2' })
    expect(r.cards[2].boosterIds).toHaveLength(3) // no pack info -> all boosters
    expect(r.cards[3].rarity).toBe('E3')
  })
  it('uses French names and promo ids', () => {
    const r = fromPublicDataset(setA1, cards, { frenchNames: frenchNamesFromTcgdex({ cards: [{ localId: '001', name: 'Bulbizarre' }] }) })
    expect(r.cards[0]).toMatchObject({ name: 'Bulbizarre', nameEn: 'Bulbasaur' })
    expect(toSetId('PROMO-A')).toBe('P-A')
    const p = fromPublicDataset(
      { code: 'PROMO-A', name: { en: 'Promo A', fr: 'Promo-A' }, packs: ['Vol. 1'] },
      [{ set: 'PROMO-A', number: 5, name: 'Pikachu', rarity: 'R' }],
    )
    expect(p.cards[0]).toMatchObject({ id: 'P-A-5', rarity: 'P', boosterIds: [] })
    expect(cardId('A4b', 12)).toBe('A4b-12')
  })
  it('keeps negative numbers and treats SP sets as promo-like', () => {
    const r = fromPublicDataset(
      { code: 'SP1', name: { en: 'SP' }, packs: ['X'] },
      [{ set: 'SP1', number: 1, name: 'A', rarity: 'AR' }, { set: 'SP1', number: -1, name: 'Mew', rarity: 'AN' }],
    )
    expect(r.cards.map((c) => c.id)).toEqual(['SP1--1', 'SP1-1'])
    expect(r.cards.every((c) => c.rarity === 'P' && c.boosterIds.length === 0)).toBe(true)
  })
  it('merges reprints into existing cards', () => {
    const a1: PublicSet = { code: 'A1', releaseDate: '2024-10-30', name: { en: 'A1' }, packs: ['Mewtwo'] }
    const dx: PublicSet = { code: 'A4b', releaseDate: '2025-09-30', name: { en: 'Deluxe' }, packs: ['Deluxe'] }
    const all: PublicCard[] = [
      { set: 'A1', number: 1, name: 'Bulbasaur', rarity: 'C', image: 'x_00.webp', packs: ['Mewtwo'] },
      { set: 'A4b', number: 1, name: 'Bulbasaur', rarity: 'C', image: 'x_00.webp', packs: ['Deluxe'] },
      { set: 'A4b', number: 2, name: 'Bulbasaur', rarity: 'C', image: 'x_01.webp', packs: ['Deluxe'] },
    ]
    const existing = fromPublicDataset(a1, all, { allSets: [a1, dx] }).cards
    const r = fromPublicDataset(dx, all, { allSets: [a1, dx], allCards: all, existingCards: existing })
    expect(r.cards.map((c) => c.id)).toEqual(['A4b-2'])
    expect(r.updatedCards).toHaveLength(1)
    expect(r.updatedCards![0]).toMatchObject({ id: 'A1-1', boosterIds: ['A1-Mewtwo', 'A4b-Deluxe'] })
    // without existing cards: everything is created
    expect(fromPublicDataset(dx, all, { allSets: [a1, dx] }).cards).toHaveLength(2)
  })
  it('fetches via injected fetch', async () => {
    const fetchImpl = (async (url: string) => {
      const body = url.endsWith('sets.json') ? { A: [setA1] } : url.endsWith('cards.extra.json') ? cards : { cards: [{ localId: '001', name: 'Bulbizarre' }] }
      return { ok: true, status: 200, json: async () => body }
    }) as unknown as typeof fetch
    const r = await fetchPublicSet('pokemon-tcg-pocket-database', 'A1', { fetchImpl })
    expect(r.cards[0].name).toBe('Bulbizarre')
    expect((await fetchPublicSet('A1', { fetchImpl })).cards).toHaveLength(4)
    await expect(fetchSetFromDataset('ZZ', { fetchImpl })).rejects.toThrow()
  })
})

describe('text list', () => {
  it('parses varied formats', () => {
    const txt = [
      '1 Bulbasaur ◊', '#002 Ivysaur ◊◊', 'A1-3 Venusaur ex ◊◊◊◊', '4. Salamèche (1 star)',
      '5\tPikachu\t☆☆', '6, Mew, crown', 'Bulbizarre 007/226 ◊', '8 - Dracaufeu ex ★★', 'blabla',
    ].join('\n')
    const r = parseCardList(txt)
    expect(r.entries.map((e) => [e.number, e.name, e.rarity])).toEqual([
      [1, 'Bulbasaur', 'D1'], [2, 'Ivysaur', 'D2'], [3, 'Venusaur ex', 'D4'], [4, 'Salamèche', 'E1'],
      [5, 'Pikachu', 'E2'], [6, 'Mew', 'C1'], [7, 'Bulbizarre', 'D1'], [8, 'Dracaufeu ex', 'E2'],
    ])
    expect(r.warnings).toHaveLength(1)
  })
  it('numbers plain name lists, sections and rarity headers', () => {
    const r = importFromText('## Mewtwo\n◊\nA\nB\n☆\nC\n## Pikachu\n◊◊\nD', { setId: 'Z9', name: 'Zed', order: 30 })
    expect(r.boosters.map((b) => b.id)).toEqual(['Z9-Mewtwo', 'Z9-Pikachu'])
    expect(r.cards.map((c) => [c.id, c.rarity, c.boosterIds[0]])).toEqual([
      ['Z9-1', 'D1', 'Z9-Mewtwo'], ['Z9-2', 'D1', 'Z9-Mewtwo'], ['Z9-3', 'E1', 'Z9-Mewtwo'], ['Z9-4', 'D2', 'Z9-Pikachu'],
    ])
  })
  it('defaults and duplicates', () => {
    const r = importFromText('1 A ◊\n1 B ◊\n2 C', { setId: 'Z9', name: 'Zed', order: 1 })
    expect(r.cards.map((c) => c.id)).toEqual(['Z9-1', 'Z9-2'])
    expect(r.cards[1].rarity).toBe('D1')
    expect(r.boosters).toHaveLength(1)
    expect(r.warnings).toHaveLength(2)
  })
})
