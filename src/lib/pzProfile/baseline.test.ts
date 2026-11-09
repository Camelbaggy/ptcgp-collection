import { describe, expect, it } from 'vitest'
import type { HistoryEvent } from '../types'
import { computeBaseline, pzSetToSetId } from './baseline'
import type { PzHome, PzStats } from './types'

const pack = (id: string, date: string, boosterId: string, n = 5): HistoryEvent => ({ id, kind: 'pack', date, boosterId, cardIds: Array.from({ length: n }, (_, k) => `${boosterId}-${k}`) })
const stats = { counters: [{ key: 'packs-opened', label: '', value: 100 }, { key: 'cards-obtained', label: '', value: 500 }], battles: [], packsBySet: [{ setCode: 'A1', name: 'x', packs: 10, cards: 50, unique: 5 }] } as unknown as PzStats
const home = { packPoints: [{ setCode: 'A1', points: 50 }, { setCode: 'B4b', points: 5 }, { setCode: 'PROMO-A', points: 0 }] } as unknown as PzHome
const setIds = ['A1', 'B4b', 'P-A']
const boosterSet = (b: string) => b.split('-')[0]

describe('pzSetToSetId', () => {
  it('matches case-insensitively and PROMO codes', () => {
    expect(pzSetToSetId('b4B', setIds)).toBe('B4b')
    expect(pzSetToSetId('PROMO-A', setIds)).toBe('P-A')
    expect(pzSetToSetId('Z9', setIds)).toBeNull()
  })
})

describe('computeBaseline', () => {
  const history = [
    pack('1', '2026-11-01T10:00:00Z', 'A1-Mewtwo'),
    pack('2', '2026-11-06T10:00:00Z', 'A1-Mewtwo'),
    pack('3', '2026-11-06T11:00:00Z', 'B4b-X', 6),
    pack('4', '2026-11-06T12:00:00Z', 'A1-Mewtwo', 1),
    { ...pack('5', '2026-11-06T13:00:00Z', 'A1-Mewtwo'), deleted: true },
  ]
  it('continues the snapshot with full packs after fetchedAt', () => {
    const b = computeBaseline({ fetchedAt: '2026-11-05T00:00:00Z', home, stats, history, boosterSet, setIds })
    expect(b.packsOpened).toBe(102)
    expect(b.cardsObtained).toBe(511)
    expect(b.packPoints.find((p) => p.setCode === 'A1')).toMatchObject({ points: 55, added: 1 })
    expect(b.packPoints.find((p) => p.setCode === 'B4b')?.points).toBe(10)
    expect(b.packsBySet[0].packs).toBe(11)
  })
  it('handles missing data', () => {
    const b = computeBaseline({ fetchedAt: 'bad', stats: null, home: null, history, boosterSet, setIds })
    expect(b.packsOpened).toBeNull()
    expect(b.addedPacks).toBe(0)
  })
})
