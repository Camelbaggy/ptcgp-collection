import { describe, expect, it } from 'vitest'
import { holdWindow, takeWindow, windowBusy } from './window'

describe('fenêtre intégrée partagée', () => {
  it('une lecture automatique à la fois ; une demande de l\'utilisateur l\'interrompt', async () => {
    let releaseAuto: (() => void) | null = null
    releaseAuto = holdWindow('events', () => setTimeout(() => releaseAuto?.(), 5))
    expect(releaseAuto).not.toBeNull()
    expect(windowBusy()).toBe(true)
    expect(holdWindow('pm')).toBeNull()
    const release = await takeWindow('pz', (ms) => new Promise((r) => setTimeout(r, ms / 20)))
    expect(release).not.toBeNull()
    expect(holdWindow('pm')).toBeNull()
    expect(await takeWindow('pm')).toBeNull() // pas deux lectures demandées en même temps
    release!()
    expect(windowBusy()).toBe(false)
  })
})
