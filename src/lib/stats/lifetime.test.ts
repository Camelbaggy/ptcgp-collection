import { describe, expect, it } from 'vitest'
import type { Booster, Card, CardSet, HistoryEvent, PackSlotRates } from '../types'
import { computeLifetime, journalCoverage, pzPackToBoosterId } from './lifetime'
import { luckSummary, onlyPacks, packTypesFor } from './packs'
import { correctionDays, gainsBySource, newCardEvents } from './detail'
import { duplicateStock } from './collection'
import type { PzStats } from '../pzProfile/types'

const sets: CardSet[] = ['A1', 'A1a', 'A2', 'A2a', 'A2b', 'B1', 'P-A', 'SP1'].map((id, i) => ({ id, name: id, order: i + 1 }))
const boosters: Booster[] = [
  { id: 'A1-Dracaufeu', setId: 'A1', name: 'Dracaufeu' }, { id: 'A1-Mewtwo', setId: 'A1', name: 'Mewtwo' }, { id: 'A1-Pikachu', setId: 'A1', name: 'Pikachu' },
  { id: 'A2b-Unique', setId: 'A2b', name: 'Unique' }, { id: 'B1-Altaria', setId: 'B1', name: 'Altaria' }, { id: 'B1-Braségali', setId: 'B1', name: 'Braségali' },
  { id: 'SP1-Unique', setId: 'SP1', name: 'Unique' },
]

describe('pzPackToBoosterId', () => {
  it('rang dans la série + mascotte', () => {
    expect(pzPackToBoosterId('PACK_ICON_AN001_0020_00_000', 'Genetic Apex: Charizard', sets, boosters)).toBe('A1-Dracaufeu')
    expect(pzPackToBoosterId('PACK_ICON_AN001_0030_00_000', 'Genetic Apex: Pikachu', sets, boosters)).toBe('A1-Pikachu')
    expect(pzPackToBoosterId('PACK_ICON_AN005_0010_00_000', 'Shining Revelry', sets, boosters)).toBe('A2b-Unique')
    expect(pzPackToBoosterId('PACK_ICON_BN001_0010_00_000', 'Mega Rising: Mega Blaziken', sets, boosters)).toBe('B1-Braségali')
    expect(pzPackToBoosterId('PACK_ICON_BN001_0030_00_000', 'Mega Rising: Mega Altaria', sets, boosters)).toBe('B1-Altaria')
    expect(pzPackToBoosterId('PACK_ICON_SP001_0010_00_000', 'Special Pack', sets, boosters)).toBe('SP1-Unique')
    expect(pzPackToBoosterId('PACK_ICON_ZZ', 'x', sets, boosters)).toBeNull()
  })
})

const card = (id: string, rarity: Card['rarity']): Card => ({ id, setId: id.split('-')[0], number: 1, name: id, rarity, boosterIds: [] })
const cards = [card('A1-1', 'D1'), card('A1-2', 'E1'), card('A2b-1', 'S1')]
const cardById = new Map(cards.map((c) => [c.id, c]))
const pk = (id: string, date: string, boosterId: string, cardIds: string[]): HistoryEvent => ({ id, kind: 'pack', date, boosterId, cardIds })

describe('computeLifetime', () => {
  const stats: PzStats = {
    asOf: '2026-11-06',
    counters: [{ key: 'packs-opened', label: 'Packs opened', value: 100 }, { key: 'cards-obtained', label: 'Cards obtained', value: 520 }, { key: 'days-played', label: 'Days played', value: 50 }],
    battles: [],
    packsBySet: [{ setCode: 'A1', name: 'Genetic Apex', packs: 60, cards: 300, unique: 2 }, { setCode: 'A2b', name: 'Shining Revelry', packs: 40, cards: 200, unique: 1 }],
    packsByPack: [{ packIcon: 'PACK_ICON_AN001_0010_00_000', name: 'Genetic Apex: Mewtwo', packs: 60 }, { packIcon: 'PACK_ICON_AN005_0010_00_000', name: 'Shining Revelry', packs: 40 }],
    byRarity: [{ label: 'Art Rare', code: 'AR', rarity: 'E1', value: 10, unique: 1 }, { label: 'Super Rare', code: 'SR', rarity: 'E2', value: 3, unique: 2 }, { label: 'SAR', code: 'SAR', rarity: 'E2', value: 2, unique: 1 }],
    byType: [{ label: 'Grass', value: 5 }], trainers: [{ label: 'Item', value: 3 }], special: [],
  }
  const history = [pk('old', '2026-11-01T10:00', 'A1-Mewtwo', ['A1-1', 'A1-1', 'A1-1', 'A1-1', 'A1-2']), pk('new', '2026-11-08T10:00', 'A1-Mewtwo', ['A1-1', 'A1-1', 'A1-1', 'A1-1', 'A1-2']), pk('one', '2026-11-08T11:00', 'A1-Mewtwo', ['A1-2'])]
  const l = computeLifetime({ fetchedAt: '2026-11-06T12:00:00Z', stats, history, cards, cardById, sets, boosters })
  it('prolonge la photo par les packs complets saisis après l’import', () => {
    expect(l.packs).toBe(101)
    expect(l.cards).toBe(525)
    expect(l.addedPacks).toBe(1)
    expect(l.bySet[0]).toMatchObject({ setId: 'A1', packs: 61, added: 1, total: 2 })
    expect(l.byBooster[0]).toMatchObject({ boosterId: 'A1-Mewtwo', packs: 61, added: 1 })
  })
  it('fusionne SR et SAR en ☆☆ et traduit les libellés', () => {
    expect(l.byRarity.find((r) => r.rarity === 'E2')).toMatchObject({ value: 5, unique: 3 })
    expect(l.byRarity.find((r) => r.rarity === 'E1')).toMatchObject({ value: 11, added: 1 })
    expect(l.byType[0].label).toBe('Plante')
    expect(l.trainers[0].label).toBe('Objet')
    expect(l.counters.find((c) => c.key === 'days-played')?.labelFr).toBe('Jours de jeu')
  })
  it('couverture du journal', () => {
    expect(journalCoverage(history)).toEqual({ since: '2026-11-01', packs: 2 })
  })
})

