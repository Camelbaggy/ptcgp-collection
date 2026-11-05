/** Image RGBA brute (compatible avec ImageData). */
export interface RGBAImage {
  width: number
  height: number
  data: Uint8ClampedArray | Uint8Array
}

/** Plan de luminance (0–255). */
export interface Gray {
  width: number
  height: number
  data: Float32Array
}

export function toGray(img: RGBAImage): Gray {
  const { width, height, data } = img
  const out = new Float32Array(width * height)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  return { width, height, data: out }
}

/** Réduction par moyenne de blocs f×f. */
export function downsample(g: Gray, f: number): Gray {
  const w = Math.floor(g.width / f), h = Math.floor(g.height / f)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let dy = 0; dy < f; dy++) {
        const row = (y * f + dy) * g.width + x * f
        for (let dx = 0; dx < f; dx++) s += g.data[row + dx]
      }
      out[y * w + x] = s / (f * f)
    }
  }
  return { width: w, height: h, data: out }
}

/** Copie d'un rectangle (les pixels hors image restent blancs). */
export function crop(img: RGBAImage, x: number, y: number, w: number, h: number): RGBAImage {
  const out = new Uint8ClampedArray(w * h * 4).fill(255)
  for (let yy = 0; yy < h; yy++) {
    const sy = y + yy
    if (sy < 0 || sy >= img.height) continue
    for (let xx = 0; xx < w; xx++) {
      const sx = x + xx
      if (sx < 0 || sx >= img.width) continue
      const s = (sy * img.width + sx) * 4, d = (yy * w + xx) * 4
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2]; out[d + 3] = 255
    }
  }
  return { width: w, height: h, data: out }
}

/** Réduction d'une image RGBA par moyenne de surface (taille quelconque). */
export function resizeArea(img: RGBAImage, w: number, h: number): RGBAImage {
  const out = new Uint8ClampedArray(w * h * 4)
  const sx = img.width / w, sy = img.height / h
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx))
      let r = 0, g = 0, b = 0, n = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const p = (yy * img.width + xx) * 4
          r += img.data[p]; g += img.data[p + 1]; b += img.data[p + 2]; n++
        }
      }
      const d = (y * w + x) * 4
      out[d] = r / n; out[d + 1] = g / n; out[d + 2] = b / n; out[d + 3] = 255
    }
  }
  return { width: w, height: h, data: out }
}
