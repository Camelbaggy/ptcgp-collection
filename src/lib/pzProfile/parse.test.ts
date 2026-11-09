import { describe, expect, it } from 'vitest'
import {
  detectPzPage, parsePzDate, parsePzHome, parsePzNumber, parsePzStats, parsePzThemed, parsePzWishlist,
} from './parse'

const ICON = 'https://assets.example/game-assets/UI/Textures/System/ItemIcons'
const item = (group: string, id: string, amount: string) =>
  `<div class="icon-list__item"><span class="common-item-icon" style="--common-item-preview--image-url: url(${ICON}/${group}/${id}.webp);">` +
  `<span class="common-item-icon__preview"><span class="common-item-icon__amount">${amount}</span></span></span></div>`

const header = (extra = '') =>
  `<div class="player-detail-header"><div class="player-detail-header__name">Tester</div>` +
  `<div class="player-detail-header__level">Lv. 12</div>` +
  `<div class="player-detail-header__friend"><span class="font-bold">Friend ID:</span> 1111-2222-3333-4444 <button></button></div>` +
  `<div class="player-detail-header__synced">Last synced: 06/11/2026</div>${extra}</div>`

const wrap = (inner: string, withHeader = true) => `<main class="pz-content">${withHeader ? header() : ''}${inner}</main>`

const homeInner =
  `<h2>Card Stats</h2><div>` +
  `<div class="grid text-center lh-1"><div><span class="fs-2 font-bold relative">99.9<span>%</span></span></div><div class="text-muted smaller">1396/1398</div><div><span class="rarity-icon rarity-icon--rarity-C "></span></div></div>` +
  `<div class="grid text-center lh-1"><div><span class="fs-2 font-bold relative">0<span>%</span></span></div><div class="text-muted smaller">0/3</div><div><span class="rarity-icon rarity-icon--rarity-AN "><span class="rarity-icon__text">AN</span></span></div></div>` +
  `</div>` +
  `<h2 class="mb-2">Currencies</h2><div class="icon-list">${item('Currency', 'SHOPTICKET', '1 633')}${item('Currency', 'SHINEDUST', '115K')}</div>` +
  `<h2 class="mb-2">Tickets</h2><div class="icon-list">${item('RewardTicket', 'TICKET_X', '1')}</div>` +
  `<h2 class="mb-2">Hourglasses</h2><div class="icon-list">${item('PackPowerCharger', 'PACK_CHARGER_1', '15')}</div>` +
  `<h2 class="mb-2">Pack Points</h2><div class="icon-list">` +
  `<div class="icon-list__item"><div class="expansion-icon expansion-icon--id-A1"><img src="https://x/Exp/LOGO_expansion_A1_en_US.webp"></div><div class="product-price-bar"><div class="product-price-bar__price">40</div></div></div>` +
  `<div class="icon-list__item"><div class="expansion-icon expansion-icon--id-B4b"><img src="https://x/Exp/LOGO_expansion_B4b_en_US.webp"></div><div class="product-price-bar"><div class="product-price-bar__price">1 110</div></div></div></div>` +
  `<h2 class="mb-2">Trophies</h2><div class="trophy-summary-list">` +
  `<div class="trophy-summary trophy-summary--is-locked" style="--trophy-summary--image-url: url(https://x/Trophy/TROPHY_1_A.webp);"><div class="trophy-summary__text">Unknown</div></div>` +
  `<div class="trophy-summary" style="--trophy-summary--image-url: url(https://x/Trophy/TROPHY_2_B.webp);"><div class="trophy-summary__text">Shared 100 times</div></div></div>`

const tile = (v: string, l: string, rank = '', flat = false) =>
  `<div class="player-stats__tile${flat ? ' player-stats__tile--flat' : ''}"><div class="player-stats__tile-value">${v}</div><div class="player-stats__tile-label">${l}</div>${rank}</div>`
const rank = `<div class="player-stats__rank">#1 086<span class="player-stats__rank-of"> of 5 602</span><span class="player-stats__rank-pct"> · top 19%</span></div>`
const barRow = (label: string, value: string, unit: string, sec = '') =>
  `<div class="player-stats__bar-row"><div class="player-stats__bar-label">${label}</div>` +
  `<div class="player-stats__bar-value">${value}${unit ? `<span class="player-stats__bar-unit"> ${unit}</span>` : ''}</div>` +
  `<div class="player-stats__bar-track"></div>${sec ? `<div class="player-stats__bar-secondary">${sec}</div>` : ''}</div>`

