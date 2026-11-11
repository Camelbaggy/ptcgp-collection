import { describe, expect, it } from 'vitest'
import { validateBackup } from './backupValidate'

const ok = () => ({ app: 'ptcgp-collection', owned: [{ cardId: 'A1-1', quantity: 2 }], cards: [{ id: 'A1-1' }], history: [{ id: 'h', kind: 'pack', date: 'x' }] })

describe('validateBackup', () => {
  it('accepts a sane backup', () => { expect(() => validateBackup(ok())).not.toThrow() })
  it('rejects wrong shape', () => {
    expect(() => validateBackup(null)).toThrow()
    expect(() => validateBackup({ app: 'x', owned: [], cards: [] })).toThrow()
  })
  it('rejects bad quantities', () => {
    for (const q of [-1, 1.5, '3', null, NaN]) {
      const b = ok(); b.owned = [{ cardId: 'A1-1', quantity: q as number }]
      expect(() => validateBackup(b)).toThrow(/quantités/)
    }
  })
  it('rejects non-text ids and unknown kinds', () => {
    const b = ok(); b.owned = [{ cardId: 5 as unknown as string, quantity: 1 }]
    expect(() => validateBackup(b)).toThrow()
    const c = ok(); c.history = [{ id: 'h', kind: 'zzz', date: 'x' }]
    expect(() => validateBackup(c)).toThrow(/évènements/)
  })
  it('rejects non-array tables', () => {
    expect(() => validateBackup({ ...ok(), wishlist: {} })).toThrow(/souhaits/)
  })
})
