import { describe, expect, it } from 'vitest'
import setsRaw from '../../../public/data/sets.json?raw'
import slugsRaw from '../../../public/data/set-slugs.json?raw'
import type { Booster, Card, CardSet, PackSlotRates } from '../types'
import type { PublicCard, PublicSet } from './publicSource'
import {
  mergePublicData, placeholderRates, ratesFromPublic, setsNeedingFrench, slugify, type PublicInput, type RefData,
} from './updateSets'

const slot = (rates: PackSlotRates['slots'][number]['rates']) => rates
const normalRows = (boosterId: string): PackSlotRates[] => [{
  boosterId, packType: 'normal', packTypeRate: 99.95,
  slots: [
    { slot: 1, rates: slot({ D1: 100 }) },
    { slot: 2, rates: slot({ D1: 100 }) },
    { slot: 3, rates: slot({ D2: 90, D3: 10 }) },
  ],
}]
const card = (id: string, setId: string, number: number, boosterIds: string[], extra: Partial<Card> = {}): Card =>
  ({ id, setId, number, name: `Carte ${number}`, nameEn: `Card ${number}`, rarity: 'D1', boosterIds, image: '', ...extra })

const ref: RefData = {
  sets: [
    { id: 'B1', name: 'Mega-Ascension', nameEn: 'Mega Rising', order: 1 },
    { id: 'C1', name: 'Fusion Double', nameEn: 'Dual Fusion', order: 2 },
  ] as CardSet[],
  boosters: [
    { id: 'B1-Unique', setId: 'B1', name: 'Mega-Ascension' },
    { id: 'C1-Mewtwo', setId: 'C1', name: 'Mewtwo' },
    { id: 'C1-Pikachu', setId: 'C1', name: 'Pikachu' },
  ] as Booster[],
  cards: [
    card('B1-1', 'B1', 1, ['B1-Unique']),
    card('C1-1', 'C1', 1, ['C1-Mewtwo']),
    card('C1-2', 'C1', 2, ['C1-Pikachu']),
  ],
  rates: [...normalRows('B1-Unique'), ...normalRows('C1-Mewtwo'), ...normalRows('C1-Pikachu')],
  slugs: { B1: 'mega-ascension', C1: 'fusion-double' },
}

const pc = (set: string, number: number, name: string, packs: string[], image: string, rarity = 'C'): PublicCard =>
  ({ set, number, name, rarity, packs, image, element: 'grass', type: 'pokemon', stage: 'basic' })
const pubSets: PublicSet[] = [
  { code: 'B1', releaseDate: '2025-07-01', name: { en: 'Mega Rising', fr: 'Mega-Ascension' }, packs: ['Mega Rising'] },
  { code: 'C1', releaseDate: '2026-10-29', name: { en: 'Dual Fusion', fr: 'Fusion Double' }, packs: ['Dual Fusion Mewtwo', 'Dual Fusion Pikachu'] },
  { code: 'C2', releaseDate: '2027-01-15', name: { en: 'Lost Island', fr: "L'Île Perdue" }, packs: ['Lost Island Mew', 'Lost Island Celebi'] },
]
const pubCards: PublicCard[] = [
  pc('B1', 1, 'Bulbasaur', ['Mega Rising'], 'b1-1.webp'),
  pc('C1', 1, 'Mewtwo', ['Dual Fusion Mewtwo'], 'c1-1.webp'),
  pc('C1', 2, 'Pikachu', ['Dual Fusion Pikachu'], 'c1-2.webp'),
  // C2: 2 new cards, 1 reprint of B1-1 (same artwork) and 1 reprint of C1-2
  pc('C2', 1, 'Mew', ['Lost Island Mew'], 'c2-1.webp'),
  pc('C2', 2, 'Celebi', ['Lost Island Celebi'], 'c2-2.webp', 'RR'),
  pc('C2', 3, 'Bulbasaur', ['Lost Island Mew', 'Lost Island Celebi'], 'b1-1.webp'),
  pc('C2', 4, 'Pikachu', ['Lost Island Celebi'], 'c1-2.webp'),
]
const input = (extra: Partial<PublicInput> = {}): PublicInput => ({ sets: pubSets, cards: pubCards, ...extra })

