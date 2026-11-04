import { describe, expect, it } from 'vitest'
import { decodeDeckCode, deckEnergies, encodeDeckCode } from './deckcode'

// Real in-game QR sent by the user.
const VECTOR = 'DZiWnpiWnpiYYJiYYJiWqJiWqJidTJiXopiZtJiX8pidJJiaXpicrAcAPFoAPFoAKKAAKKAAPEYAPEYAPGQBAw=='

describe('deckcode', () => {
  it('decodes the real vector', () => {
    const d = decodeDeckCode(VECTOR)
    expect(d.energies).toEqual([3])
    expect(d.entries.filter((e) => e.kind === 'TR')).toHaveLength(10)
    expect(d.entries.reduce((n, e) => n + e.count, 0)).toBe(20)
    expect(d.entries).toContainEqual({ kind: 'TR', entityId: 30, count: 2 })
    expect(d.entries).toContainEqual({ kind: 'TR', entityId: 480, count: 2 })
    expect(d.entries).toContainEqual({ kind: 'TR', entityId: 40, count: 2 })
    expect(d.entries.filter((e) => e.kind === 'PK')).toEqual([
      { kind: 'PK', entityId: 15450, count: 2 }, { kind: 'PK', entityId: 10400, count: 2 },
      { kind: 'PK', entityId: 15430, count: 2 }, { kind: 'PK', entityId: 15460, count: 1 },
    ])
  })

  it('round-trips byte for byte', () => {
    const d = decodeDeckCode(VECTOR)
    const cards = d.entries.map((e) => ({ id: `${e.kind}${e.entityId}`, entityId: e.entityId, entityKind: e.kind }))
    const again = encodeDeckCode({ cards: d.entries.map((e) => ({ cardId: `${e.kind}${e.entityId}`, count: e.count })), energies: d.energies }, cards)
    expect(again).toBe(VECTOR)
  })

  it('encodes trainers with the 10 000 000 offset, one entry per copy', () => {
    const b = Array.from(atob(encodeDeckCode(
      { cards: [{ cardId: 'a', count: 2 }, { cardId: 'b', count: 1 }], energies: [1, 2] },
      [{ id: 'a', entityId: 40, entityKind: 'TR' }, { id: 'b', entityId: 18340, entityKind: 'PK' }],
    )), (c) => c.charCodeAt(0))
    expect(b).toEqual([2, 0x98, 0x96, 0xa8, 0x98, 0x96, 0xa8, 1, 0, 0x47, 0xa4, 2, 1, 2])
  })

  it('refuses cards without entity id and truncated codes', () => {
    expect(() => encodeDeckCode({ cards: [{ cardId: 'x', count: 1 }], energies: [] }, [{ id: 'x' }])).toThrow()
    expect(() => decodeDeckCode('DZiW')).toThrow()
    expect(() => decodeDeckCode('***')).toThrow()
  })

  it('derives energies from pokémon types', () => {
    const cards = [
      { id: 'w', name: 'Suicune ex', nameEn: 'Suicune ex', type: 'Eau' },
      { id: 'w2', name: 'Frigibax', nameEn: 'Frigibax', type: 'Eau' },
      { id: 'm', name: 'Zeraora', nameEn: 'Zeraora', type: 'Électrique' },
      { id: 'c', name: 'Chatte', nameEn: 'Meowth', type: 'Incolore' },
      { id: 'o', name: 'Obs', nameEn: 'Obs', type: 'Obscurité' },
      { id: 't', name: 'Poké Ball', nameEn: 'Poké Ball', type: 'Objet' },
    ]
    expect(deckEnergies([{ cardId: 'w', count: 2 }, { cardId: 'w2', count: 2 }, { cardId: 'm', count: 3 }, { cardId: 't', count: 2 }], cards)).toEqual([3, 4])
    expect(deckEnergies([{ cardId: 'c', count: 2 }, { cardId: 'o', count: 1 }], cards)).toEqual([7])
    expect(deckEnergies([{ cardId: 'c', count: 2 }], cards)).toEqual([])
  })
})
