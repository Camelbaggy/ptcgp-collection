import { describe, expect, it } from 'vitest'
import { TEMPLATES, readBadge } from './digits'
import type { RGBAImage } from './image'

/** Badge synthétique (fond ardoise, chiffres blancs) : chaque chiffre = {d, w} (largeur en pixels, 10 = naturelle). */
function badge(digits: { d: number; w?: number }[], gap = 2): RGBAImage {
  const W = 62, H = 26
  const data = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i++) { data[i * 4] = 60; data[i * 4 + 1] = 70; data[i * 4 + 2] = 90; data[i * 4 + 3] = 255 }
  let x0 = 8
  for (const { d, w = 10 } of digits) {
    const t = TEMPLATES[d]
    for (let y = 0; y < 14; y++) for (let x = 0; x < w; x++) {
      const v = t[y * 10 + Math.min(9, Math.floor((x * 10) / w))]
      if (v > 0.5) { const p = ((y + 6) * W + x0 + x) * 4; data[p] = data[p + 1] = data[p + 2] = 245 }
    }
    x0 += w + gap
  }
  return { width: W, height: H, data }
}

describe('readBadge', () => {
  it('lit deux chiffres normaux', () => {
    expect(readBadge(badge([{ d: 1 }, { d: 6 }])).value).toBe(16)
    expect(readBadge(badge([{ d: 2 }, { d: 0 }])).value).toBe(20)
  })
  it('ne coupe pas un chiffre élargi (vidéo étirée) en deux', () => {
    expect(readBadge(badge([{ d: 1 }, { d: 8, w: 16 }])).value).toBe(18)
    expect(readBadge(badge([{ d: 1 }, { d: 2, w: 15 }])).value).toBe(12)
    expect(readBadge(badge([{ d: 1 }, { d: 6, w: 15 }])).value).toBe(16)
  })
  it('signale un nombre à trois chiffres comme peu sûr', () => {
    const r = readBadge(badge([{ d: 1 }, { d: 6 }, { d: 1 }]))
    expect(r.conf).toBeLessThan(0.5)
  })
})
