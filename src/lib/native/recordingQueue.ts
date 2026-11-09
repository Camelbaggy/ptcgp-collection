import type { RecordingItem } from './holoNative'

/** Sépare les vidéos lues : la plus récente est importée, les autres sont jetées. */
export function splitRecordings<T extends Pick<RecordingItem, 'at'>>(items: T[]): { latest: T | null; older: T[] } {
  if (!items.length) return { latest: null, older: [] }
  const sorted = [...items].sort((a, b) => b.at - a.at)
  return { latest: sorted[0], older: sorted.slice(1) }
}

/** 83 000 ms -> « 1 min 23 s ». */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  return m ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`
}

export const RECORDING_TOO_SHORT_MS = 3000

export const RECORDING_START_HELP =
  'Ouvre le jeu sur l\'écran « Échange de points Booster » de l\'extension choisie, fais défiler lentement jusqu\'en bas, puis touche « Arrêter l\'enregistrement » dans la notification (ou reviens ici et appuie sur « Arrêter »).'

/** Texte d'état de l'enregistrement. */
export function recordingStateText(s: { recording: boolean; waiting: boolean }): string {
  if (s.recording) return 'Enregistrement en cours…'
  if (s.waiting) return 'Début dans 5 s : retourne vite dans le jeu.'
  return ''
}
