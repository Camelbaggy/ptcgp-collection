import { cardImageUrl } from '../db'
import type { Card } from '../types'
import { alignOrdered } from './align'
import { fingerprint, fpDistance } from './fingerprint'
import type { RGBAImage } from './image'
import { REF_W } from './layout'
import { scanFrames, type FrameSource, type ScanTile } from './scan'

/** Images de la vidéo, extraites par positionnement (seek) à `fps` images par seconde. */
export async function videoFrames(file: Blob, fps = 5): Promise<FrameSource & { dispose(): void }> {
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
  const H = Math.round((video.videoHeight * REF_W) / video.videoWidth)
  const canvas = document.createElement('canvas')
  canvas.width = REF_W
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
      ctx.drawImage(video, 0, 0, REF_W, H)
      cur = i
      last = ctx.getImageData(0, 0, REF_W, H)
      return last
    },
    dispose() { URL.revokeObjectURL(url); video.removeAttribute('src'); video.load() },
  }
}

/** Empreintes de nos images de cartes (images déjà en cache hors ligne). */
export async function referencePrints(cards: Card[], onProgress?: (done: number, total: number) => void): Promise<(Float32Array | null)[]> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const out: (Float32Array | null)[] = []
  let done = 0
  const load = (src: string) => new Promise<HTMLImageElement | null>((ok) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => ok(null)
    img.src = src
  })
  for (let i = 0; i < cards.length; i += 8) {
    const imgs = await Promise.all(cards.slice(i, i + 8).map((c) => load(cardImageUrl(c))))
    for (const img of imgs) {
      if (!img) { out.push(null); continue }
      canvas.width = 120
      canvas.height = Math.round((img.naturalHeight * 120) / img.naturalWidth) || 168
      ctx.fillStyle = '#f0f4fc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      out.push(fingerprint(ctx.getImageData(0, 0, canvas.width, canvas.height)))
    }
    done = Math.min(cards.length, i + 8)
    onProgress?.(done, cards.length)
  }
  return out
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
  const refs = await referencePrints(cards, (d, t) => onProgress?.('refs', d, t))
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
