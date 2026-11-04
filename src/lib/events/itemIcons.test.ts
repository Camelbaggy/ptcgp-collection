import { describe, expect, it } from 'vitest'
import { matchEmblem, resolveItemIcon, serebiiItemKey, type ItemIconManifest } from './itemIcons'

const manifest: ItemIconManifest = {
  items: {
    pokegold: 'items/pokegold.png', shinedust: 'items/shinedust.png', packhourglass: 'items/packhourglass.png',
    wonderhourglass: 'items/wonderhourglass.png', tradehourglass: 'items/tradehourglass.png',
    shopticket: 'items/shopticket.png', premiumticket: 'items/premiumticket.png', specialshopticket: 'items/specialshopticket.png',
  },
  emblems: [
    { name: 'Mega Mewtwo X Emblem', path: 'items/emblems/megamewtwoxemblem.png' },
    { name: 'Pikachu ver. 6 Emblem', path: 'items/emblems/pikachuver6.png' },
    { name: 'Mega Greninja Emblem', path: 'items/emblems/megagreninja.png' },
    { name: 'Ribombee Emblem', path: 'items/emblems/ribombee.png' },
    { name: 'Mega Charizard X Emblem', path: 'items/emblems/megacharizardx.png' },
    { name: 'Pikachu Emblem', path: 'items/emblems/pikachu.png' },
    { name: 'Mythical Island Emblem Event Participation Emblem', path: 'items/emblems/mi-nor.png' },
    { name: 'Mythical Island Emblem Event Gold Emblem', path: 'items/emblems/mi-gol.png' },
  ],
}

describe('serebiiItemKey', () => {
  it('maps Pokémon-Zone icon names', () => {
    expect(serebiiItemKey('POKEGOLD')).toBe('pokegold')
    expect(serebiiItemKey('SHINEDUST')).toBe('shinedust')
    expect(serebiiItemKey('PACK_CHARGER_100030')).toBe('packhourglass')
    expect(serebiiItemKey('CHALLENGE_CHARGER_110030')).toBe('wonderhourglass')
    expect(serebiiItemKey('TRADE_CHAGER_140010')).toBe('tradehourglass')
    expect(serebiiItemKey('SHOPTICKET')).toBe('shopticket')
    expect(serebiiItemKey('EVENT_SHOPTICKET_08')).toBe('shopticket')
    expect(serebiiItemKey('PREMIUM_TICKET')).toBe('premiumticket')
    expect(serebiiItemKey('PREMIER_SHOPTICKET')).toBe('specialshopticket')
    expect(serebiiItemKey('item_exp_player')).toBeUndefined()
  })
})

describe('resolveItemIcon', () => {
  it('uses bundled images when listed, a built-in otherwise', () => {
    expect(resolveItemIcon('POKEGOLD', {}, manifest)).toEqual({ kind: 'image', path: 'items/pokegold.png', key: 'pokegold' })
    expect(resolveItemIcon('POKEGOLD')).toEqual({ kind: 'builtin', id: 'gift' })
    expect(resolveItemIcon('REWIND_WATCH', {}, manifest)).toEqual({ kind: 'builtin', id: 'gift' })
  })
  it('built-ins by file name', () => {
    const b = (f: string) => (resolveItemIcon(f, {}, manifest) as { id: string }).id
    expect(b('item_exp_player')).toBe('exp')
    expect(b('COIN_101130_MEGAGEKKOUGA_BattleCoin')).toBe('coin')
    expect(b('DECKSHIELD_100950_MEGAGEKKOUGA_DeckShield')).toBe('sleeve')
    expect(b('PLAYMAT_100920_MEGAGEKKOUGA_PlayMat')).toBe('playmat')
    expect(b('ICON_BOARD_101620')).toBe('backdrop')
    expect(b('ICON_FILE_101390')).toBe('cover')
    expect(b('PROFILE_ICON_101160_PIKACHU_Ver4')).toBe('profile')
    expect(b('PACK_ICON_AN001_0010_00_000')).toBe('pack')
    expect(b('cTR_90_001790_00_GENOMECONVERTERY_U')).toBe('card')
    expect(b('whatever')).toBe('gift')
  })
  it('name based fallbacks (decks, accessories)', () => {
    expect(resolveItemIcon(undefined, { name: 'Mega Gardevoir Deck' }, manifest)).toEqual({ kind: 'builtin', id: 'deck' })
    expect(resolveItemIcon(undefined, { name: 'X (card sleeve)' }, manifest)).toEqual({ kind: 'builtin', id: 'sleeve' })
    expect(resolveItemIcon(undefined, { name: 'X (Pokémon coin)' }, manifest)).toEqual({ kind: 'builtin', id: 'coin' })
  })
  it('emblems', () => {
    expect(resolveItemIcon('EMBLEM_100590_MEGAMEWTWOX', {}, manifest)).toMatchObject({ kind: 'image', path: 'items/emblems/megamewtwoxemblem.png' })
    expect(resolveItemIcon('EMBLEM_100610_MEGAGEKKOUGA', {}, manifest)).toMatchObject({ path: 'items/emblems/megagreninja.png' })
    expect(resolveItemIcon('EMBLEM_100620_ABURIBBON', {}, manifest)).toMatchObject({ path: 'items/emblems/ribombee.png' })
    expect(resolveItemIcon('EMBLEM_100570_MEGALIZARDONX', {}, manifest)).toMatchObject({ path: 'items/emblems/megacharizardx.png' })
    expect(resolveItemIcon('EMBLEM_100600_PIKACHU', {}, manifest)).toMatchObject({ path: 'items/emblems/pikachuver6.png' }) // newest first
    expect(resolveItemIcon('EMBLEM_100580_MegaEvolution', {}, manifest)).toEqual({ kind: 'builtin', id: 'emblem' })
    expect(resolveItemIcon('EMBLEM_100630_HIBANNY', {}, manifest)).toEqual({ kind: 'builtin', id: 'emblem' }) // not listed
  })
  it('event emblems match the event name and grade', () => {
    expect(matchEmblem('EMBLEM_1_EVENT3_GOL', 'Mythical Island Emblem Event', manifest.emblems)).toBe('items/emblems/mi-gol.png')
    expect(matchEmblem('EMBLEM_1_EVENT3_NOR', 'Mythical Island Emblem Event', manifest.emblems)).toBe('items/emblems/mi-nor.png')
    expect(matchEmblem('EMBLEM_101430_EVENT16_NOR', 'Dual Fusion Emblem Event', manifest.emblems)).toBeUndefined()
    expect(matchEmblem('EMBLEM_101430_EVENT16_NOR', undefined, manifest.emblems)).toBeUndefined()
  })
})
