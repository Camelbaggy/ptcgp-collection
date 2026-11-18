import { useSyncExternalStore } from 'react'
import { runEventsSync } from '../events/sync'
import { DEVICE_PREFIX, lsGet, lsSet } from '../storage'
import { nativePzHost, pzSyncSupported } from '../pzSync/host'
import { PzCancelled, type PzHost } from '../pzSync/run'
import { holdWindow, takeWindow, windowBusy } from '../pzSync/window'
import { PZ_ICONS_URL, pzIconsDue, savePzIcons } from './store'

/**
 * Lecture de la page publique « Icons » de Pokémon-Zone dans la fenêtre intégrée de l'appli Android (comme les
 * évènements) : à la demande (sélecteur d'icône) et automatiquement à l'ouverture, au plus une fois par semaine.
 */
const COUNT_JS = `(function(){return String(document.querySelectorAll('main img[src*="PROFILE_ICON_"]').length)})()`
const LS_TRY = DEVICE_PREFIX + 'profileIcons.autoTry'
const RETRY_MS = 12 * 3600_000

export interface PzIconsReadState { running: boolean; label: string; error: string; result: string }
let state: PzIconsReadState = { running: false, label: '', error: '', result: '' }
const subs = new Set<() => void>()
const set = (p: Partial<PzIconsReadState>) => { state = { ...state, ...p }; subs.forEach((f) => f()) }
const handlers = new Set<(a: 'continue' | 'cancel') => void>()

export function usePzIconsRead(): PzIconsReadState {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => state)
}
export function cancelPzIconsRead(): void { handlers.forEach((h) => h('cancel')) }

export async function startPzIconsRead(auto = false, host: PzHost = nativePzHost()): Promise<boolean> {
  if (state.running) return false
  const release = auto ? holdWindow('icons', cancelPzIconsRead) : await takeWindow('icons')
  if (!release) {
    if (!auto) set({ error: 'Une autre lecture Pokémon-Zone est en cours : réessaie dans un instant.' })
    return false
  }
  set({ running: true, label: 'Ouverture de Pokémon-Zone…', error: '', result: '' })
  try {
    const pages = await runEventsSync({
      ...host,
      onUi(cb) { handlers.add(cb); const off = host.onUi(cb); return () => { handlers.delete(cb); off() } },
    }, { silent: auto, pages: [[PZ_ICONS_URL, 'icônes']], countJs: COUNT_JS, what: 'icônes', onProgress: (label) => set({ label }) })
    const n = savePzIcons(pages)
    set({ running: false, label: '', result: `${n} icônes à jour.` })
    return true
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    set({ running: false, label: '', error: auto || e instanceof PzCancelled ? '' : /non autoris/i.test(m) ? 'Cette version de l\'appli ne sait pas encore ouvrir Pokémon-Zone : installe la dernière version.' : m })
    return false
  } finally { release() }
}

/** Lecture automatique (appli Android) : due si le catalogue a plus d'une semaine, au plus un essai toutes les 12 h. */
export async function maybeAutoPzIconsRead(now = Date.now()): Promise<void> {
  if (state.running || windowBusy() || !navigator.onLine || document.visibilityState !== 'visible') return
  if (!pzIconsDue(now) || now - (Number(lsGet(LS_TRY)) || 0) < RETRY_MS) return
  if (!(await pzSyncSupported())) return
  lsSet(LS_TRY, String(now))
  await startPzIconsRead(true)
}
