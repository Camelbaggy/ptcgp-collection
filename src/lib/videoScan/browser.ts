import type { Card } from '../types'
import { alignOrdered } from './align'
import { decodeFp, fpDistance, type Box } from './fingerprint'
import { crop, resizeArea } from './image'
import { loadPrintIndex, printsFor } from './prints'
import { rankBoxes, type RefSet, type ShotCandidate } from './identify.ts'
import { runRecap } from './recap.ts'
import type { RecognizeRecap } from './recapTypes'
import { detectCards } from './screenshot.ts'
import type { RGBAImage } from './image'
import { REF_W } from './layout'
import { scanFrames, type FrameSource, type ScanTile } from './scan'

/** Images de la vidéo, extraites par positionnement (seek) à `fps` images par seconde. */
export async function videoFrames(file: Blob, fps = 5, width = REF_W): Promise<FrameSource & { dispose(): void }> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url
  await new Promise<void>((ok, ko) => {
    video.onloadedmetadata = () => ok()
    video.onerror = () => ko(new Error('Vidéo illisible par le navigateur'))
  })
  if (!video.videoWidth || video.videoWidth > video.videoHeight) {
    URL.revokeObjectURL(url)
    throw new Error('La vidéo doit être filmée en portrait (téléphone à la verticale).')
  }
  const W = Math.min(width, video.videoWidth)
  const H = Math.round((video.videoHeight * W) / video.videoWidth)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const count = Math.max(1, Math.floor(video.duration * fps))
  let cur = -1
  let last: RGBAImage | null = null
  return {
    count,
    async get(i: number) {
      if (i === cur && last) return last
      const t = Math.min(video.duration - 0.001, i / fps + 0.001)
      await new Promise<void>((ok) => {
        video.onseeked = () => ok()
        video.currentTime = t
      })
      ctx.drawImage(video, 0, 0, W, H)
      cur = i
      last = ctx.getImageData(0, 0, W, H)
      return last
    },
    dispose() { URL.revokeObjectURL(url); video.removeAttribute('src'); video.load() },
  }
}

export interface VideoMatch {
  tile: ScanTile
  card: Card | null
  /** Distance d'illustration (0 = identique ; au-delà de ~0,25 c'est douteux) ; null sans image de référence. */
  dist: number | null
}

export interface VideoImportResult {
  matches: VideoMatch[]
  /** Cartes de l'extension absentes de la vidéo. */
  missing: Card[]
  /** Distance médiane : élevée = la vidéo ne correspond sans doute pas à l'extension choisie. */
  medianDist: number | null
  /** Nombre de cartes de l'extension dont l'image a pu servir de référence. */
  withImages: number
}

export type ImportPhase = 'scroll' | 'cards' | 'refs'

/** Analyse complète : défilement, lecture des badges, puis identification des cartes de `setCards`. */
export async function importVideo(file: Blob, setCards: Card[],
  onProgress?: (phase: ImportPhase, done: number, total: number) => void): Promise<VideoImportResult> {
  const src = await videoFrames(file)
  let scan
  try {
    scan = await scanFrames(src, (ph, d, t) => onProgress?.(ph, d, t))
  } finally { src.dispose() }
  const cards = [...setCards].sort((a, b) => a.number - b.number)
  const refs = await printsFor(cards, (d, t) => onProgress?.('refs', d, t))
  const cost = (i: number, j: number) => (refs[j] ? fpDistance(scan.tiles[i].fp, refs[j]!) : 0.5)
  const map = alignOrdered(scan.tiles.length, cards.length, cost)
  const matches = scan.tiles.map((tile, i) => {
    const j = map[i]
    return { tile, card: j >= 0 ? cards[j] : null, dist: j >= 0 && refs[j] ? cost(i, j) : null }
  })
  const used = new Set(map)
  const missing = cards.filter((_, j) => !used.has(j))
  const ds = matches.flatMap((m) => (m.dist === null ? [] : [m.dist])).sort((a, b) => a - b)
  return { matches, missing, medianDist: ds.length ? ds[ds.length >> 1] : null, withImages: refs.filter(Boolean).length }
}

/** Miniature RGBA → URL d'image affichable. */
export function toDataUrl(img: RGBAImage): string {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0)
  return c.toDataURL('image/png')
}

export type { ShotCandidate }
export interface ShotDetection {
  /** Carte vue sur la capture. */
  thumb: string
  /** Meilleures correspondances, la plus proche d'abord. */
  candidates: ShotCandidate[]
}

/** Au-delà, l'illustration ne ressemble pas assez : carte à vérifier. */
export const SHOT_DOUBT = 0.12

async function loadRgba(file: Blob | RGBAImage): Promise<RGBAImage> {
  if (!(file instanceof Blob)) return file
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/** Références d'identification : extension préférée (images au besoin) + toutes les extensions (empreintes du déploiement). */
async function loadRefSets(preferred: Card[], all: Card[]): Promise<{ pref: RefSet; wide: RefSet }> {
  const pref = { cards: preferred, refs: await printsFor(preferred) }
  const wide = await globalRefs(all)
  return { pref, wide }
}

function detect(img: RGBAImage, boxes: Box[], refs: { pref: RefSet; wide: RefSet }, keep = 4): ShotDetection[] {
  const cands = rankBoxes(img, boxes, refs.pref, refs.wide, keep)
  return boxes.map((b, i) => ({
    thumb: toDataUrl(resizeArea(crop(img, Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)), 53, 74)),
    candidates: cands[i],
  }))
}

/**
 * Cartes d'une capture de fin d'ouverture de booster, comparées à toutes les cartes connues
 * avec une préférence pour `preferred` (l'extension choisie).
 */
export async function recognizeScreenshot(file: Blob, preferred: Card[], all: Card[]): Promise<ShotDetection[]> {
  const img = await loadRgba(file)
  return detect(img, detectCards(img), await loadRefSets(preferred, all))
}

/**
 * « Résumé ouverture » de plusieurs boosters : captures dans l'ordre du défilement, ou images
 * extraites d'une vidéo. Voir recap.ts pour la méthode.
 */
export const recognizeRecap: RecognizeRecap = async (images, preferred, all, onProgress) => {
  const refs = await loadRefSets(preferred, all)
  const r = await runRecap<ShotDetection>({
    count: images.length,
    load: (i) => loadRgba(images[i]),
    identify: (img, boxes) => detect(img, boxes, refs, 6),
    onProgress,
  })
  return r
}

async function globalRefs(all: Card[]): Promise<RefSet> {
  const idx = await loadPrintIndex()
  if (!idx) return { cards: [], refs: [] }
  const cards = all.filter((c) => idx.has(c.id))
  return { cards, refs: cards.map((c) => decodeFp(idx.get(c.id)!)) }
}
