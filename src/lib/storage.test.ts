import { beforeEach, describe, expect, it } from 'vitest'
import { exportSettings, importSettings, lsGet, prefGet, prefSet } from './storage'

function installStorage() {
  const m = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      get length() { return m.size },
      key: (i: number) => [...m.keys()][i] ?? null,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => { m.set(k, v) },
      removeItem: (k: string) => { m.delete(k) },
    },
  })
}

describe('storage', () => {
  beforeEach(installStorage)

  it('stores and reads JSON preferences with a default', () => {
    expect(prefGet('dex.gen', 0)).toBe(0)
    prefSet('dex.gen', 3)
    expect(prefGet('dex.gen', 0)).toBe(3)
    expect(lsGet('ptcgp:dex.gen')).toBe('3')
  })

  it('exports preferences but not device state', () => {
    prefSet('stats.tab', 'activity')
    localStorage.setItem('ptcgp:pm.autoTry', '123')
    localStorage.setItem('ptcgp.deviceId', 'dabc')
    localStorage.setItem('autre', 'x')
    expect(exportSettings()).toEqual({ 'ptcgp:stats.tab': '"activity"' })
  })

  it('imports only valid preference entries', () => {
    const n = importSettings({ 'ptcgp:theme': 'light', 'ptcgp.deviceId': 'zzz', 'ptcgp:pm.autoTry': '1', evil: 'x', 'ptcgp:n': 5 })
    expect(n).toBe(1)
    expect(lsGet('ptcgp:theme')).toBe('light')
    expect(lsGet('ptcgp.deviceId')).toBeNull()
    expect(importSettings(null)).toBe(0)
    expect(importSettings([1])).toBe(0)
  })
})
