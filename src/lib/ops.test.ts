import { describe, expect, it } from 'vitest'
import { pickUndoable, applyDeltas, canGive, canShareCard, canTradeCard, eventDeltas, invert } from './ops'

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

describe('pickUndoable', () => {
  const ev = (id: string, date: string, by?: string, deleted?: boolean) => ({ id, kind: 'pack' as const, date, boosterId: 'b', cardIds: [], by, deleted })
  it('ignores other devices and deleted events', () => {
    const list = [ev('a', '2026-01-01', 'me'), ev('b', '2026-01-03', 'other'), ev('c', '2026-01-04', 'me', true)]
    expect(pickUndoable(list, 'me')?.id).toBe('a')
  })
  it('returns null when only foreign events', () => {
    expect(pickUndoable([ev('b', '2026-01-03', 'other')], 'me')).toBeNull()
  })
  it('accepts unstamped events', () => {
    expect(pickUndoable([ev('x', '2026-01-03')], 'me')?.id).toBe('x')
  })
})
