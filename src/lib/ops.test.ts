import { describe, expect, it } from 'vitest'
import { applyDeltas, canGive, canShareCard, canTradeCard, eventDeltas, invert } from './ops'

describe('ops', () => {
  it('pack adds one per card, duplicates accumulate', () => {
    const d = eventDeltas({ id: '1', kind: 'pack', date: '', boosterId: 'b', cardIds: ['a', 'a', 'b'] })
    expect(d.get('a')).toBe(2)
    expect(d.get('b')).toBe(1)
  })
  it('trade moves one card each way and can be undone', () => {
    const d = eventDeltas({ id: '1', kind: 'trade', date: '', given: 'a', received: 'b' })
    const after = applyDeltas(new Map([['a', 2]]), d)
    expect(after.get('a')).toBe(1)
    expect(after.get('b')).toBe(1)
    expect(applyDeltas(after, invert(d)).get('a')).toBe(2)
  })
  it('refuses negative quantities', () => {
    const d = eventDeltas({ id: '1', kind: 'share', date: '', cardId: 'a', direction: 'given' })
    expect(() => applyDeltas(new Map(), d)).toThrow()
  })
  it('canGive needs 2 copies', () => {
    expect(canGive(1)).toBe(false)
    expect(canGive(2)).toBe(true)
  })
  it('rarity rules', () => {
    expect(canShareCard('D4', 2)).toBe(true)
    expect(canShareCard('E1', 2)).toBe(false)
    expect(canTradeCard('E2', 2)).toBe(true)
    expect(canTradeCard('E3', 5)).toBe(false)
    expect(canTradeCard('S1', 1)).toBe(false)
  })
  it('correction delta', () => {
    const d = eventDeltas({ id: '1', kind: 'correction', date: '', changes: [{ cardId: 'a', from: 1, to: 25 }] })
    expect(d.get('a')).toBe(24)
  })
})
