import { describe, expect, it } from 'vitest'
import { mergeImports, parsePokemonZoneSchedule as parse, setIdFromSlug } from './pokemonZone'
import { mergeEvents } from '../../features/events/useEvents'
import { translateEventName as t } from './translate'

const date = (s: string, e: string) =>
  `<span class="banner-date"><span class="banner-date__dates js-local-date-range-app" data-start="${s}" data-end="${e}" data-show-end-year="true"><span>x</span></span></span>`
const link = (slug: string, n: number) => `<a href="https://www.pokemon-zone.com/cards/${slug}/${n}/foo/"></a>`

const HTML = `<html><head><script>var a = '<h3 id="X_2026_Shops">';</script></head><body>
<h2>Upcoming Expansions</h2>
<a href="https://www.pokemon-zone.com/sets/c2/" class="link-no-style"><div class="expansion-pack-set-card x">
 <div class="expansion-pack-set-card__title"> C2 Preview <span class="tag">in 1mo</span>
 <span class="block">Releases <span class="js-local-date-range-app" data-start="2026-12-16T00:02:00+0000" data-show-end-year="true">16 déc.</span></span></div></div></a>
<div class="schedule-listing__group"><h3 id="November_2026_Shops">Shops</h3>
 <div id="shops_A_Cards" class="shop-group-card"><h3 class="mb-1">Promo Pack C Vol. 1 Shop - Cards</h3>${date('2026-11-18T06:00:00+0000', '2026-12-09T06:00:00+0000')}
  ${link('promo-c', 2)}${link('promo-c', 3)}${link('promo-c', 2)}${link('zz9', 1)}</div>
 <div id="shops_A_Items" class="shop-group-card"><h3 class="mb-1">Promo Pack C Vol. 1 Shop - Items</h3>${date('2026-11-18T06:00:00+0000', '2026-12-09T06:00:00+0000')}</div>
 <div id="shops_P" class="shop-group-card"><h3 class="mb-1">Premium Shop C1 Pikachu - Cards</h3>${date('2026-11-01T06:00:00+0000', '3000-12-31T00:00:00+0000')}${link('c1', 5)}</div>
</div>
<div class="schedule-listing__group"><h3 id="November_2026_Poke_Gold_Offers">Poke Gold Offers</h3>
 <div id="poke_gold_offer_x" class="gold-shop-product-card"><div class="gold-shop-product-card__name"> Sale: Poké Gold (paid) ×100 Deal </div>${date('2026-11-23T06:00:00+0000', '2026-12-06T06:00:00+0000')}</div>
</div>
<div class="schedule-listing__group"><h3 id="November_2026_PvpEmblemBattles">PVP Emblem Battles</h3>
 <div class="mission-group pvp-emblem-event"><h3 class="mission-group__name pvp-emblem-event__name">Dual Fusion Emblem Event</h3>${date('2026-11-06T06:00:00+0000', '2026-11-16T06:00:00+0000')}</div>
 <div class="mission-group"><h3 class="mission-group__name">Dual Fusion (C1) Limited Battles</h3>${date('2026-11-18T06:00:00+0000', '2026-12-02T06:00:00+0000')}${link('c1', 30)}</div>
</div>
<div class="schedule-listing__group"><h3 id="November_2026_Missions">Missions</h3>
 <div id="missions_1" class="grid"><div class="fs-3 font-bold">Bonus Week November 2026</div>${date('2026-11-14T06:00:00+0000', '2026-11-21T06:00:00+0000')}</div>
 <div id="missions_2" class="grid"><div class="fs-3 font-bold">Daily missions</div>${date('2026-11-14T06:00:00+0000', '2026-11-21T06:00:00+0000')}</div>
 <div id="missions_3" class="grid"><div class="fs-3 font-bold">&quot;Vee Vee! Eevee&quot; event Missions</div>${date('2026-11-21T06:00:00+0000', '2026-12-15T06:00:00+0000')}</div>
</div>
<div class="schedule-listing__group"><h3 id="October_2026_WonderPicks">Wonder Picks</h3>
 <div id="picks_a__b" class="grid feed-pack-card"><div class="fs-3 font-bold">Charmander Wonder Pick event</div>${date('2026-10-30T06:00:00+0000', '2026-11-13T06:00:00+0000')}${link('a1', 4)}${link('promo-b', 7)}</div>
</div>
<div class="article-content-menu">${link('a1', 99)}</div></body></html>`

const cardIds = new Set(['P-C-2', 'P-C-3', 'C1-30', 'A1-4', 'P-B-7', 'C1-5'])

