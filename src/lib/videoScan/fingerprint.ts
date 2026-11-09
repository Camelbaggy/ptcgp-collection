import type { RGBAImage } from './image'

/**
 * Empreinte d'une illustration de carte : grille GX×GY de couleurs moyennes sur la partie
 * centrale de la carte (sans le haut, masqué par l'étiquette « Échangeable », ni le bas,
 * masqué par le badge). Centrée par canal puis normée : insensible à la luminosité.
 * Les mêmes fractions s'appliquent à la carte vue dans le jeu et à nos images.
 */
export const GX = 6, GY = 8
export const FP_X0 = 0.08, FP_X1 = 0.92, FP_Y0 = 0.14, FP_Y1 = 0.82

export interface Box { x: number; y: number; w: number; h: number }

export function fingerprint(img: RGBAImage, card: Box = { x: 0, y: 0, w: img.width, h: img.height }): Float32Array {
  const v = new Float32Array(GX * GY * 3)
  const x0 = card.x + card.w * FP_X0, x1 = card.x + card.w * FP_X1
  const y0 = card.y + card.h * FP_Y0, y1 = card.y + card.h * FP_Y1
  const cw = (x1 - x0) / GX, ch = (y1 - y0) / GY
  for (let gy = 0; gy < GY; gy++) {
    const ya = Math.max(0, Math.round(y0 + gy * ch)), yb = Math.min(img.height, Math.max(ya + 1, Math.round(y0 + (gy + 1) * ch)))
    for (let gx = 0; gx < GX; gx++) {
      const xa = Math.max(0, Math.round(x0 + gx * cw)), xb = Math.min(img.width, Math.max(xa + 1, Math.round(x0 + (gx + 1) * cw)))
      let r = 0, g = 0, b = 0, n = 0
      for (let y = ya; y < yb; y++) {
        for (let x = xa; x < xb; x++) {
          const p = (y * img.width + x) * 4
          r += img.data[p]; g += img.data[p + 1]; b += img.data[p + 2]; n++
        }
      }
      const k = (gy * GX + gx) * 3
      v[k] = n ? r / n : 0; v[k + 1] = n ? g / n : 0; v[k + 2] = n ? b / n : 0
    }
  }
  for (let c = 0; c < 3; c++) {
    let m = 0
    for (let i = c; i < v.length; i += 3) m += v[i]
    m /= GX * GY
    for (let i = c; i < v.length; i += 3) v[i] -= m
  }
  let norm = 0
  for (const x of v) norm += x * x
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < v.length; i++) v[i] /= norm
  return v
}

/** Distance cosinus : 0 = identiques, 2 = opposées. */
export function fpDistance(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return 1 - s
}

/** Encodage compact (int8 en base64) pour stocker les empreintes de référence. */
export function encodeFp(v: Float32Array): string {
  const bytes = Uint8Array.from(v, (x) => Math.max(-127, Math.min(127, Math.round(x * 400))) & 0xff)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function decodeFp(s: string): Float32Array {
  const bin = atob(s)
  const v = new Float32Array(bin.length)
  for (let i = 0; i < bin.length; i++) { const b = bin.charCodeAt(i); v[i] = (b > 127 ? b - 256 : b) / 400 }
  return v
}
