import { BASE, cardImageUrl } from '../db'
import { isNative } from '../native/holoNative'
import type { Card } from '../types'
import { decodeFp, fingerprint } from './fingerprint'

/**
 * Empreintes de référence de nos images de cartes. On lit d'abord le fichier généré au
 * déploiement (data/fingerprints.json) ; pour une carte absente (extension ajoutée à la main,
 * développement local), on calcule l'empreinte depuis l'image.
 */
let index: Promise<Map<string, string> | null> | null = null

export function loadPrintIndex(): Promise<Map<string, string> | null> {
  index ??= fetch(`${BASE}data/fingerprints.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { fp?: Record<string, string> } | null) => (j?.fp ? new Map(Object.entries(j.fp)) : null))
    .catch(() => null)
  return index
}

const computed = new Map<string, Float32Array | null>()

export async function printsFor(cards: Card[], onProgress?: (done: number, total: number) => void): Promise<(Float32Array | null)[]> {
  const idx = await loadPrintIndex()
  const out: (Float32Array | null)[] = cards.map((c) => {
    const s = idx?.get(c.id)
    return s ? decodeFp(s) : computed.get(c.id) ?? null
  })
  const todo = cards.map((_, i) => i).filter((i) => !out[i] && !computed.has(cards[i].id))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  for (let k = 0; k < todo.length; k += 8) {
    const batch = todo.slice(k, k + 8)
    const imgs = await Promise.all(batch.map((i) => loadImage(cardImageUrl(cards[i]))))
    batch.forEach((i, j) => {
      const img = imgs[j]
      let fp: Float32Array | null = null
      if (img) {
        canvas.width = 120
        canvas.height = Math.round((img.naturalHeight * 120) / img.naturalWidth) || 168
        ctx.fillStyle = '#f0f4fc'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        fp = fingerprint(ctx.getImageData(0, 0, canvas.width, canvas.height))
      }
      computed.set(cards[i].id, fp)
      out[i] = fp
    })
    onProgress?.(Math.min(todo.length, k + 8), todo.length)
  }
  return out
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image()
    if (isNative) img.crossOrigin = 'anonymous' // images distantes (Pages envoie ACAO *) lues dans un canvas
    img.onload = () => ok(img)
    img.onerror = () => ok(null)
    img.src = src
  })
}
