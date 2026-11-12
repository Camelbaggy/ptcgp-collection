import { describe, expect, it } from 'vitest'
import { isKeyboardOpen } from './useKeyboardOpen'

describe('isKeyboardOpen', () => {
  it('is open below 75 % of the reference height', () => {
    expect(isKeyboardOpen(500, 900)).toBe(true)
    expect(isKeyboardOpen(674, 900)).toBe(true)
  })
  it('is closed at or above 75 %', () => {
    expect(isKeyboardOpen(675, 900)).toBe(false)
    expect(isKeyboardOpen(900, 900)).toBe(false)
  })
  it('is closed without a reference', () => {
    expect(isKeyboardOpen(0, 0)).toBe(false)
  })
})