describe('slugify', () => {
  it('follows the Pokekalos rule', () => {
    expect(slugify("L'Île Fabuleuse")).toBe('l-ile-fabuleuse')
    expect(slugify("La Clairière d'Évoli")).toBe('la-clairiere-d-evoli')
    expect(slugify('Promo-A')).toBe('promo-a')
    expect(slugify('  Aura  Palpitante ')).toBe('aura-palpitante')
  })
  it('reproduces every shipped slug from the shipped French set name', () => {
    const sets = JSON.parse(setsRaw) as CardSet[]
    const slugs = JSON.parse(slugsRaw) as Record<string, string>
    const bad = sets.filter((s) => slugs[s.id] && slugify(s.name) !== slugs[s.id]).map((s) => `${s.id}: ${slugify(s.name)} != ${slugs[s.id]}`)
    expect(bad).toEqual([])
  })
})

describe('mergePublicData', () => {
  const fr = { C2: { name: "L'Île Perdue (TCGdex)", cards: new Map([[1, 'Mew'], [2, 'Celebi FR'], [3, 'Bulbizarre'], [4, 'Pikachu']]) } }

  it('adds a new set with boosters, cards, reprint links, slug and estimated rates', () => {
    const r = mergePublicData(ref, input({ french: fr }))
    expect(r.changed).toBe(true)
    const s = r.data.sets.find((x) => x.id === 'C2')!
    expect(s).toMatchObject({ name: "L'Île Perdue (TCGdex)", nameEn: 'Lost Island', order: 3, releaseDate: '2027-01-15' })
    expect(r.data.slugs.C2).toBe('l-ile-perdue-tcgdex')
    // boosters: set-name prefix stripped
    const bs = r.data.boosters.filter((b) => b.setId === 'C2')
    expect(bs.map((b) => b.id)).toEqual(['C2-Mew', 'C2-Celebi'])
    expect(bs.every((b) => b.ratesEstimated)).toBe(true)
    // reprints are not recreated; existing ids get the new boosters
    expect(r.data.cards.find((c) => c.id === 'C2-3')).toBeUndefined()
    expect(r.data.cards.find((c) => c.id === 'C2-4')).toBeUndefined()
    expect(r.data.cards.find((c) => c.id === 'B1-1')!.boosterIds).toEqual(['B1-Unique', 'C2-Mew', 'C2-Celebi'])
    expect(r.data.cards.find((c) => c.id === 'C1-2')!.boosterIds).toEqual(['C1-Pikachu', 'C2-Celebi'])
    // new cards: French names, localized labels, booster ids
    const c2 = r.data.cards.filter((c) => c.setId === 'C2')
    expect(c2.map((c) => c.id)).toEqual(['C2-1', 'C2-2'])
    expect(c2[1]).toMatchObject({ name: 'Celebi FR', nameEn: 'Celebi', rarity: 'D4', type: 'Plante', stage: 'Base', boosterIds: ['C2-Celebi'], image: '' })
    // placeholder rates copied from the most recent comparable set (C1, first booster), flagged
    const rates = r.data.rates.filter((x) => x.boosterId === 'C2-Mew')
    expect(rates).toEqual(normalRows('C2-Mew'))
    expect(r.report.newSets[0]).toMatchObject({ id: 'C2', cards: 2, boosters: 2, reprints: 2, rates: 'placeholder' })
    // existing data untouched
    expect(r.data.cards.slice(0, 1)[0]!.id).toBe('B1-1')
    expect(r.data.sets.slice(0, 2)).toEqual(ref.sets)
  })

  it('is idempotent: re-running on its own output changes nothing', () => {
    const first = mergePublicData(ref, input({ french: fr }))
    const second = mergePublicData(first.data, input({ french: fr }))
    expect(second.changed).toBe(false)
    expect(second.data).toEqual(first.data)
    expect(second.report.newSets).toEqual([])
  })

  it('does nothing when nothing is new', () => {
    const r = mergePublicData(ref, { sets: pubSets.slice(0, 2), cards: pubCards.slice(0, 3) })
    expect(r.changed).toBe(false)
    expect(r.report.warnings).toEqual([])
  })

  it('keeps English names with a warning when TCGdex is unreachable, translates later', () => {
    const first = mergePublicData(ref, input())
    expect(first.data.cards.find((c) => c.id === 'C2-1')!.name).toBe('Mew')
    expect(first.report.untranslatedCards).toBe(2)
    expect(first.report.warnings.some((w) => w.includes('sans nom français'))).toBe(true)
    expect(setsNeedingFrench(first.data, input())).toContain('C2')
    const later = mergePublicData(first.data, input({ french: fr }))
    expect(later.changed).toBe(true)
    expect(later.data.cards.find((c) => c.id === 'C2-2')!.name).toBe('Celebi FR')
    expect(later.report.translatedCards).toBeGreaterThan(0)
  })

  it('adds new cards of an existing set, mapping pack names to existing boosters', () => {
    const cards = [...pubCards, pc('C1', 3, 'Raichu', ['Dual Fusion Pikachu'], 'c1-3.webp', 'R')]
    const r = mergePublicData(ref, { sets: pubSets.slice(0, 2), cards: cards.filter((c) => c.set !== 'C2') })
    expect(r.changed).toBe(true)
    expect(r.report.newCards).toEqual({ C1: 1 })
    expect(r.data.cards.find((c) => c.id === 'C1-3')).toMatchObject({ boosterIds: ['C1-Pikachu'], rarity: 'D3' })
    expect(r.data.boosters).toEqual(ref.boosters)
  })

  it('uses public pull rates when the dataset has them (no estimated flag)', () => {
    const pullRates = {
      C2: {
        'Regular Pack': { appearance_rate: 99, slots: { '0': { C: 100 }, '1': { U: 90, R: 10 } } },
        'Rare Pack': { appearance_rate: 1, slots: { '0': { AR: 50, SAR: 25, SR: 25 } } },
      },
    }
    const r = mergePublicData(ref, input({ pullRates }))
    expect(r.data.boosters.filter((b) => b.setId === 'C2').some((b) => b.ratesEstimated)).toBe(false)
    const rows = r.data.rates.filter((x) => x.boosterId === 'C2-Celebi')
    expect(rows.map((x) => x.packType)).toEqual(['normal', 'rare'])
    expect(rows[0]!.slots).toEqual([{ slot: 1, rates: { D1: 100 } }, { slot: 2, rates: { D2: 90, D3: 10 } }])
    expect(rows[1]!.slots[0]!.rates).toEqual({ E1: 50, E2: 50 })
    expect(r.report.newSets[0]!.rates).toBe('public')
  })

  it('a single-pack set gets the "-Unique" booster named after the set', () => {
    const sets = [...pubSets.slice(0, 2), { code: 'C3', releaseDate: '2027-04-01', name: { en: 'Solo', fr: 'Solo FR' }, packs: ['Solo'] }]
    const cards = [...pubCards.filter((c) => c.set !== 'C2'), pc('C3', 1, 'Eevee', ['Solo'], 'c3-1.webp')]
    const r = mergePublicData(ref, { sets, cards })
    expect(r.data.boosters.find((b) => b.setId === 'C3')).toEqual({ id: 'C3-Unique', setId: 'C3', name: 'Solo FR', ratesEstimated: true })
    expect(r.data.cards.find((c) => c.id === 'C3-1')!.boosterIds).toEqual(['C3-Unique'])
  })

  it('ignores a set announced without cards', () => {
    const r = mergePublicData(ref, { sets: pubSets, cards: pubCards.filter((c) => c.set !== 'C2') })
    expect(r.changed).toBe(false)
    expect(r.report.warnings[0]).toMatch(/sans carte/)
  })
})

describe('rates helpers', () => {
  it('placeholderRates prefers the same series and skips deluxe-style rules', () => {
    const deluxe: RefData = {
      ...ref,
      sets: [...ref.sets, { id: 'C9', name: 'Luxe', order: 9 }],
      boosters: [...ref.boosters, { id: 'C9-Unique', setId: 'C9', name: 'Luxe' }],
      rates: [...ref.rates, { boosterId: 'C9-Unique', packType: 'normal', packTypeRate: 100, slots: [{ slot: 1, rates: { D1: 100 }, byFinish: { Normale: { D1: 100 } } }] }],
    }
    const out = placeholderRates(['C2-X'], deluxe, 'C2')
    expect(out[0]!.boosterId).toBe('C2-X')
    expect(out[0]!.slots).toEqual(normalRows('x')[0]!.slots)
  })
  it('ratesFromPublic returns null for unknown rarity codes', () => {
    expect(ratesFromPublic({ 'Regular Pack': { appearance_rate: 100, slots: { '1': { UF: 100 } } } }, ['X-1'])).toBeNull()
    expect(ratesFromPublic(undefined, ['X-1'])).toBeNull()
  })
})
