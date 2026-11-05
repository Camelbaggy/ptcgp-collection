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
      block({ slug: 'a4b', n: 3, count: 4, name: 'Ivysaur', kind: 'PK', ent: 20, rar: 'U' }),
      block({ slug: 'a4b', n: 9, name: 'Unknown', kind: 'PK', ent: 99999, rar: 'C' }),
    ]))
    const r = resolvePzCollection(p, cards, boosters, setIds)
    expect(r.matches.map((m) => [m.row.number, m.card.id])).toEqual([[1, 'A1-1'], [2, 'A4b-2'], [3, 'A1-2']])
    expect(r.unknown.map((u) => u.number)).toEqual([9])
  })
})
