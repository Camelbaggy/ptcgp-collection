import { exportBackup } from './db'
import { markBackup } from './autoBackup'
import { MAIN_PROFILE_ID, activeProfile } from './profiles'

/** Suffixe du nom de fichier pour un profil secondaire (`-lea`). */
export function profileFileSuffix(): string {
  const p = activeProfile()
  if (p.id === MAIN_PROFILE_ID) return ''
  const slug = p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return '-' + (slug || p.id)
}

/** Télécharge la sauvegarde JSON complète (utilisé par Réglages et par l'écran d'erreur). */
export async function downloadBackup(prefix = 'ptcgp-sauvegarde'): Promise<void> {
  const data = await exportBackup()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${prefix}${profileFileSuffix()}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  markBackup()
}
