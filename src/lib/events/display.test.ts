import { describe, expect, it } from 'vitest'
import { edgeOn, groupMissions, shortEventName } from './display'

describe('shortEventName', () => {
  it('retire les préfixes de catégorie', () => {
    expect(shortEventName('Évènement drop : Réédition PROMO 2026')).toBe('Réédition PROMO 2026')
    expect(shortEventName('Évènement emblème : Fusion Double')).toBe('Fusion Double')
    expect(shortEventName('Missions : Fusion Double Rallye de combats')).toBe('Fusion Double Rallye de combats')
  })
  it('garde les autres noms', () => {
    expect(shortEventName('Pioche miracle Mewtwo')).toBe('Pioche miracle Mewtwo')
    expect(shortEventName('Missions de la semaine bonus')).toBe('Missions de la semaine bonus')
  })
})

describe('edgeOn', () => {
  const d0 = Date.parse('2026-11-12T00:00:00Z'), d1 = d0 + 86400000
  it('début, fin, les deux, aucun', () => {
    expect(edgeOn({ start: '2026-11-12T07:00:00Z', end: '2026-11-20T07:00:00Z' }, d0, d1)).toBe('start')
    expect(edgeOn({ start: '2026-11-01T07:00:00Z', end: '2026-11-12T07:00:00Z' }, d0, d1)).toBe('end')
    expect(edgeOn({ start: '2026-11-12T01:00:00Z', end: '2026-11-12T20:00:00Z' }, d0, d1)).toBe('both')
    expect(edgeOn({ start: '2026-11-01T07:00:00Z', end: '2026-11-20T07:00:00Z' }, d0, d1)).toBeNull()
  })
  it('un évènement ponctuel commence', () => {
    expect(edgeOn({ start: '2026-11-12T07:00:00Z', end: '2026-11-12T07:00:00Z' }, d0, d1)).toBe('start')
  })
})

describe('groupMissions', () => {
  const r = { item: 'BOOSTER_HOURGLASS', amount: 12 }
  it('regroupe un seul nombre variable avec la même récompense', () => {
    const g = groupMissions([
      { text: 'Participer à 1 combat', reward: r }, { text: 'Participer à 3 combats', reward: r }, { text: 'Participer à 15 combats', reward: r },
    ])
    expect(g).toEqual([{ text: 'Participer à 1, 3, 15 combats', reward: r, count: 3 }])
  })
  it('ne regroupe pas des récompenses différentes', () => {
    const g = groupMissions([{ text: 'Gagner 1 combat', reward: r }, { text: 'Gagner 3 combats', reward: { ...r, amount: 5 } }])
    expect(g.map((x) => x.text)).toEqual(['Gagner 1 combat', 'Gagner 3 combats'])
  })
  it('garde l’ordre et les missions sans nombre', () => {
    const g = groupMissions([{ text: 'Se connecter', reward: r }, { text: 'Gagner 1 combat', reward: r }, { text: 'Gagner 2 combats', reward: r }])
    expect(g.map((x) => x.text)).toEqual(['Se connecter', 'Gagner 1, 2 combats'])
  })
  it('ne fusionne pas si deux nombres varient', () => {
    const g = groupMissions([{ text: 'Se connecter, semaine 1 (jour 2)' }, { text: 'Se connecter, semaine 2 (jour 3)' }])
    expect(g).toHaveLength(2)
  })
})
