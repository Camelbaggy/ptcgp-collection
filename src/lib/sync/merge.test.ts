import { describe, expect, it } from 'vitest'
import { emptySnapshot, mergeSnapshots, countKeys, type SyncRow, type SyncSnapshot, type SyncTable } from './merge'

const snap = (deviceId: string, t: Partial<Record<SyncTable, SyncRow[]>>): SyncSnapshot => {
  const s = emptySnapshot(deviceId)
  Object.assign(s.tables, t)
  return s
}
const own = (cardId: string, quantity: number, updatedAt: string, by = 'A', deleted?: boolean): SyncRow =>
  ({ cardId, quantity, updatedAt, by, ...(deleted ? { deleted } : {}) })
const qty = (s: SyncSnapshot) => Object.fromEntries(s.tables.owned.filter((r) => !r.deleted).map((r) => [r.cardId, r.quantity]))

const NOW = Date.parse('2025-02-01T00:00:00Z')

describe('mergeSnapshots', () => {
  it('remote null: local kept, everything to upload', () => {
    const l = snap('A', { owned: [own('x', 1, '2025-01-01')] })
    const r = mergeSnapshots(l, null, NOW)
    expect(qty(r.merged)).toEqual({ x: 1 })
    expect(r.remoteChanges.owned).toEqual(['x'])
    expect(countKeys(r.localChanges)).toBe(0)
  })
  it('concurrent edits on different cards on 2 devices are both kept', () => {
    const a = snap('A', { owned: [own('x', 2, '2025-01-02', 'A'), own('y', 1, '2025-01-01', 'A')] })
    const b = snap('B', { owned: [own('x', 1, '2025-01-01', 'A'), own('y', 3, '2025-01-03', 'B')] })
    const m = mergeSnapshots(a, b, NOW)
    expect(qty(m.merged)).toEqual({ x: 2, y: 3 })
    expect(m.localChanges.owned).toEqual(['y'])
    expect(m.remoteChanges.owned).toEqual(['x'])
  })
  it('is commutative', () => {
    const a = snap('A', { owned: [own('x', 2, '2025-01-02', 'A')] })
    const b = snap('B', { owned: [own('x', 5, '2025-01-02', 'B')] })
    expect(mergeSnapshots(a, b, NOW).merged.tables).toEqual(mergeSnapshots(b, a).merged.tables)
  })
  it('clock tie is broken by device id', () => {
    const a = snap('A', { owned: [own('x', 2, '2025-01-02T00:00:00Z', 'A')] })
    const b = snap('B', { owned: [own('x', 5, '2025-01-02T00:00:00Z', 'B')] })
    expect(qty(mergeSnapshots(a, b, NOW).merged)).toEqual({ x: 5 })
  })
  it('newer deletion beats older edit, newer edit resurrects', () => {
    const live = snap('A', { owned: [own('x', 2, '2025-01-01')] })
    const dead = snap('B', { owned: [own('x', 0, '2025-01-02', 'B', true)] })
    expect(qty(mergeSnapshots(live, dead, NOW).merged)).toEqual({})
    const back = snap('A', { owned: [own('x', 1, '2025-01-03')] })
    expect(qty(mergeSnapshots(back, dead, NOW).merged)).toEqual({ x: 1 })
  })
  it('history is unioned by id', () => {
    const e1 = { id: '1', kind: 'pack', date: '2025-01-01', boosterId: 'b', cardIds: ['x'] }
    const e2 = { id: '2', kind: 'share', date: '2025-01-02', cardId: 'x', direction: 'given' }
    const m = mergeSnapshots(snap('A', { history: [e1] }), snap('B', { history: [e2] }), NOW)
    expect(m.merged.tables.history.map((e) => e.id)).toEqual(['1', '2'])
  })
  it('undo tombstone wins over the live event, even from a stale device', () => {
    const live = { id: '1', kind: 'pack', date: '2025-01-01', boosterId: 'b', cardIds: ['x'], updatedAt: '2025-01-01', by: 'A' }
    const tomb = { id: '1', deleted: true, updatedAt: '2025-01-05', by: 'B' }
    for (const [l, r] of [[live, tomb], [tomb, live]]) {
      const m = mergeSnapshots(snap('A', { history: [l] }), snap('B', { history: [r] }), NOW)
      expect(m.merged.tables.history).toHaveLength(1)
      expect(m.merged.tables.history[0]).toMatchObject({ id: '1', deleted: true, kind: 'pack', updatedAt: '2025-01-05' })
    }
  })
  it('undo propagates quantities via owned LWW', () => {
    const before = snap('A', { owned: [own('x', 1, '2025-01-01')] })
    const afterUndo = snap('B', { owned: [own('x', 0, '2025-01-05', 'B', true)] })
    const m = mergeSnapshots(before, afterUndo, NOW)
    expect(qty(m.merged)).toEqual({})
    expect(m.localChanges.owned).toEqual(['x'])
  })
  it('user-added sets: LWW by id, union of others', () => {
    const s1 = { id: 'C1', name: 'Old', order: 9, updatedAt: '2025-01-01' }
    const s2 = { id: 'C1', name: 'New', order: 9, updatedAt: '2025-02-01' }
    const s3 = { id: 'C2', name: 'Other', order: 10, updatedAt: '2025-01-01' }
    const m = mergeSnapshots(snap('A', { sets: [s1, s3] }), snap('B', { sets: [s2] }), NOW)
    expect(m.merged.tables.sets.map((s) => s.name)).toEqual(['New', 'Other'])
  })
  it('no changes when identical', () => {
    const a = snap('A', { owned: [own('x', 1, '2025-01-01')] })
    const m = mergeSnapshots(a, structuredClone(a), NOW)
    expect(countKeys(m.localChanges) + countKeys(m.remoteChanges)).toBe(0)
  })
})

