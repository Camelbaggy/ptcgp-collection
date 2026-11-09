import { readBadge, voteBadge, type BadgeRead } from './digits'
import { fingerprint } from './fingerprint'
import { crop, resizeArea, toGray, type Gray, type RGBAImage } from './image'
import { findBadges, fitLattice, type Lattice } from './lattice'
import { BADGE_H, CARD_DX, CARD_DY, CARD_H, CARD_W, COL_X, REF_W, bandRows } from './layout'
import { estimateShift } from './scroll'

/** Fournit les images de la vidéo, déjà ramenées à REF_W px de large. */
export interface FrameSource {
  count: number
  get(i: number): Promise<RGBAImage>
}

export interface ScanTile {
  /** Position d'affichage (0 = première carte en haut à gauche). */
  index: number
  row: number
  col: number
  count: number | null
  /** Confiance de la lecture du nombre, 0–1. */
  conf: number
  fp: Float32Array
  /** Miniature de la carte telle que vue dans le jeu (53×75). */
  thumb: RGBAImage
}

export interface ScanResult {
  tiles: ScanTile[]
  lattice: Lattice | null
  frames: number
}

export type Progress = (phase: 'scroll' | 'cards', done: number, total: number) => void

const THUMB_W = 53, THUMB_H = 75
const READS_PER_ROW = 3

export async function scanFrames(src: FrameSource, onProgress?: Progress): Promise<ScanResult> {
  const n = src.count
  const pos: number[] = []
  const motion: number[] = []
  const badgeYs: number[] = []
  let prev: Gray | null = null
  let height = 0
  for (let i = 0; i < n; i++) {
    const img = await src.get(i)
    if (img.width !== REF_W) throw new Error(`frame width ${img.width} != ${REF_W}`)
    height = img.height
    const g = toGray(img)
    let dy = 0
    if (prev) dy = estimateShift(prev, g).dy
    pos.push(i ? pos[i - 1] + dy : 0)
    motion.push(Math.abs(dy))
    const [b0, b1] = bandRows(img.height)
    for (const y of findBadges(img, b0, b1)) badgeYs.push(pos[i] + y)
    prev = g
    onProgress?.('scroll', i + 1, n)
  }
  const lattice = fitLattice(badgeYs)
  if (!lattice) return { tiles: [], lattice: null, frames: n }

  // pour chaque rangée, les images où la rangée entière est dans la zone utile, les plus nettes d'abord
  const [b0, b1] = bandRows(height)
  const top = Math.min(...pos) + b0, bottom = Math.max(...pos) + b1
  const kMin = Math.ceil((top - CARD_DY + 4 - lattice.y0) / lattice.pitch)
  const kMax = Math.floor((bottom - BADGE_H - 8 - lattice.y0) / lattice.pitch)
  const plan = new Map<number, { k: number; y: number }[]>()
  for (let k = kMin; k <= kMax; k++) {
    const Y = lattice.y0 + k * lattice.pitch
    const cands: { i: number; s: number }[] = []
    for (let i = 0; i < n; i++) {
      const y = Y - pos[i]
      if (y + CARD_DY - 4 < b0 || y + BADGE_H + 8 > b1) continue
      const m = motion[i] + (i + 1 < n ? motion[i + 1] : motion[i])
      cands.push({ i, s: m + Math.abs(y - (b0 + b1) / 2) * 0.02 })
    }
    cands.sort((a, b) => a.s - b.s)
    for (const c of cands.slice(0, READS_PER_ROW)) {
      const list = plan.get(c.i) ?? []
      list.push({ k, y: Math.round(Y - pos[c.i]) })
      plan.set(c.i, list)
    }
  }

  interface Acc { reads: BadgeRead[]; present: number; seen: number; fp?: Float32Array; thumb?: RGBAImage }
  const acc = new Map<string, Acc>()
  const frames = [...plan.keys()].sort((a, b) => a - b)
  let done = 0
  for (const i of frames) {
    const img = await src.get(i)
    for (const { k, y } of plan.get(i)!) {
      COL_X.forEach((x0, col) => {
        const key = `${k}:${col}`
        const a = acc.get(key) ?? { reads: [], present: 0, seen: 0 }
        const box = { x: x0 + CARD_DX, y: y + CARD_DY, w: CARD_W, h: CARD_H }
        const card = crop(img, box.x, box.y, box.w, box.h)
        a.seen++
        if (isCardPresent(card)) {
          a.present++
          a.reads.push(readBadge(crop(img, x0 - 2, y - 2, 62, 26)))
          if (!a.fp) { a.fp = fingerprint(card); a.thumb = resizeArea(card, THUMB_W, THUMB_H) }
        }
        acc.set(key, a)
      })
    }
    onProgress?.('cards', ++done, frames.length)
  }

  const tiles: ScanTile[] = []
  for (let k = kMin; k <= kMax; k++) {
    for (let col = 0; col < COL_X.length; col++) {
      const a = acc.get(`${k}:${col}`)
      if (!a || !a.fp || a.present * 2 <= a.seen) continue
      const v = voteBadge(a.reads)
      tiles.push({ index: tiles.length, row: k - kMin, col, count: v.value, conf: v.conf, fp: a.fp, thumb: a.thumb! })
    }
  }
  return { tiles, lattice, frames: n }
}


/** Une carte occupe la case si la majorité de la zone n'est pas le fond clair de l'écran. */
export function isCardPresent(card: RGBAImage): boolean {
  let n = 0, t = 0
  for (let p = 0; p < card.data.length; p += 16) {
    const r = card.data[p], g = card.data[p + 1], b = card.data[p + 2]
    const light = r > 215 && g > 220 && b > 228 && Math.max(r, g, b) - Math.min(r, g, b) < 30
    if (!light) n++
    t++
  }
  return n / t > 0.55
}
