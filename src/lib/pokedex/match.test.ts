import { describe, expect, it } from 'vitest'
import { buildIndex, matchCard, normName, parseCardName } from './match'
import type { DexEntry } from './types'
import pokedexRaw from '../../../public/data/pokedex.json?raw'
import cardsRaw from '../../../public/data/cards.json?raw'

const entries: DexEntry[] = JSON.parse(pokedexRaw)
const cards: { name: string; nameEn?: string; entityKind?: string }[] = JSON.parse(cardsRaw)
const idx = buildIndex(entries)
const m = (nameEn: string, name = '') => matchCard(idx, { name, nameEn })
const id = (nameEn: string, name = '') => m(nameEn, name)?.formId

describe('normName', () => {
  it('ignore accents, casse, ponctuation', () => {
    expect(normName("Farfetch’d")).toBe('farfetchd')
    expect(normName('Flabébé')).toBe('flabebe')
    expect(normName('Type: Null')).toBe('typenull')
    expect(normName('Nidoran♀')).not.toBe(normName('Nidoran♂'))
  })
})

describe('parseCardName', () => {
  it('Méga + lettre', () => {
    expect(parseCardName('Mega Charizard X ex')).toMatchObject({ base: 'charizard', mega: true, megaLetter: 'x' })
    expect(parseCardName('Méga-Dracaufeu Y')).toMatchObject({ base: 'dracaufeu', mega: true, megaLetter: 'y' })
  })
  it('ne prend pas Méganium / Yanméga / Mégapagos pour des Méga', () => {
    for (const n of ['Méganium', 'Yanméga', 'Mégapagos', 'Meganium']) expect(parseCardName(n).mega).toBe(false)
  })
  it('régions', () => {
    expect(parseCardName('Alolan Vulpix')).toMatchObject({ base: 'vulpix', region: 'alola' })
    expect(parseCardName('Wooper Paldea')).toMatchObject({ base: 'wooper', region: 'paldea' })
    expect(parseCardName("Goupix d'Alola")).toMatchObject({ base: 'goupix', region: 'alola' })
    expect(parseCardName('M. Mime de Galar')).toMatchObject({ base: 'mmime', region: 'galar' })
  })
  it('Team Rocket', () => {
    expect(parseCardName("Team Rocket's Meowth ex")).toMatchObject({ base: 'meowth', mega: false })
    expect(parseCardName('Miaouss de la Team Rocket')).toMatchObject({ base: 'miaouss' })
  })
})

describe('matchCard', () => {
  it('espèces simples, EN ou FR seul', () => {
    expect(id('Bulbasaur')).toBe(1)
    expect(id('', 'Bulbizarre')).toBe(1)
    expect(id('Florizarre ex'.replace('Florizarre', 'Venusaur'))).toBe(3)
  })
  it('noms difficiles', () => {
    expect(m("Farfetch'd")?.dex).toBe(83)
    expect(m('Mr. Mime')?.dex).toBe(122)
    expect(m('Type: Null', 'Type:0')?.dex).toBe(772)
    expect(m('Ho-Oh')?.dex).toBe(250)
    expect(m('Porygon-Z')?.dex).toBe(474)
    expect(m('', 'Flabébé')?.dex).toBe(669)
    expect(m('Nidoran♀')?.dex).toBe(29)
    expect(m('Nidoran♂')?.dex).toBe(32)
    expect(m('Meganium')?.formKind).toBe('base')
    expect(m('Yanmega', 'Yanméga')?.dex).toBe(469)
  })
  it('Méga', () => {
    expect(m('Mega Venusaur', 'Méga-Florizarre')?.formKind).toBe('mega')
    expect(id('Mega Charizard X')).toBe(10034)
    expect(id('', 'Méga-Dracaufeu Y')).toBe(10035)
    expect(id('Mega Mewtwo Y ex')).not.toBe(id('Mega Mewtwo X ex'))
  })
  it('régionales', () => {
    expect(m('Alolan Vulpix')?.formLabelEn).toBe('Alolan')
    expect(m('Marowak Alola')?.formKind).toBe('regional')
    expect(m('', "Taupiqueur d'Alola")?.formKind).toBe('regional')
    expect(m('Galarian Mr. Mime')?.formLabelEn).toBe('Galarian')
    expect(m('Paldean Wooper')?.formLabelEn).toBe('Paldean')
    expect(m('Wooper Paldea')?.formId).toBe(m('Paldean Wooper')?.formId)
    expect(m('Paldean Tauros')?.dex).toBe(128)
    expect(m('Paldean Tauros')?.formKind).toBe('regional')
  })
  it('forme régionale inexistante : espèce de base', () => {
    expect(m('Paldean Clodsire')).toMatchObject({ dex: 980, formKind: 'base' })
    expect(m('Galarian Obstagoon')).toMatchObject({ dex: 862, formKind: 'base' })
  })
  it('Team Rocket, masques, variantes -> espèce', () => {
    expect(m("Team Rocket's Mewtwo ex")).toMatchObject({ dex: 150, formKind: 'base' })
    expect(m('', 'Zapdos de la Team Rocket'.replace('Zapdos', 'Électhor'))?.dex).toBe(145)
    expect(m('Teal Mask Ogerpon ex')?.dex).toBe(1017)
    expect(m('Necrozma Dawn', 'Necrozma Ailes de l’Aurore')?.dex).toBe(800)
  })
  it('fautes connues des données', () => {
    expect(m('Alolaneggutor', "Noadkoko d'Alola")).toMatchObject({ dex: 103, formKind: 'regional' })
    expect(m('Chien-Pao', 'Baoijan')?.dex).toBe(1002)
  })
})

describe('cartes Pokémon livrées', () => {
  it('toutes les cartes Pokémon ont une entrée de Pokédex', () => {
    const unmatched = cards.filter((c) => c.entityKind === 'PK' && !matchCard(idx, c)).map((c) => `${c.nameEn} / ${c.name}`)
    expect([...new Set(unmatched)]).toEqual([])
  })
  it("les cartes « Méga » vont sur une forme Méga", () => {
    const bad = cards.filter((c) => c.entityKind === 'PK' && /^mega /i.test(c.nameEn ?? '') && matchCard(idx, c)?.formKind !== 'mega')
    expect(bad.map((c) => c.nameEn)).toEqual([])
  })
})
