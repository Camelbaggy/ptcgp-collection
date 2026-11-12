/** Sortie de fichiers texte : téléchargement, presse-papiers, partage système (feuille de partage Android). */

export const canShareFiles = (f: File): boolean => typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] })

export function downloadText(name: string, text: string, mime: string): void {
  const blob = new Blob(['﻿', text], { type: `${mime};charset=utf-8` })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

/** Partage via la feuille système. Rend false si l'appareil ne sait pas partager un fichier. */
export async function shareTextFile(name: string, text: string, mime: string, title: string): Promise<boolean> {
  const file = new File(['﻿', text], name, { type: mime })
  if (!canShareFiles(file)) return false
  try { await navigator.share({ files: [file], title }) } catch (e) { if ((e as Error).name !== 'AbortError') throw e }
  return true
}
