import { describe, expect, it } from 'vitest'
import { searchCards, searchRank } from './search'
import type { Card } from './types'

const mk = (id: string, number: number, name: string, nameEn = ''): Card =>
  ({ id, setId: id.split('-')[0], number, name, nameEn, rarity: 'D1', boosterIds: [] }) as unknown as Card

const cards = [mk('A1-1', 1, 'Bulbizarre', 'Bulbasaur'), mk('A1-12', 12, 'Papilusion', 'Butterfree'), mk('B1-1', 1, 'Évoli', 'Eevee'), mk('A1-250', 250, 'Pikachu ex', 'Pikachu ex')]

describe('recherche globale', () => {
  it('ignore accents et casse', () => {
    expect(searchCards(cards, 'evoli').results.map((c) => c.id)).toEqual(['B1-1'])
  })
  it('trouve par identifiant, avec espace ou tiret', () => {
    expect(searchRank(cards[1], 'a1 12')).toBe(0)
    expect(searchCards(cards, 'A1-12').results[0].id).toBe('A1-12')
  })
  it('trouve par numéro exact avant les préfixes', () => {
    const ids = searchCards(cards, '1').results.map((c) => c.id)
    expect(ids.slice(0, 2)).toEqual(['A1-1', 'B1-1'])
    expect(ids).toContain('A1-12')
  })
  it('trouve par nom anglais et par mot interne', () => {
    expect(searchCards(cards, 'butter').results[0].id).toBe('A1-12')
    expect(searchCards(cards, 'ex').results[0].id).toBe('A1-250')
  })
  it('rien pour une requête vide ou sans résultat', () => {
    expect(searchCards(cards, '  ').total).toBe(0)
    expect(searchCards(cards, 'zzz').total).toBe(0)
  })
})
