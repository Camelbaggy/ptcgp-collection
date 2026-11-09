import { describe, expect, it } from 'vitest'
import { pendingLabel, splitCaptures } from './captureQueue'

describe('captureQueue', () => {
  it('sépare les écrans noirs', () => {
    const r = splitCaptures([{ black: false }, { black: true }, { black: false }])
    expect(r.ok.length).toBe(2)
    expect(r.black.length).toBe(1)
  })
  it('libellé du nombre en attente', () => {
    expect(pendingLabel(0)).toBe('')
    expect(pendingLabel(1)).toBe('1 capture en attente')
    expect(pendingLabel(2)).toBe('2 captures en attente')
  })
})
