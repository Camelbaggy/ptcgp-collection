import { exportBackup } from './db'

/** Télécharge la sauvegarde JSON complète (utilisé par Réglages et par l'écran d'erreur). */
export async function downloadBackup(prefix = 'ptcgp-sauvegarde'): Promise<void> {
  const data = await exportBackup()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${prefix}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
