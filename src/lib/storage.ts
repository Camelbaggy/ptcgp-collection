/**
 * Registre du stockage local (localStorage) : toute lecture ou écriture de réglage passe par ici.
 * - `ptcgp:<clé>` : préférences de confort (thème, filtres, onglets…), incluses dans la sauvegarde ;
 * - `ptcgp.<clé>` : état propre à l'appareil (identité, compte de synchro), jamais exporté.
 * Tolère l'absence de stockage (navigation privée, accès refusé).
 */
export const PREF_PREFIX = 'ptcgp:'
export const DEVICE_PREFIX = 'ptcgp.'

/** Préférences qui ne doivent pas suivre une sauvegarde : états techniques d'un appareil. */
const DEVICE_ONLY_PREFS = new Set(['pm.autoTry', 'events.autoTry', 'app.bundleVersion', 'notif.settings'])

export function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
export function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* ignoré */ }
}
export function lsRemove(key: string): void {
  try { localStorage.removeItem(key) } catch { /* ignoré */ }
}

/** Préférence JSON : `ptcgp:<name>`. */
export function prefGet<T>(name: string, init: T): T {
  const s = lsGet(PREF_PREFIX + name)
  if (s === null) return init
  try { return JSON.parse(s) as T } catch { return init }
}
export function prefSet(name: string, value: unknown): void {
  lsSet(PREF_PREFIX + name, JSON.stringify(value))
}

const isExportable = (key: string) => key.startsWith(PREF_PREFIX) && !DEVICE_ONLY_PREFS.has(key.slice(PREF_PREFIX.length))

/** Toutes les préférences exportables, valeurs brutes (texte). */
export function exportSettings(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && isExportable(k)) { const v = localStorage.getItem(k); if (v !== null) out[k] = v }
    }
  } catch { /* ignoré */ }
  return out
}

/** Restaure des préférences exportées ; ignore toute entrée qui n'est pas une préférence valide. Renvoie le nombre appliqué. */
export function importSettings(data: unknown): number {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 0
  let n = 0
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'string' || !isExportable(k) || k.length > 100 || v.length > 100_000) continue
    lsSet(k, v); n++
  }
  return n
}
