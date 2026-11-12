import { describe, expect, it } from 'vitest'
import { buildCsv, csvField, inScope } from './exportCsv'
import type { Card } from './types'

const card = (id: string, name: string, extra: Partial<Card> = {}): Card =>
  ({ id, setId: id.split('-')[0], number: Number(id.split('-')[1]), name, rarity: 'D1', boosterIds: ['A1-Mewtwo'], ...extra }) as Card
const input = {
  cards: [card('A1-1', 'Bulbizarre'), card('A1-2', 'Herbi; "zarre"', { rarity: 'E1', nameEn: 'Ivysaur' }), card('A1-3', '=Evil')],
  sets: [{ id: 'A1', name: 'Puissance génétique', nameEn: '', releaseDate: '', order: 1 }],
  boosters: [{ id: 'A1-Mewtwo', setId: 'A1', name: 'Mewtwo' }],
  owned: new Map([['A1-1', 3], ['A1-2', 1]]),
  wishlist: [{ cardId: 'A1-3', priority: 1 }],
}

describe('export CSV', () => {
  it('échappe séparateur, guillemets et formules', () => {
    expect(csvField('a;b', ';')).toBe('"a;b"')
    expect(csvField('a;b', ',')).toBe('a;b')
    expect(csvField('dit "oui"', ';')).toBe('"dit ""oui"""')
    expect(csvField('=1+1', ';')).toBe("'=1+1")
    expect(csvField(-3, ';')).toBe('-3')
  })
  it('filtre par portée', () => {
    expect([0, 1, 2].map((q) => inScope('doubles', q))).toEqual([false, false, true])
    expect(buildCsv(input, 'owned').rows).toBe(2)
    expect(buildCsv(input, 'missing').rows).toBe(1)
    expect(buildCsv(input, 'doubles').rows).toBe(1)
    expect(buildCsv(input, 'all').rows).toBe(3)
  })
  it('produit une ligne par carte avec quantité et souhait', () => {
    const lines = buildCsv(input).csv.trimEnd().split('\r\n')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toBe('A1-1;Puissance génétique;1;Bulbizarre;;◆;D1;;;Mewtwo;3;')
    expect(lines[2]).toContain('"Herbi; ""zarre"""')
    expect(lines[3].endsWith(';0;1')).toBe(true)
  })
})

describe('export tableur (tabulations)', () => {
  it('sépare par tabulations sans doubler les tabulations internes', () => {
    expect(csvField('a\tb', '\t')).toBe('a b')
    expect(buildCsv(input, 'all', '\t').csv.split('\r\n')[1]).toContain('\tBulbizarre\t')
  })
})