describe('parsePokemonZoneSchedule', () => {
  const ev = parse(HTML, { cardIds, setIds: ['A1', 'C1', 'P-B', 'P-C'] })
  const by = (n: string) => ev.find((e) => e.name === n)!
  it('parses events, skipping noise', () => {
    expect(ev.map((e) => e.name).sort()).toEqual([
      'Bonus Week November 2026', 'C2', 'Charmander Wonder Pick event', 'Dual Fusion (C1) Limited Battles', 'Dual Fusion Emblem Event',
      'Poké Gold Offers', 'Promo Pack C Vol. 1 Shop - Cards', '"Vee Vee! Eevee" event Missions',
    ].sort())
    expect(ev.every((e) => e.source === 'pokemon-zone' && /^pz-/.test(e.id))).toBe(true)
  })
  it('maps cards, drops unknown ones and dedupes', () => {
    expect(by('Promo Pack C Vol. 1 Shop - Cards').cardIds).toEqual(['P-C-2', 'P-C-3'])
    expect(by('Charmander Wonder Pick event').cardIds).toEqual(['A1-4', 'P-B-7'])
    expect(by('Dual Fusion (C1) Limited Battles').cardIds).toEqual(['C1-30'])
  })
  it('types, dates and translations', () => {
    expect(by('Dual Fusion Emblem Event').type).toBe('emblem')
    expect(by('Charmander Wonder Pick event').type).toBe('wonderpick')
    expect(by('Poké Gold Offers')).toMatchObject({ type: 'shop', nameFr: 'Offres Poké Lingots' })
    expect(by('Poké Gold Offers').offers![0].name).toBe('Sale: Poké Gold (paid) ×100 Deal')
    expect(by('Bonus Week November 2026')).toMatchObject({ type: 'special', start: '2026-11-14T06:00:00.000Z', end: '2026-11-21T06:00:00.000Z', nameFr: 'Semaine bonus – novembre 2026' })
    expect(by('"Vee Vee! Eevee" event Missions').nameFr).toBe('Missions : « Vee Vee! Eevee »')
  })
  it('upcoming expansion', () => {
    expect(by('C2')).toMatchObject({ type: 'expansion', start: '2026-12-16T00:02:00.000Z' })
    const known = parse(HTML, { setIds: ['C2'] }).find((e) => e.type === 'expansion')!
    expect(known.setId).toBe('C2')
  })
  it('stable ids, and re-import merges', () => {
    const again = parse(HTML, { cardIds, setIds: ['A1', 'C1', 'P-B', 'P-C'] })
    expect(again.map((e) => e.id)).toEqual(ev.map((e) => e.id))
    expect(mergeImports([ev, again])).toHaveLength(ev.length)
  })
  it('returns [] for an unrelated page', () => expect(parse('<html><body>nothing</body></html>')).toEqual([]))
  it('maps set slugs', () => {
    expect(setIdFromSlug('a3b')).toBe('A3b')
    expect(setIdFromSlug('promo-a')).toBe('P-A')
    expect(setIdFromSlug('sp1', ['SP1'])).toBe('SP1')
  })
})

describe('mergeEvents', () => {
  const now = Date.parse('2026-11-04T00:00:00Z')
  const base = { id: 'x', name: 'n', cardIds: [], source: 'pokemon-zone' as const, nameFr: 'n', group: 'g' }
  it('prunes old events and prefers the imported expansion', () => {
    const imported = [
      { ...base, id: 'a', type: 'special' as const, start: '2026-09-01T00:00:00Z', end: '2026-09-20T00:00:00Z' },
      { ...base, id: 'b', type: 'special' as const, start: '2026-10-20T00:00:00Z', end: '2026-10-25T00:00:00Z' },
      { ...base, id: 'c', type: 'expansion' as const, start: '2026-12-16T00:02:00Z', end: '2026-12-16T00:02:00Z' },
    ]
    const rel = [{ id: 'expansion-2026-12-16', type: 'expansion' as const, name: 'Prochaine extension', start: '2026-12-16T06:00:00Z', end: '2026-12-16T06:00:00Z' }]
    expect(mergeEvents(imported, rel, now).map((e) => e.id)).toEqual(['b', 'c'])
    expect(mergeEvents([], rel, now).map((e) => e.id)).toEqual(['expansion-2026-12-16'])
  })
})

describe('translateEventName (Pokemon-Zone names)', () => {
  it('translates', () => {
    expect(t('Promo Pack C Vol. 1 Shop - Cards')).toBe('Boutique : Promo Pack C Vol. 1 – cartes')
    expect(t('December 2026 Premium Missions')).toBe('Missions premium – décembre 2026')
    expect(t('Winter Holidays Themed Promo Card Event Week1')).toBe('Carte promo thématique : Fêtes d’hiver (semaine 1)')
    expect(t('Dual Fusion (C1) Limited Battles')).toBe('Combats limités : Dual Fusion (C1)')
    expect(t('PROMO Reissue Drop Event 2026 Shop')).toBe('Boutique : Évènement drop : Réédition PROMO 2026')
    expect(t('Elite Deck Gift Missions C1')).toBe('Missions : Cadeau Deck Élite C1')
    expect(t('2nd Anniv.: Poké Gold (paid) ×200 Deal')).toBe('2e anniv. : Poké Lingots (payant) ×200')
  })
})
