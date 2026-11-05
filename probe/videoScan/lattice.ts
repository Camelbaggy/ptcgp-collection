import type { RGBAImage } from './image'
import { BADGE_H, BADGE_W, COL_X, isBadgeSlate } from './layout'

/**
 * Haut des badges ardoise entièrement visibles dans les lignes [y0, y1) d'une image,
 * en coordonnées de l'image. On teste les deux bords du badge (le centre porte les chiffres).
 */
export function findBadges(img: RGBAImage, y0: number, y1: number): number[] {
  const out: number[] = []
  for (const x0 of COL_X) {
    let start = -1
    for (let y = y0; y <= y1; y++) {
      let on = false
      if (y < y1) {
        let n = 0, t = 0
        for (const [a, b] of [[x0 + 2, x0 + 12], [x0 + BADGE_W - 12, x0 + BADGE_W - 2]]) {
          for (let x = a; x < b; x++) {
            const p = (y * img.width + x) * 4
            if (isBadgeSlate(img.data[p], img.data[p + 1], img.data[p + 2])) n++
            t++
          }
        }
        on = n / t > 0.6
      }
      if (on && start < 0) start = y
      if (!on && start >= 0) {
        if (y - start >= 12 && y - start <= BADGE_H + 8 && start > y0 && y < y1) out.push(start)
        start = -1
      }
    }
  }
  return out
}

export interface Lattice { y0: number; pitch: number }

/** Grille régulière (y0 + k·pitch) qui explique au mieux les positions de badges observées. */
export function fitLattice(ys: number[]): Lattice | null {
  if (ys.length < 2) return null
  const s = [...ys].sort((a, b) => a - b)
  // regroupe les détections d'une même rangée
  const rows: number[] = []
  let acc: number[] = [s[0]]
  for (let i = 1; i < s.length; i++) {
    if (s[i] - acc[acc.length - 1] <= 10) acc.push(s[i])
    else { rows.push(median(acc)); acc = [s[i]] }
  }
  rows.push(median(acc))
  if (rows.length < 2) return null
  const diffs = rows.slice(1).map((r, i) => r - rows[i]).filter((d) => d > 150)
  if (!diffs.length) return null
  const dMin = Math.min(...diffs)
  let pitch = median(diffs.filter((d) => d < dMin * 1.5))
  let y0 = rows[0]
  for (let it = 0; it < 4; it++) {
    // moindres carrés sur (k, y)
    const ks = rows.map((r) => Math.round((r - y0) / pitch))
    const n = ks.length
    const mk = ks.reduce((a, b) => a + b, 0) / n, my = rows.reduce((a, b) => a + b, 0) / n
    let sxy = 0, sxx = 0
    ks.forEach((k, i) => { sxy += (k - mk) * (rows[i] - my); sxx += (k - mk) ** 2 })
    if (sxx > 0) pitch = sxy / sxx
    y0 = my - pitch * mk
  }
  return { y0, pitch }
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
