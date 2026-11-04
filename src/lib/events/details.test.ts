import { describe, expect, it } from 'vitest'
import { mergeImports, mergeRelated, parsePokemonZoneSchedule as parse, type ImportedEvent } from './pokemonZone'
import { itemLabelFr, translateMission, translateRules } from './translate'

const date = (s: string, e: string) =>
  `<span class="banner-date"><span class="banner-date__dates js-local-date-range-app" data-start="${s}" data-end="${e}"><span>x</span></span></span>`
const link = (slug: string, n: number) => `<a href="https://www.pokemon-zone.com/cards/${slug}/${n}/foo/"></a>`
const icon = (file: string) => `style="--common-item-preview--image-url: url(https://assets.pokemon-zone.com/game-assets/UI/Textures/System/ItemIcons/${file}.webp);"`
const mission = (txt: string, tgt: number, file: string, amt: number) =>
  `<div class="mission-list-card mission-list-card--type-X"><div class="mission-list-card__preview"><span class="common-item-icon"><span class="common-item-preview" ${icon(file)}></span><span class="common-item-icon__amount"> ${amt} </span></span></div><div class="mission-list-card__text">${txt}</div><div class="progress-bar__text">0/${tgt}</div></div>`
const shopItem = (name: string, price: number, card?: [string, number]) =>
  `<div class="shop-group-card__item"><div class="shop-group-card__content shop-group-card__content--type-pokemon_card">${card ? link(...card) : ''}<div class="shop-group-card__content-name"> ${name} </div></div><div class="shop-group-card__item-price"><div class="product-price-bar" style="--product-price-bar--icon-url: url('https://x/ItemIcons/Currency/SHOPTICKET.webp?w=1');"><div class="product-price-bar__price"> ${price} </div></div></div></div>`
const gold = (id: string, name: string, s: string, e: string, price: string, amt: number) =>
  `<div id="poke_gold_offer_${id}" class="gold-shop-product-card"><div class="gold-shop-product-card__price"><div class="product-price-bar"><div class="product-price-bar__price"> ${price} </div></div></div>` +
  `<div class="gold-shop-product-card__items"><div class="gold-shop-product-card__item"><span class="common-item-preview" ${icon('Currency/POKEGOLD')}></span><div class="gold-shop-product-card__item-amount"> ${amt} </div></div>` +
  `<div class="gold-shop-product-card__item"><div class="gold-shop-product-card__item-bonus"> Bonus </div><span class="common-item-preview" ${icon('Currency/POKEGOLD')}></span><div class="gold-shop-product-card__item-amount"> 5 </div></div></div>` +
  `<div class="gold-shop-product-card__name"> ${name} </div>${date(s, e)}</div>`

const D = { a: ['2026-10-30T06:00:00+0000', '2026-11-13T06:00:00+0000'], b: ['2026-10-30T06:00:00+0000', '2026-11-20T06:00:00+0000'] }
const HTML = `<html><body>
<div class="schedule-listing__group"><h3 id="October_2026_Shops">Shops</h3>
 <div id="shops_1" class="shop-group-card"><h3 class="mb-1">PROMO Reissue Drop Event 2026 Shop - Reissue Drop Event</h3>${date(...(D.b as [string, string]))}
  <div class="shop-group-card__items">${shopItem('Torchic', 1, ['promo-b', 2])}${shopItem('Pack Hourglass', 3)}</div></div>
</div>
<div class="schedule-listing__group"><h3 id="October_2026_Missions">Missions</h3>
 <div id="missions_1" class="grid"><div class="fs-3 font-bold">PROMO Reissue Drop Event 2026 Missions</div>${date(...(D.a as [string, string]))}
  <div class="mission-list">${mission('Log in (Day 1)', 1, 'Currency/PREMIUM_TICKET', 1)}${mission('Wonder pick 3 times', 3, 'Currency/SHINEDUST', 200)}</div></div>
</div>
<div class="schedule-listing__group"><h3 id="October_2026_Events">Events</h3>
 <div id="event_x" class="solo-battle-group-card"><div class="solo-battle-group-card__heading-title">PROMO Reissue Drop Event 2026</div>${date(...(D.a as [string, string]))}${link('promo-b', 3)}</div>
</div>
<div class="schedule-listing__group"><h3 id="October_2026_Poke_Gold_Offers">Gold</h3>
 ${gold('1', 'Sale: Poké Gold (paid) ×30 Deal', '2026-11-23T06:00:00+0000', '2026-12-06T06:00:00+0000', '$5.99', 30)}
 ${gold('2', 'Poké Gold (paid) ×115 + Accessories (Hoopa)', '2026-11-20T06:00:00+0000', '2026-12-16T06:00:00+0000', '$22.99', 115)}
 ${gold('3', 'Poké Gold (paid) ×35 Deal', '2026-09-30T06:00:00+0000', '2026-10-29T06:00:00+0000', '$7.99', 35)}
</div></body></html>`
const o = { cardIds: new Set(['P-B-2', 'P-B-3']), setIds: ['P-B'] }