const statsInner =
  `<div class="player-stats"><h1>Stats</h1><div class="player-stats__meta"><span>Lifetime counters from the game, as of 06/11/2026.</span></div>` +
  `<div class="player-stats__tiles">${tile('7 092', 'Packs opened', rank)}${tile('61', 'Player level')}</div>` +
  `<section><h2>Battles</h2><div class="player-stats__tiles">${tile('54.7%', 'Versus win rate', '<div class="player-stats__rank">1 620 / 2 959</div>', true)}${tile('2 959', 'Versus battles', '', true)}</div></section>` +
  `<section><h2>Packs opened by set</h2>${barRow(
    `<a href="https://x/sets/a1a/"><span class="player-stats__expansion"><img src="https://x/Exp/LOGO_expansion_A1a_en_US.webp"><span>Mythical Island</span></span></a>`,
    '149', 'packs', '857 cards · 77 unique')}</section>` +
  `<section><h2>Packs opened by pack</h2>${barRow(
    `<span class="player-stats__pack"><img src="https://x/Pack/PACK_ICON_AN005_0010_00_000.webp"><span>Shining Revelry</span></span>`, '350', 'packs')}</section>` +
  `<section><h2>Cards by rarity</h2>${barRow(
    `<span class="player-stats__rarity"><span class="rarity-icon rarity-icon--rarity-AR "></span> <span>Art Rare</span></span>`, '1 024', '', '334 unique')}</section>` +
  `<section><h2>Cards by type</h2>${barRow(`<span class="player-stats__type"><span class="energy-icon"></span> <span>Colorless</span></span>`, '5 349', '', '482 unique')}` +
  `<h3>Trainers</h3>${barRow('Supporter', '1 239', '', '170 unique')}</section>` +
  `<section><h2>Special cards</h2>${barRow('Ultra Beasts', '293', '', '40 unique')}</section></div>`

const colHead = (state: 'completed' | 'incomplete', title: string, rewards: string, meta: string) =>
  `<div class="theme-collection-mission-card player-themed-collections__collection player-themed-collections__collection--${state}" style="background-image: url(&quot;https://x/bg.webp&quot;);">` +
  `<div class="theme-collection-mission-card__header"><div class="theme-collection-mission-card__title">${title}</div>` +
  `<div class="theme-collection-mission-card__rewards"><div class="icon-list">${rewards}</div></div>` +
  `<div><div class="player-themed-collections__meta">${meta}</div></div></div>`
const fig = (state: 'owned' | 'missing', href: string, file: string, name: string) =>
  `<figure class="theme-collection-mission-card__card player-themed-collections__slot player-themed-collections__slot--${state}">` +
  `<div class="game-card-image"><a href="https://x${href}x/" class="game-card-image__link"><img class="game-card-image__img" src="https://x/game-assets/CardPreviews/${file}.webp"></a></div>` +
  `<figcaption>${name}</figcaption></figure>`

const themedInner =
  `<div class="player-detail-tab player-themed-collections"><div class="player-themed-collections__header-stats">` +
  `<div class="player-themed-collections__stat"><div class="player-themed-collections__stat-value">1 <span class="player-themed-collections__of">/ 2</span></div><div class="player-themed-collections__stat-label">Completed</div></div>` +
  `<div class="player-themed-collections__stat"><div class="player-themed-collections__stat-value">1</div><div class="player-themed-collections__stat-label">Missing cards</div></div></div>` +
  `<section class="player-themed-collections__expansion"><header><img class="player-themed-collections__expansion-logo" src="https://x/Exp/LOGO_expansion_C1_en_US.webp">` +
  `<div><h2 class="pz-section-header__title">Dual Fusion</h2><div class="player-themed-collections__expansion-progress"><span>1 / 2 completed</span></div></div></header><div>` +
  colHead('completed', 'The Path to <a class="localized-string__link" href="https://x/p/">Mewtwo ex</a> (★★★) Step 5/5',
    `<span class="common-item-icon" style="--common-item-preview--image-url: url(https://x/game-assets/CardRenders3D/cPK_20_000001_02_MEWTWOex_IM.1a2b3c4d.webp);"><span class="common-item-icon__amount">1</span></span>`,
    `<span class="player-themed-collections__badge--completed">Completed</span><span class="theme-collection-mission-card__count">70 Cards</span>`) +
  `<button>Show 6 owned cards</button></div>` +
  colHead('incomplete', 'Mega Thing &amp; Co', item('Currency', 'SHOPTICKET', '10'),
    `<span class="player-themed-collections__badge--incomplete">1 card missing</span><span class="theme-collection-mission-card__count">2 Cards</span><span class="player-themed-collections__secret">Secret</span>`) +
  `<div class="theme-collection-mission-card__requirements"><div class="theme-collection-mission-card__cards">` +
  fig('missing', '/cards/c1/178/', 'cPK_20_022620_01_MEGA_SAR', 'Mega Thing ex') + fig('owned', '/cards/c1/145/', 'cPK_20_022520_00_YOGI_AR', 'Larvitar') +
  `</div></div></div></div></section></div>`

