import { describe, expect, it } from 'vitest'
import { formatBytes, progressPercent, runQueue } from './offlineImages'

describe('offlineImages', () => {
  it('runQueue respects the concurrency limit and processes everything', async () => {
    let active = 0, max = 0, count = 0
    await runQueue(Array.from({ length: 20 }, (_, i) => i), 6, async () => {
      active++; max = Math.max(max, active)
      await new Promise((r) => setTimeout(r, 2))
      active--; count++
    })
    expect(count).toBe(20)
    expect(max).toBeLessThanOrEqual(6)
  })
  it('runQueue stops when aborted', async () => {
    const sig = { aborted: false }
    let count = 0
    await runQueue(Array.from({ length: 50 }, (_, i) => i), 2, async () => { count++; if (count === 5) sig.aborted = true }, sig)
    expect(count).toBeLessThan(10)
  })
  it('progressPercent and formatBytes', () => {
    expect(progressPercent({ done: 1, total: 4 })).toBe(25)
    expect(progressPercent({ done: 0, total: 0 })).toBe(0)
    expect(formatBytes(2 * 1024 * 1024)).toBe('2,0 Mo')
    expect(formatBytes(2048)).toBe('2 Ko')
  })
})
