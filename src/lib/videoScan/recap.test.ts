import { describe, expect, it } from 'vitest'
import { groupBlocks, mergeBlocks, preferMajoritySet, sameBlock, thumbDiff, thumbOf, type ReadBlock } from './recap'

const H = 400
const card = (x: number, y: number) => ({ x, y, w: 290, h: H })
/** Bloc 3 + n cartes dont la première rangée commence à y0. */
function block(y0: number, second = 2) {
  const row1 = [66, 393, 717].map((x) => card(x, y0))
  const xs = second === 2 ? [225, 558] : [66, 393, 717]
  return [...row1, ...xs.map((x) => card(x, y0 + H + 40))]
}

describe('groupBlocks', () => {
  it('reconnaît un bloc 3+2 complet', () => {
    const r = groupBlocks(block(300), 1300)
    expect(r).toHaveLength(1)
    expect(r[0].rows).toEqual([3, 2])
    expect(r[0].complete).toBe(true)
  })
  it('accepte 3+3 et ordonne ligne par ligne', () => {
    const r = groupBlocks([...block(300, 3)].reverse(), 1300)
    expect(r[0].rows).toEqual([3, 3])
    expect(r[0].items.map((b) => b.x)).toEqual([66, 393, 717, 66, 393, 717])
  })
  it('sépare deux blocs par le grand intervalle de l\'en-tête', () => {
    const r = groupBlocks([...block(300), ...block(300 + 2 * H + 40 + 250)], 2400)
    expect(r).toHaveLength(2)
    expect(r.map((b) => b.complete)).toEqual([true, true])
  })
  it('rejette un bloc dont il ne reste que la dernière rangée', () => {
    const r = groupBlocks(block(-440).slice(3), 1300)
    expect(r[0].complete).toBe(false)
  })
  it('rejette un bloc coupé en bas ou sans marge pour l\'en-tête', () => {
    expect(groupBlocks(block(300), 1000)[0].complete).toBe(false)
    expect(groupBlocks(block(20), 1300)[0].complete).toBe(false)
  })
})

const mk = (header: number | null, counts: (number | null)[], ids: string[], dist = 0.05): ReadBlock<string> => ({
  header, counts, cards: ids.map((id) => ({ id, dist, payload: id })),
})
const A = ['a', 'b', 'c', 'd', 'e']

describe('sameBlock / mergeBlocks', () => {
  it('même en-tête : même bloc', () => {
    expect(sameBlock(mk(3, [1, 2, 3, 4, 5], A), mk(3, [1, 2, 3, null, 5], A))).toBe(true)
  })
  it('en-têtes différents : blocs différents', () => {
    expect(sameBlock(mk(3, [1, 2, 3, 4, 5], A), mk(4, [1, 2, 3, 4, 5], A))).toBe(false)
  })
  it('mêmes cartes mais exemplaires cumulés différents : blocs différents', () => {
    expect(sameBlock(mk(null, [1, 2, 3, 4, 5], A), mk(null, [2, 3, 4, 5, 6], A))).toBe(false)
  })
  it('sans en-tête : mêmes cartes et mêmes exemplaires', () => {
    expect(sameBlock(mk(null, [1, 2, 3, 4, 5], A), mk(null, [1, 2, 3, 4, 5], A))).toBe(true)
  })
  it('fusionne les doublons, garde la meilleure lecture et numérote dans l\'ordre', () => {
    const r = mergeBlocks([
      mk(null, [1, 2, 3, 4, 5], A, 0.1),
      mk(null, [9, 9, 9, 9, 9], ['v', 'w', 'x', 'y', 'z']),
      mk(null, [1, 2, 3, 4, 5], ['a', 'b', 'c', 'd', 'e'], 0.01),
    ])
    expect(r.boosters.map((b) => b.index)).toEqual([1, 2])
    expect(r.boosters.every((b) => !b.indexRead)).toBe(true)
    expect(r.boosters[0].cards[0].dist).toBe(0.01)
  })
  it('signale un numéro manquant', () => {
    const r = mergeBlocks([mk(1, [1, 1, 1, 1, 1], A), mk(2, [2, 2, 2, 2, 2], A), mk(4, [4, 4, 4, 4, 4], A)])
    expect(r.warnings).toEqual(['Booster n° 3 introuvable : refais une capture de ce passage.'])
  })
  it('signale un début manquant et trie par numéro lu', () => {
    const r = mergeBlocks([mk(3, [3, 3, 3, 3, 3], A), mk(2, [2, 2, 2, 2, 2], A)])
    expect(r.boosters.map((b) => b.index)).toEqual([2, 3])
    expect(r.warnings).toEqual(['Booster n° 1 introuvable : refais une capture de ce passage.'])
  })
  it('complète le numéro d\'un bloc illisible à partir du précédent', () => {
    const r = mergeBlocks([mk(5, [1, 1, 1, 1, 1], A), mk(null, [2, 2, 2, 2, 2], A)])
    expect(r.boosters.map((b) => [b.index, b.indexRead])).toEqual([[5, true], [6, false]])
  })
})

describe('preferMajoritySet', () => {
  it('départage une réimpression par l\'extension majoritaire', () => {
    const c = (id: string, setId: string, dist: number) => ({ card: { id, setId }, dist })
    const dets = [
      { candidates: [c('x1', 'C1', 0.01)] },
      { candidates: [c('x2', 'C1', 0.01)] },
      { candidates: [c('old', 'A1', 0.02), c('new', 'C1', 0.03)] },
    ]
    preferMajoritySet(dets)
    expect(dets[2].candidates[0].card.id).toBe('new')
  })
})

describe('thumbDiff', () => {
  const img = (v: number) => ({ width: 96, height: 160, data: new Uint8ClampedArray(96 * 160 * 4).fill(v) })
  it('images identiques ou différentes', () => {
    expect(thumbDiff(thumbOf(img(200)), thumbOf(img(200)))).toBe(0)
    expect(thumbDiff(thumbOf(img(200)), thumbOf(img(100)))).toBeGreaterThan(50)
  })
})
