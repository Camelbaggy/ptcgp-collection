import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Booster, Card, CardSet } from './types'
import { applyNameFixes } from './importers/nameFixes'

const read = <T>(n: string): T => JSON.parse(readFileSync(resolve(__dirname, '../../public/data', n), 'utf8')) as T
const cards = read<Card[]>('cards.json')
const sets = read<CardSet[]>('sets.json')
const boosters = read<Booster[]>('boosters.json')

/** Mission rewards, never sold in a booster (checked against the community dataset: no `packs`). */
const NOT_IN_BOOSTER = ['A1-283', 'C1-152', 'C1-183', 'C1-185']

describe('données livrées : cartes', () => {
  it('identifiants uniques, extension connue, boosters connus', () => {
    const ids = new Set(cards.map((c) => c.id))
    expect(ids.size).toBe(cards.length)
    const setIds = new Set(sets.map((s) => s.id))
    const boosterIds = new Set(boosters.map((b) => b.id))
    for (const c of cards) {
      expect(setIds.has(c.setId), c.id).toBe(true)
      for (const b of c.boosterIds) expect(boosterIds.has(b), `${c.id} ${b}`).toBe(true)
    }
  })

  it('même nom anglais => même nom français', () => {
    const byEn = new Map<string, Set<string>>()
    for (const c of cards) {
      if (!c.nameEn) continue
      const s = byEn.get(c.nameEn) ?? new Set()
      s.add(c.name)
      byEn.set(c.nameEn, s)
    }
    const bad = [...byEn].filter(([, s]) => s.size > 1).map(([en, s]) => `${en}: ${[...s].join(' / ')}`)
    expect(bad).toEqual([])
  })

  it('même nom français => même espèce anglaise', () => {
    // English names of regional forms are written several ways ("Paldean Wooper", "Wooper Paldea"): compare without the form words.
    const species = (en = '') => en.replace(/\b(Alolan?|Paldean?|Galarian|Hisuian)\b/g, '').replace(/\s+/g, '').toLowerCase().replace('alolaneggutor', 'exeggutor')
    const byFr = new Map<string, Set<string>>()
    for (const c of cards) {
      const s = byFr.get(c.name) ?? new Set()
      s.add(species(c.nameEn))
      byFr.set(c.name, s)
    }
    const bad = [...byFr].filter(([, s]) => s.size > 1).map(([fr, s]) => `${fr}: ${[...s].join(' / ')}`)
    expect(bad).toEqual([])
  })

  it('seules les cartes de mission sont absentes de tout booster', () => {
    expect(cards.filter((c) => !c.boosterIds.length).map((c) => c.id).sort()).toEqual([...NOT_IN_BOOSTER].sort())
  })

  it('les corrections de noms sont déjà appliquées', () => {
    expect(applyNameFixes(cards).fixed).toEqual([])
  })
})