describe('merging parts of one event', () => {
  const ev = parse(HTML, o)
  it('merges shop + event + missions into one', () => {
    const drop = ev.filter((e) => e.group !== 'gold')
    expect(drop).toHaveLength(1)
    expect(drop[0]).toMatchObject({ name: 'PROMO Reissue Drop Event 2026', type: 'drop', start: '2026-10-30T06:00:00.000Z', end: '2026-11-20T06:00:00.000Z' })
    expect(drop[0].cardIds).toEqual(['P-B-2'])
    expect(drop[0].missions).toHaveLength(2)
    expect(drop[0].shopItems?.map((i) => i.name)).toEqual(['Torchic', 'Pack Hourglass'])
    expect(drop[0].shopItems?.[0]).toMatchObject({ price: 1, currency: 'SHOPTICKET', cardId: 'P-B-2' })
  })
  it('groups Poké Gold offers per overlapping period', () => {
    const g = ev.filter((e) => e.group === 'gold')
    expect(g).toHaveLength(2)
    const big = g.find((e) => e.offers!.length === 2)!
    expect(big).toMatchObject({ name: 'Poké Gold Offers', nameFr: 'Offres Poké Lingots', type: 'shop', start: '2026-11-20T06:00:00.000Z', end: '2026-12-16T06:00:00.000Z' })
    expect(big.offers![0]).toMatchObject({ price: '$22.99', items: [{ item: 'POKEGOLD', amount: 115 }, { item: 'POKEGOLD', amount: 5, bonus: true }] })
    expect(g.find((e) => e.offers!.length === 1)!.offers![0].name).toBe('Poké Gold (paid) ×35 Deal')
  })
  it('is idempotent and merges old rows without details', () => {
    expect(mergeRelated(ev)).toEqual(ev)
    expect(mergeImports([ev, ev])).toHaveLength(ev.length)
    const mk = (id: string, name: string, group: string, s: string, e: string): ImportedEvent =>
      ({ id, name, nameFr: name, type: 'special', start: s, end: e, source: 'pokemon-zone', group })
    const old = [
      mk('1', 'X Shop', 'shops', '2026-11-01T00:00:00Z', '2026-11-10T00:00:00Z'),
      mk('2', 'X', 'event', '2026-11-01T00:00:00Z', '2026-11-05T00:00:00Z'),
      mk('3', 'X Missions', 'missions', '2026-11-01T00:00:00Z', '2026-11-05T00:00:00Z'),
      mk('4', 'X', 'event', '2026-12-01T00:00:00Z', '2026-12-05T00:00:00Z'), // same name, other period: kept apart
      mk('5', 'Poké Gold (paid) ×35 Deal', 'gold', '2026-11-01T00:00:00Z', '2026-11-05T00:00:00Z'),
      mk('6', 'Sale: Poké Gold (paid) ×100 Deal', 'gold', '2026-11-03T00:00:00Z', '2026-11-08T00:00:00Z'),
    ]
    const r = mergeRelated(old)
    expect(r.map((e) => e.name).sort()).toEqual(['Poké Gold Offers', 'X', 'X'])
    expect(r.find((e) => e.group === 'gold')!.offers).toHaveLength(2)
    expect(r.find((e) => e.id === '2')).toMatchObject({ end: '2026-11-10T00:00:00Z' })
  })
})

describe('missions', () => {
  it('parses text, target and reward icon', () => {
    const m = parse(HTML, o).find((e) => e.type === 'drop')!.missions!
    expect(m[0]).toEqual({ text: 'Log in (Day 1)', target: 1, reward: { item: 'PREMIUM_TICKET', amount: 1 } })
    expect(m[1]).toEqual({ text: 'Wonder pick 3 times', target: 3, reward: { item: 'SHINEDUST', amount: 200 } })
  })
  it('translates simple patterns, else keeps the original', () => {
    expect(translateMission('Log in (Day 1)')).toBe('Se connecter (jour 1)')
    expect(translateMission('Wonder pick 3 times')).toBe('Pioche miracle 3 fois')
    expect(translateMission('Wonder pick 1 time')).toBe('Pioche miracle 1 fois')
    expect(translateMission('Participate in 5 battles')).toBe('Participer à 5 combats')
    expect(translateMission('Win 1 battle')).toBe('Gagner 1 combat')
    expect(translateMission('Collect 11 Grass cards')).toBe('Obtenir 11 cartes de type Plante')
    expect(translateMission('Use pack stamina to open 2 booster packs')).toBe('Utiliser l’endurance de pack pour ouvrir 2 boosters')
    expect(translateMission('Trade 1 time')).toBe('Échanger 1 fois')
    expect(translateMission('Share 3 times')).toBe('Partager 3 fois')
    expect(translateMission('Peaceful Naps')).toBe('Peaceful Naps')
  })
  it('labels reward icons and rules', () => {
    expect(itemLabelFr('POKEGOLD')).toBe('Poké Lingots')
    expect(itemLabelFr('SHINEDUST')).toBe('Poussière scintillante')
    expect(itemLabelFr('PACK_CHARGER_100030')).toBe('Sablier de booster')
    expect(itemLabelFr('CHALLENGE_CHARGER_110030')).toBe('Sablier de pioche')
    expect(itemLabelFr('EMBLEM_101440_EVENT16_BRZ')).toBe('Emblème bronze')
    expect(itemLabelFr('whatever')).toBe('Objet')
    expect(translateRules('Only cards from Dual Fusion can be used, and promo cards are not allowed. These cards are the exception and can be used too:'))
      .toBe('Seules les cartes de Dual Fusion sont autorisées, sans cartes promo. Exceptions autorisées :')
  })
})