describe('importedEvents table', () => {
  it('merges last-writer-wins by id', async () => {
    const { emptySnapshot, mergeSnapshots } = await import('./merge')
    const a = emptySnapshot('a'), b = emptySnapshot('b')
    a.tables.importedEvents.push({ id: 'pz-1', name: 'old', updatedAt: '2026-11-01T00:00:00Z', by: 'a' })
    b.tables.importedEvents.push({ id: 'pz-1', name: 'new', updatedAt: '2026-11-02T00:00:00Z', by: 'b' }, { id: 'pz-2', updatedAt: '2026-11-02T00:00:00Z', by: 'b' })
    const r = mergeSnapshots(a, b, Date.parse('2026-12-01'))
    expect(r.merged.tables.importedEvents.map((x) => x.name ?? x.id)).toEqual(['new', 'pz-2'])
    expect(r.localChanges.importedEvents).toEqual(['pz-1', 'pz-2'])
  })

  it('clamps future remote timestamps to now', () => {
    const now = Date.parse('2025-06-01T00:00:00Z')
    const a = snap('A', { owned: [own('x', 1, '2025-05-31T00:00:00Z', 'A')] })
    const b = snap('B', { owned: [own('x', 9, '2099-01-01T00:00:00Z', 'B')] })
    const m = mergeSnapshots(a, b, now)
    expect(m.merged.tables.owned[0].updatedAt).toBe('2025-06-01T00:00:00.000Z')
    expect(m.remoteChanges.owned).toEqual(['x'])
    // un edit local plus récent que « maintenant » borné gagne ensuite
    const later = snap('A', { owned: [own('x', 1, '2025-06-01T00:00:01Z', 'A')] })
    expect(qty(mergeSnapshots(later, m.merged, Date.parse('2025-06-01T00:00:02Z')).merged)).toEqual({ x: 1 })
  })
  it('purges tombstones older than 90 days and flags remote for rewrite', () => {
    const now = Date.parse('2025-06-01T00:00:00Z')
    const old = { id: 'e1', deleted: true, updatedAt: '2025-01-01T00:00:00Z', by: 'A' }
    const recent = { id: 'e2', deleted: true, updatedAt: '2025-05-20T00:00:00Z', by: 'A' }
    const r = mergeSnapshots(snap('A', {}), snap('B', { importedEvents: [old, recent] }), now)
    expect(r.merged.tables.importedEvents.map((x) => x.id)).toEqual(['e2'])
    expect(r.remoteChanges.importedEvents).toEqual(['e1'])
    expect(r.localChanges.importedEvents).toEqual(['e2'])
  })
  it('a deleted importedEvent tombstone wins over an older live row', () => {
    const live = { id: 'e1', title: 't', updatedAt: '2025-01-01T00:00:00Z', by: 'A' }
    const dead = { id: 'e1', deleted: true, updatedAt: '2025-01-02T00:00:00Z', by: 'B' }
    const r = mergeSnapshots(snap('A', { importedEvents: [live] }), snap('B', { importedEvents: [dead] }), Date.parse('2025-01-05'))
    expect(r.merged.tables.importedEvents[0].deleted).toBe(true)
  })
})
