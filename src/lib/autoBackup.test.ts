import { describe, expect, it } from 'vitest'
import { AUTO_PREFIX, autoFileName, daysAgo, isDue, namesToPrune, reminderVisible, sinceLabel } from './autoBackup'

const D = 86_400_000
const now = Date.UTC(2026, 10, 12, 12)

describe('autoBackup', () => {
  it('isDue selon la fréquence', () => {
    expect(isDue('off', null, now)).toBe(false)
    expect(isDue('week', null, now)).toBe(true)
    expect(isDue('week', now - 6 * D, now)).toBe(false)
    expect(isDue('week', now - 7 * D, now)).toBe(true)
    expect(isDue('day', now - 2 * D, now)).toBe(true)
    expect(isDue('month', now - 29 * D, now)).toBe(false)
  })
  it('le rappel est masqué 24 h après « Plus tard »', () => {
    expect(reminderVisible('week', null, now - 3600_000, now)).toBe(false)
    expect(reminderVisible('week', null, now - 25 * 3600_000, now)).toBe(true)
    expect(reminderVisible('off', null, 0, now)).toBe(false)
  })
  it('libellés', () => {
    expect(daysAgo(null, now)).toBeNull()
    expect(sinceLabel(null, now)).toBe('jamais')
    expect(sinceLabel(now - 100, now)).toBe('aujourd’hui')
    expect(sinceLabel(now - D, now)).toBe('hier')
    expect(sinceLabel(now - 9 * D, now)).toBe('il y a 9 jours')
  })
  it('nom de fichier et purge des plus anciennes copies', () => {
    expect(autoFileName(new Date('2026-11-12T10:00:00Z'))).toBe('ptcgp-auto-2026-11-12.json')
    const names = ['01', '02', '03', '04', '05', '06', '07'].map((d) => `${AUTO_PREFIX}2026-11-${d}.json`)
    expect(namesToPrune([...names, 'autre.json', 'ptcgp-sauvegarde-x.json'], 5)).toEqual([names[0], names[1]])
    expect(namesToPrune(names.slice(0, 3), 5)).toEqual([])
  })
})

describe('autoBackup par profil', () => {
  it('chaque profil a son préfixe et sa purge', () => {
    expect(autoFileName(new Date('2026-11-12T10:00:00Z'), 'ptcgp-auto-lea-')).toBe('ptcgp-auto-lea-2026-11-12.json')
    const main = ['01', '02'].map((d) => `ptcgp-auto-2026-11-${d}.json`)
    const lea = ['01', '02', '03'].map((d) => `ptcgp-auto-lea-2026-11-${d}.json`)
    expect(namesToPrune([...main, ...lea], 1, 'ptcgp-auto-')).toEqual([main[0]])
    expect(namesToPrune([...main, ...lea], 1, 'ptcgp-auto-lea-')).toEqual([lea[0], lea[1]])
  })
})
