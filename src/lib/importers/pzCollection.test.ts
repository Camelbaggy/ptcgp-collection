import { describe, expect, it } from 'vitest'
import type { Booster, Card } from '../types'
import { parsePzCollection, resolvePzCollection } from './pzCollection'

// Page synthétique qui reprend la structure d'une page « sets/<SET>/ » enregistrée (aucun extrait réel).
const block = (o: { slug: string; n: number; count?: number; name: string; kind: string; ent: number; variant?: string; rar: string }) =>
  `<div class="player-expansion-collection-card player-expansion-collection-card--${o.count ? 'is' : 'not'}-collected">` +
  `<a href="https://www.pokemon-zone.com/cards/${o.slug}/${o.n}/x/"><img src="./p_files/c${o.kind}_10_${String(o.ent).padStart(6, '0')}_${o.variant ?? '00'}_NAME_${o.rar}.webp"></a>` +
  (o.count ? `<div class="player-expansion-collection-card__count">${o.count}</div>` : '') +
  `<div class="player-expansion-collection-card__skin-count">7</div>` +
  `<div class="player-expansion-collection-card__name-text">${o.name}</div><span class="rarity-icon rarity-icon--rarity-${o.rar} "></span></div>`
const page = (setCode: string, blocks: string[]) =>
  `<!-- saved from url=(0062)https://www.pokemon-zone.com/players/123/sets/${setCode}/ --><html><body>${blocks.join('')}</body></html>`

const card = (id: string, rarity: Card['rarity'], entityId: number, boosterIds: string[], nameEn = id): Card => {
  const [setId, num] = [id.slice(0, id.lastIndexOf('-')), Number(id.slice(id.lastIndexOf('-') + 1))]
  return { id, setId, number: num, name: nameEn, nameEn, type: 'grass', stage: 'basic', rarity, boosterIds, entityId, entityKind: 'PK' } as Card
}

describe('parsePzCollection', () => {
  it('lit extension, numéros, exemplaires, entité et rareté', () => {
    const p = parsePzCollection(page('C1', [
      block({ slug: 'c1', n: 1, count: 13, name: 'Bulbasaur', kind: 'PK', ent: 21780, rar: 'C' }),
      block({ slug: 'c1', n: 5, count: 2, name: 'Alolan Exeggutor ex', kind: 'PK', ent: 21820, rar: 'RR' }),
      block({ slug: 'c1', n: 214, name: 'Bewear ex', kind: 'PK', ent: 22990, rar: 'SAR' }),
      block({ slug: 'c1', n: 150, count: 4, name: 'Serena&#8217;s Choice', kind: 'TR', ent: 1234, rar: 'U' }),
    ]))
    expect(p.setSlug).toBe('c1')
    expect(p.rows.map((r) => [r.number, r.count, r.rarity])).toEqual([[1, 13, 'D1'], [5, 2, 'D4'], [214, 0, 'E2'], [150, 4, 'D2']])
    expect(p.rows[0]).toMatchObject({ entityKind: 'PK', entityId: 21780, nameEn: 'Bulbasaur' })
    expect(p.rows[3]).toMatchObject({ entityKind: 'TR', nameEn: 'Serena’s Choice' })
  })
  it('signale une page incomplète (« Load More ») et lit les .mht', () => {
    const more = page('B4b', [block({ slug: 'b4b', n: 1, count: 2, name: 'Bulbasaur', kind: 'PK', ent: 13070, rar: 'C' })])
      .replace('</body>', '<div class="data-infinite-scroller__more mt-4 text-center"><button class="button">Load More</button></div></body>')
      .replace('_C.webp', '_C.c1723df7.webp')
    const mht = 'From: <Saved by Blink>\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n' + more.replace(/=/g, '=3D').replace(/(.{70})/g, '$1=\r\n')
    for (const p of [parsePzCollection(more), parsePzCollection(mht)]) {
      expect(p.hasMore).toBe(true)
      expect(p.rows).toHaveLength(1)
      expect(p.rows[0]).toMatchObject({ number: 1, count: 2, entityId: 13070, rarity: 'D1' })
    }
    expect(parsePzCollection(page('C1', [])).hasMore).toBe(false)
    expect(parsePzCollection(more.replace('text-center"', 'text-center d-none"')).hasMore).toBe(false)
  })
  it('ne trouve rien dans une autre page', () => {
    expect(parsePzCollection('<html><body>rien</body></html>').rows).toEqual([])
  })
})

