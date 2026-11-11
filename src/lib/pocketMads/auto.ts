import { useSyncExternalStore } from 'react'
import { db } from '../db'
import { nativePzHost, pzSyncSupported } from '../pzSync/host'
import { PzCancelled, type PzHost } from '../pzSync/run'
import { getPzSync } from '../pzSync/store'
import { PM_KEY, savePmTierList } from './store'
import { runPmSync } from './sync'
import type { PmTierList } from './types'

/**
 * Lecture de la tier list PocketMads depuis l'appli Android : à la demande (bouton de l'écran Méta)
 * ou automatiquement à l'ouverture / au retour dans l'appli, au plus toutes les 6 h (fenêtre
 * cachée ; si PocketMads demande une vérification, la lecture automatique abandonne en silence).
 */
export const AUTO_EVERY_MS = 6 * 3600_000
/** pause minimale entre deux tentatives automatiques, même ratées */
const RETRY_MS = 3600_000
const LS_TRY = 'ptcgp:pm.autoTry'

export interface PmSyncState { running: boolean; auto: boolean; label: string; error: string }
let state: PmSyncState = { running: false, auto: false, label: '', error: '' }
const subs = new Set<() => void>()
const set = (p: Partial<PmSyncState>) => { state = { ...state, ...p }; subs.forEach((f) => f()) }
const handlers = new Set<(a: 'continue' | 'cancel') => void>()

export function usePmSync(): PmSyncState {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => state)
}

export function cancelPmSync(): void { handlers.forEach((h) => h('cancel')) }

/** Lance une lecture (une seule à la fois, jamais pendant la synchro Pokémon-Zone qui partage la fenêtre). */
export async function startPmSync(auto = false, host: PzHost = nativePzHost()): Promise<PmTierList | null> {
  if (state.running || getPzSync().status === 'running') return null
  set({ running: true, auto, label: 'Ouverture de PocketMads…', error: '' })
  try {
    const t = await runPmSync({
      ...host,
      onUi(cb) { handlers.add(cb); const off = host.onUi(cb); return () => { handlers.delete(cb); off() } },
    }, { silent: auto, onProgress: (label) => set({ label }) })
    await savePmTierList(t)
    set({ running: false, label: '' })
    return t
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    set({
      running: false, label: '',
      // une lecture automatique ratée reste discrète : on réessaiera plus tard
      error: auto || e instanceof PzCancelled ? '' : /non autoris/i.test(m) ? 'Cette version de l\'appli ne sait pas encore ouvrir PocketMads : installe la dernière version.' : m,
    })
    return null
  }
}

const lsGet = (): number => { try { return Number(localStorage.getItem(LS_TRY)) || 0 } catch { return 0 } }
const lsSet = (n: number) => { try { localStorage.setItem(LS_TRY, String(n)) } catch { /* ignoré */ } }

/** Vrai si une lecture automatique est due (dernière lecture de plus de 6 h, dernier essai de plus d'1 h). */
export function autoDue(fetchedAt: string | undefined, lastTry: number, now = Date.now()): boolean {
  const last = fetchedAt ? Date.parse(fetchedAt) : NaN
  if (!Number.isNaN(last) && now - last < AUTO_EVERY_MS) return false
  return now - lastTry >= RETRY_MS
}

export async function maybeAutoPmSync(): Promise<void> {
  if (state.running || !navigator.onLine || document.visibilityState !== 'visible') return
  const cur = (await db.meta.get(PM_KEY))?.value as PmTierList | undefined
  if (!autoDue(cur?.fetchedAt, lsGet())) return
  if (!(await pzSyncSupported())) return
  lsSet(Date.now())
  await startPmSync(true)
}

/** À appeler une fois au démarrage de l'appli Android. */
export function setupAutoPmSync(): void {
  const go = () => { void maybeAutoPmSync().catch(() => {}) }
  // laisse l'appli finir de démarrer (base de données, mise à jour éventuelle)
  setTimeout(go, 4000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(go, 1500) })
}