const wishInner =
  `<h1 class="text-left">Wishlist</h1><div class="player-wishlist-card-list card-grid">` +
  [1, 2].map((n) => `<div class="player-wishlist-card-list__item block"><div class="game-card-image"><img class="game-card-image__img" src="https://x/CardRenders3D/cTR_20_00000${n}_00_X_SR.eb2d7d89.webp"></div></div>`).join('') +
  `</div>`

describe('nombres et dates', () => {
  it('lit les formats de la page', () => {
    expect(parsePzNumber('1 633')?.value).toBe(1633)
    expect(parsePzNumber('1 633')?.value).toBe(1633)
    expect(parsePzNumber('7 092')?.value).toBe(7092)
    expect(parsePzNumber('115K')).toEqual({ value: 115000, approx: true })
    expect(parsePzNumber('1.2M')).toEqual({ value: 1200000, approx: true })
    expect(parsePzNumber('54.7%')).toEqual({ value: 54.7, approx: false })
    expect(parsePzNumber('#1 086')?.value).toBe(1086)
    expect(parsePzNumber('abc')).toBeNull()
  })
  it('date JJ/MM/AAAA', () => {
    expect(parsePzDate('06/11/2026')).toBe('2026-11-06')
    expect(parsePzDate('6/1/2026')).toBe('2026-01-06')
    expect(parsePzDate('31/13/2026')).toBeNull()
  })
})

describe('detectPzPage', () => {
  it('par adresse enregistrée', () => {
    const mht = (u: string) => `From: <Saved by Blink>\nSnapshot-Content-Location: ${u}\nMIME-Version: 1.0\n\n<html></html>`
    expect(detectPzPage(mht('https://www.pokemon-zone.com/players/123/'))).toBe('home')
    expect(detectPzPage(mht('https://www.pokemon-zone.com/players/123/stats/'))).toBe('stats')
    expect(detectPzPage(mht('https://www.pokemon-zone.com/players/123/themed-collections/'))).toBe('themed')
    expect(detectPzPage(mht('https://www.pokemon-zone.com/players/123/wishlist/'))).toBe('wishlist')
    expect(detectPzPage(mht('https://www.pokemon-zone.com/players/123/sets/C1/'))).toBe('set')
    expect(detectPzPage(mht('https://www.pokemon-zone.com/players/123/decks/'))).toBeNull()
    expect(detectPzPage('<!-- saved from url=(0058)https://www.pokemon-zone.com/players/9/stats/ --><html></html>')).toBe('stats')
    expect(detectPzPage('<link rel="canonical" href="https://www.pokemon-zone.com/players/9/wishlist/"><body></body>')).toBe('wishlist')
  })
  it('par repères du contenu (main seul)', () => {
    expect(detectPzPage(wrap(homeInner))).toBe('home')
    expect(detectPzPage(wrap(statsInner))).toBe('stats')
    expect(detectPzPage(wrap(themedInner))).toBe('themed')
    expect(detectPzPage(wrap(wishInner))).toBe('wishlist')
    expect(detectPzPage('<main><div class="player-expansion-collection-card"></div></main>')).toBe('set')
    expect(detectPzPage('<main><p>rien</p></main>')).toBeNull()
  })
})

describe('parsePzHome', () => {
  const h = parsePzHome(wrap(homeInner))
  it('en-tête', () => {
    expect(h.name).toBe('Tester')
    expect(h.level).toBe(12)
    expect(h.friendId).toBe('1111-2222-3333-4444')
    expect(h.syncedAt).toBe('2026-11-06')
  })
  it('raretés, monnaies, points, trophées', () => {
    expect(h.rarityProgress).toEqual([
      { code: 'C', rarity: 'D1', owned: 1396, total: 1398 },
      { code: 'AN', owned: 0, total: 3 },
    ])
    expect(h.currencies).toEqual([
      { group: 'Currency', id: 'SHOPTICKET', amount: 1633 },
      { group: 'Currency', id: 'SHINEDUST', amount: 115000, approx: true },
    ])
    expect(h.tickets).toEqual([{ group: 'RewardTicket', id: 'TICKET_X', amount: 1 }])
    expect(h.hourglasses[0]).toEqual({ group: 'PackPowerCharger', id: 'PACK_CHARGER_1', amount: 15 })
    expect(h.packPoints).toEqual([{ setCode: 'A1', points: 40 }, { setCode: 'B4b', points: 1110 }])
    expect(h.trophies).toEqual([
      { id: 'TROPHY_1_A', label: 'Unknown', locked: true },
      { id: 'TROPHY_2_B', label: 'Shared 100 times', locked: false },
    ])
  })
  it('sans en-tête ni sections', () => {
    const e = parsePzHome(wrap('<p>vide</p>', false))
    expect(e).toEqual({
      name: '', level: null, friendId: null, syncedAt: null, rarityProgress: [], currencies: [],
      tickets: [], hourglasses: [], packPoints: [], trophies: [],
    })
  })
})

