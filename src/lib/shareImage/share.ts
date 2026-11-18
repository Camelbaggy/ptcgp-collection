import { HoloNative, isNative } from '../native/holoNative'

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}

export function downloadImage(blob: Blob, filename: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/**
 * Partage l'image : feuille de partage Android (APK récent), sinon Web Share avec fichier,
 * sinon téléchargement. Un partage annulé par l'utilisateur n'est pas une erreur.
 */
export async function shareImage(blob: Blob, filename: string, title: string): Promise<ShareResult> {
  if (isNative) {
    try {
      await HoloNative.shareImage({ base64: await blobToBase64(blob), filename, title })
      return 'shared'
    } catch (e) {
      // APK plus ancien que cette fonction : on continue avec les autres moyens.
      if (!/not implemented|unimplemented/i.test(String((e as Error)?.message ?? e))) throw e
    }
  }
  const file = new File([blob], filename, { type: 'image/png' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled'
    }
  }
  downloadImage(blob, filename)
  return 'downloaded'
}
