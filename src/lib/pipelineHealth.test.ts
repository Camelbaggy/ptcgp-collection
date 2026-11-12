import { describe, expect, it } from 'vitest'
// @ts-expect-error fichier .mjs sans types
import { checkCounts, checkMetaAge } from '../../scripts/lib/health.mjs'

const now = Date.parse('2026-11-12T12:00:00Z')
describe('pipeline health', () => {
  it('flags a stale meta.json', () => {
    expect(checkMetaAge('2026-11-10T12:00:00Z', now)).toHaveLength(1)
    expect(checkMetaAge('2026-11-12T06:00:00Z', now)).toHaveLength(0)
    expect(checkMetaAge(undefined, now)).toHaveLength(1)
  })
  it('flags a drop in file counts', () => {
    expect(checkCounts({ cards: 3900 }, { cards: 4126 })).toHaveLength(1)
    expect(checkCounts({ cards: 4120 }, { cards: 4126 })).toHaveLength(0)
    expect(checkCounts({}, { logos: 40 })).toHaveLength(1)
  })
})

import { metaStaleHours } from '../features/meta/useMeta'
describe('metaStaleHours', () => {
  it('only reports data older than 24 h', () => {
    expect(metaStaleHours('2026-11-12T06:00:00Z', now)).toBeNull()
    expect(metaStaleHours('2026-11-10T12:00:00Z', now)).toBe(48)
  })
})
