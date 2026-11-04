import { describe, expect, it } from 'vitest'
import { inReleaseWindow, shouldRun } from './releaseWindow'

const rel = [{ name: 'X', date: '2026-12-16' }]
describe('release window', () => {
  it('covers release day to +3 days (UTC)', () => {
    expect(inReleaseWindow(rel, new Date('2026-12-15T23:00:00Z'))).toBe(false)
    expect(inReleaseWindow(rel, new Date('2026-12-16T00:10:00Z'))).toBe(true)
    expect(inReleaseWindow(rel, new Date('2026-12-19T23:15:00Z'))).toBe(true)
    expect(inReleaseWindow(rel, new Date('2026-12-20T00:15:00Z'))).toBe(false)
  })
  it('runs at 06:15 daily, hourly only in a window', () => {
    expect(shouldRun([], new Date('2026-11-04T06:15:00Z'))).toBe(true)
    expect(shouldRun([], new Date('2026-11-04T09:15:00Z'))).toBe(false)
    expect(shouldRun(rel, new Date('2026-12-17T09:15:00Z'))).toBe(true)
    expect(shouldRun([], new Date('2026-11-04T09:15:00Z'), true)).toBe(true)
  })
})
