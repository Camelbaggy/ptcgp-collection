/**
 * Sauvegarde automatique locale : fréquence, date de la dernière copie, nom des fichiers.
 * Logique pure (testée) ; l'écriture dans un dossier est dans `backupFolder.ts`.
 * État propre à l'appareil (`ptcgp.` : jamais exporté ni synchronisé).
 */
import { DEVICE_PREFIX, lsGet, lsSet } from './storage'

export type BackupFreq = 'off' | 'day' | 'week' | 'month'
export const FREQ_LABEL: Record<BackupFreq, string> = { off: 'Jamais', day: 'Jour', week: 'Semaine', month: 'Mois' }
const FREQ_DAYS: Record<Exclude<BackupFreq, 'off'>, number> = { day: 1, week: 7, month: 30 }
/** Nombre de copies automatiques gardées dans le dossier. */
export const KEEP_COPIES = 5
export const AUTO_PREFIX = 'ptcgp-auto-'

const FREQ_KEY = DEVICE_PREFIX + 'backup.freq'
const LAST_KEY = DEVICE_PREFIX + 'backup.last'
const SNOOZE_KEY = DEVICE_PREFIX + 'backup.snooze'

export function getFreq(): BackupFreq {
  const v = lsGet(FREQ_KEY)
  return v === 'off' || v === 'day' || v === 'week' || v === 'month' ? v : 'week'
}
export function setFreq(f: BackupFreq): void { lsSet(FREQ_KEY, f) }
export function getLastBackup(): number | null {
  const n = Number(lsGet(LAST_KEY))
  return Number.isFinite(n) && n > 0 ? n : null
}
export function markBackup(at = Date.now()): void { lsSet(LAST_KEY, String(at)) }
export function snoozeReminder(at = Date.now()): void { lsSet(SNOOZE_KEY, String(at)) }
function getSnooze(): number { const n = Number(lsGet(SNOOZE_KEY)); return Number.isFinite(n) ? n : 0 }

const DAY = 86_400_000

/** Une copie est due si la fréquence n'est pas « jamais » et que la dernière a plus de N jours (ou n'existe pas). */
export function isDue(freq: BackupFreq, last: number | null, now = Date.now()): boolean {
  if (freq === 'off') return false
  if (last === null) return true
  return now - last >= FREQ_DAYS[freq] * DAY
}
/** Le rappel est masqué 24 h après « Plus tard ». */
export function reminderVisible(freq: BackupFreq, last: number | null, snoozedAt: number, now = Date.now()): boolean {
  return isDue(freq, last, now) && now - snoozedAt >= DAY
}
export function shouldRemind(now = Date.now()): boolean { return reminderVisible(getFreq(), getLastBackup(), getSnooze(), now) }

export function daysAgo(last: number | null, now = Date.now()): number | null {
  return last === null ? null : Math.max(0, Math.floor((now - last) / DAY))
}
export function sinceLabel(last: number | null, now = Date.now()): string {
  const d = daysAgo(last, now)
  if (d === null) return 'jamais'
  if (d === 0) return 'aujourd’hui'
  if (d === 1) return 'hier'
  return `il y a ${d} jours`
}

export function autoFileName(at = new Date()): string {
  return `${AUTO_PREFIX}${at.toISOString().slice(0, 10)}.json`
}
/** Noms à supprimer pour ne garder que les `keep` copies automatiques les plus récentes (le nom contient la date). */
export function namesToPrune(names: string[], keep = KEEP_COPIES): string[] {
  const mine = names.filter((n) => n.startsWith(AUTO_PREFIX) && n.endsWith('.json')).sort()
  return mine.slice(0, Math.max(0, mine.length - keep))
}
