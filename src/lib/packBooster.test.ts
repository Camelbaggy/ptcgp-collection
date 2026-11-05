import { describe, expect, it } from 'vitest'
import { pickBooster, rankBoosters } from './packBooster'

describe('pickBooster', () => {
  it('picks the deluxe booster that holds every reprint', () => {
    const pack = [
      { boosterIds: ['A3b-Unique', 'A4b-Unique'] }, // Pyroli A3b-8
      { boosterIds: ['A3b-Unique', 'A4b-Unique'] }, // Otaquin
      { boosterIds: ['A3a-Unique', 'A4b-Unique'] }, // Matourgeon
      { boosterIds: ['A4-HoOh', 'A4b-Unique'] }, // Donphan
    ]
    expect(pickBooster(pack)).toBe('A4b-Unique')
  })
  it('breaks ties with the preferred booster', () => {
    const pack = [{ boosterIds: ['A1-Mewtwo', 'A1-Pikachu'] }, { boosterIds: ['A1-Mewtwo', 'A1-Pikachu'] }]
    expect(pickBooster(pack, 'A1-Pikachu')).toBe('A1-Pikachu')
    expect(pickBooster(pack)).toBe('A1-Mewtwo')
  })
  it('counts hits', () => {
    expect(rankBoosters([{ boosterIds: ['X'] }, { boosterIds: ['X', 'Y'] }])).toEqual([{ boosterId: 'X', hits: 2 }, { boosterId: 'Y', hits: 1 }])
    expect(pickBooster([{ boosterIds: [] }])).toBeUndefined()
  })
})
