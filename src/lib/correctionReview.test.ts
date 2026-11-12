import { describe, expect, it } from 'vitest'
import { changedRows, cleanQty, modifiedLabel, reviewValue, toCorrections } from './correctionReview'

describe('correctionReview', () => {
  it('nettoie la saisie', () => {
    expect(cleanQty('1a2 3')).toBe('123')
    expect(cleanQty('123456')).toBe('1234')
    expect(cleanQty('')).toBe('')
  })

  it('retient la saisie, sinon la lecture, sinon la quantité actuelle', () => {
    const row = { cardId: 'A1-1', cur: 2, read: 3 }
    expect(reviewValue(row, {})).toBe(3)
    expect(reviewValue(row, { 'A1-1': '' })).toBe(3)
    expect(reviewValue(row, { 'A1-1': '0' })).toBe(0)
    expect(reviewValue({ cardId: 'A1-2', cur: 2, read: null }, {})).toBe(2)
  })

  it('liste les changements et les corrections', () => {
    const rows = [
      { cardId: 'a', cur: 1, read: 1 },
      { cardId: 'b', cur: 1, read: 2 },
      { cardId: 'c', cur: 0, read: null },
    ]
    const edits = { a: '4', b: '1' }
    expect(changedRows(rows, edits).map((r) => r.cardId)).toEqual(['a'])
    expect(toCorrections(changedRows(rows, {}), {})).toEqual([{ cardId: 'b', to: 2 }])
  })

  it('accorde « modifiée »', () => {
    expect(modifiedLabel(0)).toBe('0 modifiée')
    expect(modifiedLabel(1)).toBe('1 modifiée')
    expect(modifiedLabel(2)).toBe('2 modifiées')
  })
})