describe('parsePzStats', () => {
  const s = parsePzStats(wrap(statsInner))
  it('compteurs et combats', () => {
    expect(s.asOf).toBe('2026-11-06')
    expect(s.counters).toEqual([
      { key: 'packs-opened', label: 'Packs opened', value: 7092, rank: { rank: 1086, of: 5602, topPct: 19 } },
      { key: 'player-level', label: 'Player level', value: 61 },
    ])
    expect(s.battles[0]).toEqual({ key: 'versus-win-rate', label: 'Versus win rate', value: 54.7, detail: '1 620 / 2 959' })
    expect(s.battles[1].value).toBe(2959)
  })
  it('barres', () => {
    expect(s.packsBySet).toEqual([{ setCode: 'A1a', name: 'Mythical Island', packs: 149, cards: 857, unique: 77 }])
    expect(s.packsByPack).toEqual([{ packIcon: 'PACK_ICON_AN005_0010_00_000', name: 'Shining Revelry', packs: 350 }])
    expect(s.byRarity[0]).toMatchObject({ label: 'Art Rare', code: 'AR', rarity: 'E1', value: 1024, unique: 334 })
    expect(s.byType).toHaveLength(1)
    expect(s.byType[0]).toMatchObject({ label: 'Colorless', value: 5349, unique: 482 })
    expect(s.trainers[0]).toMatchObject({ label: 'Supporter', value: 1239, unique: 170 })
    expect(s.special[0]).toMatchObject({ label: 'Ultra Beasts', value: 293 })
  })
  it('page vide', () => {
    expect(parsePzStats(wrap('', false))).toEqual({
      asOf: null, counters: [], battles: [], packsBySet: [], packsByPack: [], byRarity: [], byType: [], trainers: [], special: [],
    })
  })
})

describe('parsePzThemed', () => {
  const t = parsePzThemed(wrap(themedInner))
  it('totaux et sections', () => {
    expect(t.completed).toBe(1)
    expect(t.total).toBe(2)
    expect(t.missingCards).toBe(1)
    expect(t.sections).toEqual([{ setCode: 'C1', name: 'Dual Fusion', completed: 1, total: 2 }])
  })
  it('collections', () => {
    expect(t.collections).toHaveLength(2)
    expect(t.collections[0]).toEqual({
      title: 'The Path to Mewtwo ex (★★★) Step 5/5', setCode: 'C1', completed: true, missing: 0, cardCount: 70, secret: false,
      rewards: [{ group: 'Card', id: 'cPK_20_000001_02_MEWTWOex_IM', amount: 1 }], cards: [],
    })
    expect(t.collections[1]).toEqual({
      title: 'Mega Thing & Co', setCode: 'C1', completed: false, missing: 1, cardCount: 2, secret: true,
      rewards: [{ group: 'Currency', id: 'SHOPTICKET', amount: 10 }],
      cards: [
        { href: '/cards/c1/178/', image: 'cPK_20_022620_01_MEGA_SAR', name: 'Mega Thing ex', owned: false },
        { href: '/cards/c1/145/', image: 'cPK_20_022520_00_YOGI_AR', name: 'Larvitar', owned: true },
      ],
    })
  })
  it('page vide', () => {
    expect(parsePzThemed(wrap('', false))).toEqual({ completed: 0, total: 0, missingCards: 0, sections: [], collections: [] })
  })
})

describe('parsePzWishlist', () => {
  it('images sans empreinte ni extension', () => {
    expect(parsePzWishlist(wrap(wishInner)).images).toEqual(['cTR_20_000001_00_X_SR', 'cTR_20_000002_00_X_SR'])
  })
  it('liste vide', () => { expect(parsePzWishlist(wrap('<h1>Wishlist</h1>')).images).toEqual([]) })
})

describe('fichier .mht quoted-printable', () => {
  it('décode puis lit (UTF-8 compris)', () => {
    const html = wrap(wishInner + `<div class="player-detail-header__name">Café</div>`)
    const utf8 = new TextEncoder().encode(html)
    let qp = ''
    for (const b of utf8) qp += b === 0x3d || b > 0x7e ? '=' + b.toString(16).toUpperCase().padStart(2, '0') : String.fromCharCode(b)
    qp = qp.replace(/(.{70})/g, '$1=\n')
    const mht = `From: <Saved by Blink>\nSnapshot-Content-Location: https://www.pokemon-zone.com/players/1/wishlist/\n` +
      `Content-Type: text/html\nContent-Transfer-Encoding: quoted-printable\n\n${qp}`
    expect(detectPzPage(mht)).toBe('wishlist')
    expect(parsePzWishlist(mht).images).toHaveLength(2)
    expect(parsePzHome(mht).name).toBe('Tester')
  })
})