describe('chance par type de pack', () => {
  const slot = (rates: Partial<Record<Card['rarity'], number>>) => ({ slot: 1, rates })
  const rates: PackSlotRates[] = [
    { boosterId: 'A1-Mewtwo', packType: 'normal', packTypeRate: 95, slots: [slot({ D1: 100 }), slot({ D1: 100 }), slot({ D1: 100 }), slot({ D1: 90, E1: 10 }), slot({ D1: 90, E1: 10 })] },
    { boosterId: 'A1-Mewtwo', packType: 'plus1', packTypeRate: 5, slots: [slot({ D1: 100 }), slot({ D1: 100 }), slot({ D1: 100 }), slot({ D1: 90, E1: 10 }), slot({ D1: 90, E1: 10 }), slot({ E1: 100 })] },
  ]
  it('attendu moyen sur tous les types ; un pack trop court est écarté', () => {
    const six = onlyPacks([pk('a', '2026-11-01T10:00', 'A1-Mewtwo', ['A1-1', 'A1-1', 'A1-1', 'A1-1', 'A1-1', 'A1-2'])])
    expect(packTypesFor(six[0], rates)?.map((r) => r.packType)).toEqual(['normal', 'plus1'])
    const l = luckSummary(six, cardById, rates, ['E1'])
    expect(l.rows[0].expected).toBeCloseTo(0.25)
    const four = onlyPacks([pk('b', '2026-11-01T10:00', 'A1-Mewtwo', ['A1-1', 'A1-1', 'A1-1', 'A1-1'])])
    expect(luckSummary(four, cardById, rates, ['E1'])).toMatchObject({ packs: 0, skipped: 1 })
  })
})

describe('gains par origine', () => {
  it('sépare packs et imports', () => {
    const h: HistoryEvent[] = [
      pk('a', '2026-11-01T10:00', 'A1-Mewtwo', ['A1-1', 'A1-1', 'A1-1', 'A1-1']),
      { id: 'c', kind: 'correction', date: '2026-11-02T10:00', changes: [{ cardId: 'A1-2', from: 0, to: 2 }, { cardId: 'A2b-1', from: 0, to: 1 }] },
    ]
    const owned = new Map([['A1-1', 4], ['A1-2', 2], ['A2b-1', 1]])
    expect(gainsBySource(newCardEvents(owned, h))).toEqual({ pack: 1, trade: 0, share: 0, correction: 2, total: 3 })
    expect(correctionDays(h, '2026-11-02')).toEqual(['2026-11-02'])
  })
})

describe('doubles : mêmes règles que l’accueil', () => {
  it('D1 gardées par 2, E1 par 1, rareté complète exclue de l’échange', () => {
    const cs = [card('A1-1', 'D1'), card('A1-3', 'D1'), card('A1-2', 'E1'), card('A1-4', 'E1')]
    const owned = new Map([['A1-1', 4], ['A1-3', 2], ['A1-2', 3]])
    const s = duplicateStock(cs, owned)
    // D1 complète (toutes possédées) : plus échangeable, mais toujours partageable à partir du 3e exemplaire.
    expect(s.find((x) => x.rarity === 'D1')).toMatchObject({ spare: 4, tradeable: 0, shareable: 2, shareCards: 1 })
    expect(s.find((x) => x.rarity === 'E1')).toMatchObject({ spare: 2, tradeable: 2, tradeCards: 1 })
  })
})
