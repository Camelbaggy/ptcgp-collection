import type { CaptureItem } from './holoNative'

/** Sépare les captures lues en images exploitables et écrans noirs. */
export function splitCaptures<T extends Pick<CaptureItem, 'black'>>(items: T[]): { ok: T[]; black: T[] } {
  return { ok: items.filter((i) => !i.black), black: items.filter((i) => i.black) }
}

/** « 1 capture en attente » / « 2 captures en attente » ; vide si aucune. */
export function pendingLabel(n: number): string {
  if (n <= 0) return ''
  return `${n} capture${n > 1 ? 's' : ''} en attente`
}

export const BLACK_WARNING = 'Écran noir : le jeu empêche peut-être la capture.'

/** Message à afficher si l'autorisation Android est refusée. */
export const DENIED_HELP = 'Autorisation refusée. Appuie à nouveau sur « Capturer depuis le jeu » et choisis « Tout l\'écran » (pas une seule appli) dans la fenêtre Android.'

export function errorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m || 'Erreur inconnue'
}
