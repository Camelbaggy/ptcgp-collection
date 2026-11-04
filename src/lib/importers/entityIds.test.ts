import { describe, expect, it } from 'vitest'
import type { Card } from '../types'
import { addEntityIds } from './entityIds'
import { entityFromImage } from './publicSource'

describe('entity ids', () => {
  it('parses asset names', () => {
    expect(entityFromImage('cPK_10_018340_00_MIRAIDONex_RR.webp')).toEqual({ entityKind: 'PK', entityId: 18340 })
    expect(entityFromImage('cTR_20_000040_00_HAKASENOKENKYU_SR.webp')).toEqual({ entityKind: 'TR', entityId: 40 })
    expect(entityFromImage('x.webp')).toBeNull()
    expect(entityFromImage(undefined)).toBeNull()
  })
  it('maps by set + number (promo sets renamed) and is idempotent', () => {
    const card = (id: string, setId: string, number: number): Card => ({ id, setId, number, name: id, rarity: 'P', boosterIds: [] })
    const pub = [
      { set: 'PROMO-A', number: 1, name: 'Potion', image: 'cTR_90_000010_00_KIZUGUSURI_C.webp' },
      { set: 'A1', number: 1, name: 'Bulbasaur', image: 'cPK_10_000010_00_FUSHIGIDANE_C.webp' },
    ]
    const r = addEntityIds([card('P-A-1', 'P-A', 1), card('A1-1', 'A1', 1), card('A1-2', 'A1', 2)], pub)
    expect(r.added).toBe(2)
    expect(r.cards[0]).toMatchObject({ entityKind: 'TR', entityId: 10 })
    expect(r.cards[2]!.entityId).toBeUndefined()
    expect(addEntityIds(r.cards, pub).added).toBe(0)
  })
})