describe('resolvePzCollection', () => {
  const boosters = [{ id: 'A1-Mewtwo', setId: 'A1', name: 'Mewtwo' }, { id: 'A4b-Unique', setId: 'A4b', name: 'Deluxe' }] as Booster[]
  const cards = [
    card('A1-1', 'D1', 10, ['A1-Mewtwo', 'A4b-Unique'], 'Bulbasaur'),
    card('A1-227', 'E1', 10, ['A1-Mewtwo'], 'Bulbasaur'),
    card('A4b-2', 'D1', 10, ['A4b-Unique'], 'Bulbasaur'), // version « Brillante »
    card('P-A-23', 'P', 10, [], 'Bulbasaur'),
    card('A1-2', 'D2', 20, ['A1-Mewtwo', 'A4b-Unique'], 'Ivysaur'),
    card('A4b-4', 'D1', 20, ['A4b-Unique'], 'Ivysaur'), // « Brillante », rareté différente de l'originale
  ]
  const setIds = ['A1', 'A4b', 'P-A']

  it('relie directement par le numéro', () => {
    const p = parsePzCollection(page('A1', [block({ slug: 'a1', n: 1, count: 3, name: 'Bulbasaur', kind: 'PK', ent: 10, rar: 'C' })]))
    const r = resolvePzCollection(p, cards, boosters, setIds)
    expect(r.setId).toBe('A1')
    expect(r.matches.map((m) => [m.card.id, m.row.count])).toEqual([['A1-1', 3]])
  })
  it('range les rééditions Deluxe sous leur carte d\'origine', () => {
    const p = parsePzCollection(page('A4b', [
      block({ slug: 'a4b', n: 1, count: 5, name: 'Bulbasaur', kind: 'PK', ent: 10, rar: 'C' }),
      block({ slug: 'a4b', n: 2, count: 1, name: 'Bulbasaur', kind: 'PK', ent: 10, variant: '01', rar: 'C' }),
      block({ slug: 'a4b', n: 3, count: 4, name: 'Ivysaur', kind: 'PK', ent: 20, rar: 'C' }), // réédition notée C dans le Deluxe
      block({ slug: 'a4b', n: 9, name: 'Unknown', kind: 'PK', ent: 99999, rar: 'C' }),
    ]))
    const r = resolvePzCollection(p, cards, boosters, setIds)
    expect(r.matches.map((m) => [m.row.number, m.card.id])).toEqual([[1, 'A1-1'], [2, 'A4b-2'], [3, 'A1-2']])
    expect(r.unknown.map((u) => u.number)).toEqual([9])
  })
})

