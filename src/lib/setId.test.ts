import { describe, expect, it } from 'vitest'
import { setIdOf } from './setId'

describe('setIdOf', () => {
  it('handles regular, promo and special ids', () => {
    expect(setIdOf('A1-Mewtwo')).toBe('A1')
    expect(setIdOf('A4-Ho-Oh')).toBe('A4')
    expect(setIdOf('A1-12')).toBe('A1')
    expect(setIdOf('P-B-Promo')).toBe('P-B')
    expect(setIdOf('P-A-23')).toBe('P-A')
    expect(setIdOf('SP1-Unique')).toBe('SP1')
    expect(setIdOf('SP1--1')).toBe('SP1')
  })
})
