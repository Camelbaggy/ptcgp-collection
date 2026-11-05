import { downsample, type Gray } from './image'
import { SHIFT_X0, SHIFT_X1, bandRows } from './layout'

/**
 * Décalage vertical du contenu entre deux images consécutives : le contenu à la ligne y de
 * `prev` se retrouve à la ligne y − dy de `cur` (dy > 0 quand on fait défiler vers le bas).
 * Recherche grossière à 1/4 de résolution, puis affinage à pleine résolution.
 */
export function estimateShift(prev: Gray, cur: Gray, maxUp = 120, maxDown = 640): { dy: number; err: number } {
  const [b0, b1] = bandRows(prev.height)
  const F = 4
  const p4 = downsample(prev, F), c4 = downsample(cur, F)
  const coarse = search(p4, c4, b0 / F, b1 / F, SHIFT_X0 / F, SHIFT_X1 / F, -maxUp / F, maxDown / F, 1, 1, 50 / F)
  const fine = search(prev, cur, b0, b1, SHIFT_X0, SHIFT_X1, coarse.dy * F - F - 2, coarse.dy * F + F + 2, 2, 2, 200)
  return fine
}

function search(a: Gray, b: Gray, y0: number, y1: number, x0: number, x1: number,
  dMin: number, dMax: number, stepX: number, stepY: number, minOverlap: number): { dy: number; err: number } {
  const W = a.width
  y0 = Math.round(y0); y1 = Math.round(y1); x0 = Math.round(x0); x1 = Math.min(Math.round(x1), W)
  let best = { dy: 0, err: Infinity }
  for (let d = Math.round(dMin); d <= Math.round(dMax); d++) {
    // lignes de `a` dans la bande dont l'image (y − d) est aussi dans la bande de `b`
    const lo = Math.max(y0, y0 + d), hi = Math.min(y1, y1 + d)
    if (hi - lo < minOverlap) continue
    let s = 0, n = 0
    for (let y = lo; y < hi; y += stepY) {
      const ra = y * W, rb = (y - d) * W
      for (let x = x0; x < x1; x += stepX) { s += Math.abs(a.data[ra + x] - b.data[rb + x]); n++ }
    }
    const e = s / n
    if (e < best.err) best = { dy: d, err: e }
  }
  return best
}