describe('favori Pokémon-Zone', () => {
  it('lit les données envoyées par le favori', async () => {
    const { parsePzPayload } = await import('./pzCollection')
    const p = parsePzPayload(JSON.stringify({ v: 1, player: '6978334344383017', set: 'B4b', more: false, rows: [
      ['https://www.pokemon-zone.com/cards/b4b/1/bulbasaur/', 22, 'Bulbasaur', 'cPK_10_013070_00_FUSHIGIDANE_C.c1723df7.webp', 'C'],
      ['/cards/b4b/237/bulbasaur/', 0, 'Bulbasaur', 'cPK_10_013070_01_FUSHIGIDANE_C.webp', ''],
      ['', 3, 'sans lien', '', ''],
    ] }))![0]
    expect(p.setSlug).toBe('b4b')
    expect(p.hasMore).toBe(false)
    expect(p.playerId).toBe('6978334344383017')
    expect(p.rows).toEqual([
      { slug: 'b4b', number: 1, count: 22, nameEn: 'Bulbasaur', entityKind: 'PK', entityId: 13070, rarity: 'D1' },
      { slug: 'b4b', number: 237, count: 0, nameEn: 'Bulbasaur', entityKind: 'PK', entityId: 13070, rarity: 'D1' },
    ])
    expect(parsePzPayload('pas du json')).toBeNull()
    expect(parsePzPayload(JSON.stringify({ v: 3, rows: [] }))).toBeNull()
  })
  it('lit plusieurs extensions, compressées', async () => {
    const { parsePzPayload, inflatePzPayload } = await import('./pzCollection')
    const json = JSON.stringify({ v: 2, player: '42', pages: [
      { set: 'C1', more: false, rows: [['/cards/c1/1/', 13, 'Bulbasaur', 'cPK_10_021780_00_FUSHIGIDANE_C.webp', 'C']] },
      { set: 'PROMO-A', more: true, rows: [['/cards/promo-a/1/', 1, 'Potion', 'cTR_20_000010_00_KIZUGUSURI_P.webp', '']] },
      { set: 'B1', rows: 'cassé' },
    ] })
    const z = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
    const b64 = btoa(String.fromCharCode(...z)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const pages = parsePzPayload(await inflatePzPayload(b64))!
    expect(pages.map((p) => [p.setSlug, p.hasMore, p.rows.length, p.playerId])).toEqual([['c1', false, 1, '42'], ['promo-a', true, 1, '42']])
    expect(pages[1].rows[0]).toMatchObject({ slug: 'promo-a', number: 1, entityKind: 'TR', entityId: 10 })
  })
  it('lit les pages de profil (v3) à côté des extensions', async () => {
    const { parsePzPayload, pzPayloadHtml } = await import('./pzCollection')
    const json = JSON.stringify({ v: 3, player: '42', pages: [{ set: 'C1', more: false, rows: [['/cards/c1/1/', 2, 'Bulbasaur', 'cPK_10_021780_00_X_C.webp', 'C']] }],
      html: { home: '<main>accueil</main>', wishlist: '<main>souhaits</main>', autre: '<main>?</main>', stats: 12 } })
    expect(parsePzPayload(json)!.map((p) => p.setSlug)).toEqual(['c1'])
    expect(pzPayloadHtml(json)).toEqual({ home: '<main>accueil</main>', wishlist: '<main>souhaits</main>' })
    expect(pzPayloadHtml(JSON.stringify({ v: 2, pages: [] }))).toEqual({})
    expect(pzPayloadHtml('pas du json')).toEqual({})
  })
  it('produit un favori court et un script valide', async () => {
    const { pzBookmarklet, pzFavoriScript } = await import('./pzBookmarklet')
    const url = pzBookmarklet('https://camelbaggy.github.io/ptcgp-collection/')
    expect(url.startsWith('javascript:')).toBe(true)
    expect(url.length).toBeLessThan(400)
    const code = decodeURIComponent(url.slice('javascript:'.length))
    expect(code).toContain('"https://camelbaggy.github.io/ptcgp-collection/pz-favori.js"')
    expect(() => new Function(code)).not.toThrow()
    const js = pzFavoriScript(['A1', 'PROMO-A', 'bad code'])
    expect(js).toContain('["A1","PROMO-A"]')
    expect(js).toContain('document.currentScript')
    expect(() => new Function(js)).not.toThrow()
  })
})

describe('adresses Pokémon-Zone', () => {
  it('retrouve le joueur et construit la page d\'une extension', async () => {
    const { pzPlayerFromUrl, pzSetUrl } = await import('./pzCollection')
    expect(pzPlayerFromUrl('https://www.pokemon-zone.com/players/6978334344383017/sets/C1/')).toBe('6978334344383017')
    expect(pzPlayerFromUrl('https://example.com/players/1/')).toBeNull()
    expect(pzSetUrl('123', 'B4b')).toBe('https://www.pokemon-zone.com/players/123/sets/B4b/')
    expect(pzSetUrl('123', 'P-A')).toBe('https://www.pokemon-zone.com/players/123/sets/PROMO-A/')
    expect(parsePzCollection(page('C1', [])).playerId).toBe('123')
  })
})
