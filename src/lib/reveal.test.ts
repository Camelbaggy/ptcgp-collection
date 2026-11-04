import { describe, expect, it } from 'vitest'
import { groupBySet, newlyOwnedIds } from './reveal'

describe('newlyOwnedIds', () => {
  it('detects 0 -> >=1 only', () => {
    const before = new Map([['a', 1], ['b', 0]])
    const after = new Map([['a', 2], ['b', 1], ['c', 1], ['d', 0]])
    expect(newlyOwnedIds(before, after)).toEqual(['b', 'c'])
  })
  it('ignores removals and unchanged cards', () => {
    expect(newlyOwnedIds(new Map([['a', 2]]), new Map([['a', 0]]))).toEqual([])
    expect(newlyOwnedIds(new Map(), new Map())).toEqual([])
  })
})

describe('groupBySet', () => {
  const cards = new Map([
    ['A1-5', { setId: 'A1', number: 5 }], ['A1-2', { setId: 'A1', number: 2 }],
    ['A2-1', { setId: 'A2', number: 1 }],
  ])
  it('groups by set in first-seen order, sorted by number, dedupes, skips unknown', () => {
    expect(groupBySet(['A2-1', 'A1-5', 'A1-2', 'A1-5', 'zz'], cards)).toEqual([
      { setId: 'A2', cardIds: ['A2-1'] },
      { setId: 'A1', cardIds: ['A1-2', 'A1-5'] },
    ])
  })
})
