import { videoFrames } from '../../lib/videoScan/browser'

const FPS = 3

/** Images d'une vidéo de défilement (≈3 par seconde, 592 px de large), en JPEG. */
export async function videoToBlobs(file: Blob, onProgress?: (done: number, total: number) => void): Promise<Blob[]> {
  const src = await videoFrames(file, FPS)
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const out: Blob[] = []
    for (let i = 0; i < src.count; i++) {
      const img = await src.get(i)
      canvas.width = img.width
      canvas.height = img.height
      ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0)
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.92))
      if (blob) out.push(blob)
      onProgress?.(i + 1, src.count)
    }
    return out
  } finally { src.dispose() }
}
