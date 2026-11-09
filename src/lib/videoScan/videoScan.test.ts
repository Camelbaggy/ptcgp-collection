import { describe, expect, it } from 'vitest'
import { alignOrdered } from './align'
import { decodeFp, encodeFp, fingerprint, fpDistance } from './fingerprint'
import { fitLattice } from './lattice'
import { estimateShift } from './scroll'
import { toGray, type RGBAImage } from './image'
import { voteBadge } from './digits'

const solid = (w: number, h: number, f: (x: number, y: number) => [number, number, number]): RGBAImage => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = f(x, y); const p = (y * w + x) * 4
    data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255
  }
  return { width: w, height: h, data }
}

describe('alignOrdered', () => {
  it('saute les cartes absentes de l\'écran du jeu', () => {
    // cartes 0..5, la vidéo montre 0,1,3,4,5 (la 2 est omise)
    const shown = [0, 1, 3, 4, 5]
    const map = alignOrdered(shown.length, 6, (i, j) => (shown[i] === j ? 0 : 1))
    expect(map).toEqual([0, 1, 3, 4, 5])
  })
  it('associe dans l\'ordre quand tout correspond', () => {
    expect(alignOrdered(3, 3, () => 0.2)).toEqual([0, 1, 2])
  })
})

describe('fingerprint', () => {
  it('ne dépend pas de la luminosité ni de la taille', () => {
    const pat = (x: number, y: number, w: number, h: number): [number, number, number] =>
      [x / w > 0.5 ? 200 : 40, y / h > 0.5 ? 180 : 60, 100]
    const a = fingerprint(solid(120, 168, (x, y) => pat(x, y, 120, 168)))
    const b = fingerprint(solid(300, 420, (x, y) => pat(x, y, 300, 420).map((v) => Math.min(255, v + 30)) as [number, number, number]))
    const c = fingerprint(solid(120, 168, (x, y) => pat(y * 120 / 168, x * 168 / 120, 120, 168)))
    expect(fpDistance(a, b)).toBeLessThan(0.02)
    expect(fpDistance(a, c)).toBeGreaterThan(0.3)
  })
  it('encode et décode', () => {
    const a = fingerprint(solid(60, 84, (x, y) => [x * 4, y * 3, 50]))
    expect(fpDistance(a, decodeFp(encodeFp(a)))).toBeLessThan(0.01)
  })
})

describe('lattice', () => {
  it('retrouve le pas même avec des rangées manquantes', () => {
    const ys = [633, 634, 969, 1304, 1305, 2310, 2646, 2645]
    const l = fitLattice(ys)!
    expect(Math.abs(l.pitch - 335.5)).toBeLessThan(1.5)
    expect(Math.abs(l.y0 - 633.5)).toBeLessThan(3)
  })
})

describe('estimateShift', () => {
  it('mesure le défilement entre deux images', () => {
    const H = 1296, W = 592
    const tex = (y: number) => (Math.sin(y / 7) * 60 + Math.sin(y / 31) * 50 + 128)
    const a = solid(W, H, (x, y) => { const v = tex(y) + (x % 50 < 25 ? 20 : 0); return [v, v, v] })
    const b = solid(W, H, (x, y) => { const v = tex(y + 87) + (x % 50 < 25 ? 20 : 0); return [v, v, v] })
    expect(estimateShift(toGray(a), toGray(b)).dy).toBe(87)
  })
})

describe('voteBadge', () => {
  it('garde la lecture majoritaire', () => {
    expect(voteBadge([{ value: 12, conf: 0.9 }, { value: 12, conf: 0.8 }, { value: 17, conf: 0.4 }]).value).toBe(12)
    expect(voteBadge([{ value: null, conf: 0 }]).value).toBeNull()
  })
})

describe('detectCards', () => {
  it('repère une disposition 3 + 2 sur fond clair', async () => {
    const { detectCards } = await import('./screenshot')
    const W = 600, H = 800
    const cw = 150, ch = Math.round(150 * 88 / 63)
    const boxes = [[40, 100], [225, 100], [410, 100], [130, 340], [320, 340]]
    const img = solid(W, H, (x, y) => {
      for (const [bx, by] of boxes) if (x >= bx && x < bx + cw && y >= by && y < by + ch) return [(x * 7) % 200, 120, (y * 3) % 200]
      return [230, 238, 247]
    })
    const found = detectCards(img)
    expect(found).toHaveLength(5)
    found.forEach((b, i) => {
      expect(Math.abs(b.x - boxes[i][0])).toBeLessThan(6)
      expect(Math.abs(b.w - cw)).toBeLessThan(6)
    })
  })

  it('repère des cartes grises quasi invisibles grâce à leurs badges', async () => {
    const { detectCards } = await import('./screenshot')
    const W = 600, H = 800
    const cw = 150, ch = Math.round(150 * 88 / 63)
    const boxes = [[40, 100], [225, 100], [410, 100], [130, 340], [320, 340]]
    const bw = Math.round(cw / 2.02), bh = 28
    const img = solid(W, H, (x, y) => {
      for (const [bx, by] of boxes) {
        if (x >= bx && x < bx + bw && y >= by + ch - bh && y < by + ch) return (x - bx > 8 && x - bx < 14 && y - by - ch + bh > 8 && y - by - ch + bh < 20) ? [250, 250, 250] : [76, 92, 116]
        if (x >= bx && x < bx + cw && y >= by && y < by + ch) return [226, 232, 238]
      }
      return [229, 236, 243]
    })
    const found = detectCards(img)
    expect(found).toHaveLength(5)
    found.forEach((b, i) => {
      expect(Math.abs(b.x - boxes[i][0])).toBeLessThan(6)
      expect(Math.abs(b.y - boxes[i][1])).toBeLessThan(8)
      expect(Math.abs(b.w - cw)).toBeLessThan(6)
    })
  })
})
