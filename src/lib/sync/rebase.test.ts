import { describe, expect, it } from 'vitest'
import { emptySnapshot, mergeSnapshots, type SyncRow, type SyncSnapshot } from './merge'
import { checkOwnedConsistency, rebaseOwned } from './rebase'
import { applyDeltas, eventDeltas, invert } from '../ops'
import type { HistoryEvent } from '../types'

/** Appareil simulé : mêmes règles d'écriture que db.ts (quantités absolues + évènements horodatés). */
let clock = 0
class Device {
  snap: SyncSnapshot
  n = 0
  id: string
  constructor(id: string) { this.id = id; this.snap = emptySnapshot(id) }
  private tick() { clock += 1000; return new Date(clock).toISOString() }
  qty(cardId: string): number {
    const r = this.snap.tables.owned.find((o) => o.cardId === cardId && !o.deleted)
    return r ? Number(r.quantity) : 0
  }
  quantities() { return Object.fromEntries(this.snap.tables.owned.filter((o) => !o.deleted).map((o) => [o.cardId, o.quantity])) }
  private writeOwned(cardId: string, q: number, at: string) {
    const rows = this.snap.tables.owned.filter((o) => o.cardId !== cardId)
    rows.push(q > 0 ? { cardId, quantity: q, updatedAt: at, by: this.id } : { cardId, deleted: true, updatedAt: at, by: this.id })
    this.snap.tables.owned = rows
  }
  set(cardId: string, q: number) { this.writeOwned(cardId, q, this.tick()) }
  private event(ev: HistoryEvent, deltas = eventDeltas(ev)) {
    const ids = [...deltas.keys()]
    const next = applyDeltas(new Map(ids.map((id) => [id, this.qty(id)])), deltas)
    const at = ev.date
    for (const id of ids) this.writeOwned(id, next.get(id)!, at)
    this.snap.tables.history.push({ ...ev, updatedAt: at, by: this.id } as unknown as SyncRow)
    return ev
  }
  pack(...cardIds: string[]) {
    return this.event({ id: `${this.id}${++this.n}`, kind: 'pack', date: this.tick(), boosterId: 'b', cardIds })
  }
  give(cardId: string) {
    return this.event({ id: `${this.id}${++this.n}`, kind: 'share', date: this.tick(), cardId, direction: 'given' })
  }
  correct(changes: Record<string, number>) {
    const ch = Object.entries(changes).map(([cardId, to]) => ({ cardId, from: this.qty(cardId), to }))
    return this.event({ id: `${this.id}${++this.n}`, kind: 'correction', date: this.tick(), changes: ch })
  }
  undo(ev: HistoryEvent) {
    const deltas = invert(eventDeltas(ev))
    const at = this.tick()
    const next = applyDeltas(new Map([...deltas.keys()].map((id) => [id, this.qty(id)])), deltas)
    for (const [id, q] of next) this.writeOwned(id, q, at)
    this.snap.tables.history = this.snap.tables.history.map((h) => (h.id === ev.id ? { id: ev.id, deleted: true, updatedAt: at, by: this.id } : h))
  }
}

/** Drive simulé : un seul fichier ; chaque synchro fusionne, écrit le résultat en local et le téléverse. */
class Drive {
  file: SyncSnapshot | null = null
  sync(d: Device) {
    const res = mergeSnapshots(d.snap, this.file ? structuredClone(this.file) : null, (clock += 1000))
    d.snap = structuredClone(res.merged)
    d.snap.deviceId = d.id
    this.file = structuredClone(res.merged)
    return res
  }
}

const twoDevices = () => {
  clock = Date.parse('2026-01-01T00:00:00Z')
  const drive = new Drive()
  const a = new Device('A'), b = new Device('B')
  a.set('x', 1); a.set('y', 3)
  drive.sync(a); drive.sync(b)
  return { drive, a, b }
}

