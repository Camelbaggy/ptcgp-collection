import { describe, expect, it } from 'vitest'
import { sortDexRows } from './sort'
import type { DexRow } from './aggregate'

const R = (dex: number, formId: number, nameFr: string, total: number, owned: number, kinds = 1, gen = 1): DexRow =>
  ({ entry: { dex, formId, gen, nameFr, nameEn: nameFr, formKind: formId > 10000 ? 'mega' : 'base', types: [1] }, cards: [], total, owned, byRarity: {}, rarityKinds: kinds })
const rows = [
  R(6, 10034, 'Dracaufeu', 2, 2, 2), R(25, 25, 'Pikachu', 4, 1, 3, 1), R(3, 3, 'Florizarre', 2, 0, 1),
  R(6, 6, 'Dracaufeu', 2, 1, 2), R(152, 152, 'Émolga', 0, 0, 0, 2),
]
const ids = (l: DexRow[]) => l.map((r) => r.entry.formId)

describe('sortDexRows', () => {
  it('n° Pokédex : formes juste après leur espèce', () => {
    expect(ids(sortDexRows(rows, 'dex'))).toEqual([3, 6, 10034, 25, 152])
    expect(ids(sortDexRows(rows, 'dex', 'desc'))).toEqual([152, 25, 10034, 6, 3])
  })
  it('nom FR (accents) puis n°', () => {
    expect(ids(sortDexRows(rows, 'name'))).toEqual([6, 10034, 152, 3, 25])
  })
  it('compteurs décroissants par défaut, égalités par n°', () => {
    expect(ids(sortDexRows(rows, 'total'))).toEqual([25, 3, 6, 10034, 152])
    expect(ids(sortDexRows(rows, 'total', 'asc'))).toEqual([152, 3, 6, 10034, 25])
    expect(ids(sortDexRows(rows, 'owned'))).toEqual([10034, 6, 25, 3, 152])
    expect(ids(sortDexRows(rows, 'missing'))).toEqual([25, 3, 6, 10034, 152])
  })
  it('% de complétion', () => {
    expect(ids(sortDexRows(rows, 'pct'))).toEqual([10034, 6, 25, 3, 152])
  })
  it('raretés et génération', () => {
    expect(ids(sortDexRows(rows, 'rarities'))).toEqual([25, 6, 10034, 3, 152])
    expect(ids(sortDexRows(rows, 'gen'))).toEqual([3, 6, 10034, 25, 152])
  })
  it('ne modifie pas l\'entrée', () => {
    const copy = [...rows]
    sortDexRows(rows, 'name')
    expect(rows).toEqual(copy)
  })
})
