import { describe, expect, it } from 'vitest'
import { autoDue } from './auto'
import { runPmSync } from './sync'
import type { PzHost } from '../pzSync/run'

const H = 3600_000
describe('lecture automatique PocketMads', () => {
  it('au plus toutes les 6 h, et pas plus d\'un essai par heure', () => {
    const now = Date.parse('2026-11-11T12:00:00Z')
    expect(autoDue(undefined, 0, now)).toBe(true)
    expect(autoDue(new Date(now - 5 * H).toISOString(), 0, now)).toBe(false)
    expect(autoDue(new Date(now - 7 * H).toISOString(), 0, now)).toBe(true)
    expect(autoDue(new Date(now - 7 * H).toISOString(), now - 0.5 * H, now)).toBe(false)
  })

  it('en automatique, la fenêtre ne se montre jamais : une vérification arrête tout', async () => {
    const shown: boolean[] = []
    let opened: boolean | undefined
    let closed = false
    const host: PzHost = {
      open: async (_u, _s, hidden) => { opened = hidden },
      navigate: async () => true,
      eval: async () => JSON.stringify({ challenge: true, heads: 0 }),
      setVisible: async (v) => { shown.push(v) },
      onUi: () => () => {},
      close: async () => { closed = true },
    }
    await expect(runPmSync(host, { silent: true, timing: { poll: 1 } })).rejects.toThrow(/vérification/)
    expect(opened).toBe(true)
    expect(shown.includes(true)).toBe(false)
    expect(closed).toBe(true)
  })
})