describe('rebaseOwned via mergeSnapshots', () => {
  it('two devices add 1 copy of the same card offline => +2 after both sync', () => {
    for (const order of ['AB', 'BA']) {
      const { drive, a, b } = twoDevices()
      expect(b.qty('x')).toBe(1)
      a.pack('x'); b.pack('x')
      const [first, second] = order === 'AB' ? [a, b] : [b, a]
      drive.sync(first)
      const res = drive.sync(second)
      expect(res.rebased).toEqual(['x'])
      drive.sync(first)
      expect(a.qty('x')).toBe(3)
      expect(b.qty('x')).toBe(3)
      expect(a.snap.tables.history.filter((h) => !h.deleted)).toHaveLength(2)
    }
  })

  it('converges: further syncs change nothing', () => {
    const { drive, a, b } = twoDevices()
    a.pack('x', 'y', 'z'); b.pack('x', 'z'); b.give('y')
    drive.sync(a); drive.sync(b); drive.sync(a)
    expect(a.quantities()).toEqual({ x: 3, y: 3, z: 2 })
    expect(b.quantities()).toEqual(a.quantities())
    const again = drive.sync(b)
    expect(again.rebased).toEqual([])
    expect(again.localChanges.owned).toEqual([])
    expect(again.remoteChanges.owned).toEqual([])
  })

  it('an undo on one device while the other added the same card offline', () => {
    const { drive, a, b } = twoDevices()
    const p = a.pack('x')
    drive.sync(a); drive.sync(b)
    expect(b.qty('x')).toBe(2)
    a.undo(p)     // x: 2 -> 1 on A
    b.pack('x')   // x: 2 -> 3 on B
    drive.sync(b); drive.sync(a); drive.sync(b)
    expect(a.qty('x')).toBe(2)
    expect(b.qty('x')).toBe(2)
  })

  it('a correction absorbs older offline packs of the other device', () => {
    const { drive, a, b } = twoDevices()
    b.pack('x')               // phone offline, x 1 -> 2
    a.correct({ x: 2 })       // PC: Pokémon-Zone already counts that pack
    drive.sync(b); drive.sync(a); drive.sync(b)
    expect(a.qty('x')).toBe(2)
    expect(b.qty('x')).toBe(2)
  })

  it('packs dated after the correction are added on top of it', () => {
    for (const order of ['AB', 'BA']) {
      const { drive, a, b } = twoDevices()
      a.correct({ x: 5 })
      b.pack('x')           // later, offline: 1 -> 2 on B
      const [first, second] = order === 'AB' ? [a, b] : [b, a]
      drive.sync(first); drive.sync(second); drive.sync(first)
      expect(a.qty('x')).toBe(6)
      expect(b.qty('x')).toBe(6)
    }
  })

  it('same history, divergent manual edits: plain last-writer-wins, nothing rebased', () => {
    const { drive, a, b } = twoDevices()
    a.set('x', 4)
    b.set('x', 7)
    drive.sync(a)
    const res = drive.sync(b)
    expect(res.rebased).toEqual([])
    expect(b.qty('x')).toBe(7)
  })

  it('a rebased quantity of 0 becomes a tombstone', () => {
    const w = new Map([['x', { quantity: 1, side: 'local' as const }]])
    const give = { id: 'g', kind: 'share', date: '2026-01-02', cardId: 'x', direction: 'given' }
    expect(rebaseOwned(w, { local: [], remote: [give], merged: [give] })).toEqual(new Map([['x', 0]]))
    const l = { tables: { ...emptySnapshot('A').tables, owned: [{ cardId: 'x', quantity: 1, updatedAt: '2026-01-03', by: 'A' }] } }
    const r = { tables: { ...emptySnapshot('B').tables, history: [give] } }
    const m = mergeSnapshots({ ...emptySnapshot('A'), ...l }, { ...emptySnapshot('B'), ...r }, Date.parse('2026-02-01'))
    expect(m.merged.tables.owned[0]).toMatchObject({ cardId: 'x', deleted: true, by: 'A' })
  })
})

describe('checkOwnedConsistency', () => {
  const corr = (id: string, date: string, cardId: string, from: number, to: number) =>
    ({ id, kind: 'correction', date, changes: [{ cardId, from, to }] })
  const pack = (id: string, date: string, ...cardIds: string[]) => ({ id, kind: 'pack', date, boosterId: 'b', cardIds })

  it('reports cards whose quantity misses events after their last correction', () => {
    const history = [
      pack('p0', '2026-01-01', 'x'),                 // absorbed by the correction
      corr('c1', '2026-01-02', 'x', 1, 4),
      pack('p1', '2026-01-03', 'x', 'y'),
      pack('p2', '2026-01-04', 'x'),
      { id: 'p3', deleted: true, updatedAt: '2026-01-05' },
    ]
    expect(checkOwnedConsistency([{ cardId: 'x', quantity: 5 }, { cardId: 'y', quantity: 1 }], history))
      .toEqual([{ cardId: 'x', quantity: 5, expected: 6, since: '2026-01-02' }])
    expect(checkOwnedConsistency([{ cardId: 'x', quantity: 6 }], history)).toEqual([])
  })
  it('cards without correction are not checked', () => {
    expect(checkOwnedConsistency([{ cardId: 'x', quantity: 9 }], [pack('p', '2026-01-01', 'x')])).toEqual([])
  })
})
