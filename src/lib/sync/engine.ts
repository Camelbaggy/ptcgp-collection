/** Moteur de synchro : état observable + téléchargement / fusion / téléversement avec Google Drive. */
import { db } from '../db'
import { DriveError, ConflictError, createUniqueFile, downloadFile, findFile, getUserEmail, updateFile } from './drive'
import { AuthError, currentToken, dropToken, isConfigured, requestToken, revokeToken } from './gis'
import { isApplyingSync, mergeIntoLocal, type SyncStats } from './snapshot'

export type SyncPhase = 'disconnected' | 'idle' | 'syncing' | 'offline' | 'error' | 'reauth'
export interface SyncState {
  configured: boolean
  enabled: boolean
  phase: SyncPhase
  email: string | null
  lastSyncAt: number | null
  error: string | null
}

const LS = { enabled: 'ptcgp.sync.enabled', email: 'ptcgp.sync.email', last: 'ptcgp.sync.last' }
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* ignore */ } },
}
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false

function initial(): SyncState {
  const enabled = ls.get(LS.enabled) === '1' && isConfigured()
  return {
    configured: isConfigured(), enabled,
    phase: enabled ? (online() ? 'idle' : 'offline') : 'disconnected',
    email: ls.get(LS.email), lastSyncAt: Number(ls.get(LS.last)) || null, error: null,
  }
}

let state: SyncState = initial()
const listeners = new Set<() => void>()
const summaryListeners = new Set<(msg: string) => void>()
function set(p: Partial<SyncState>) { state = { ...state, ...p }; listeners.forEach((l) => l()) }

export const getSyncState = () => state
export const subscribeSync = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const onSyncSummary = (l: (msg: string) => void) => { summaryListeners.add(l); return () => { summaryListeners.delete(l) } }

export function summarize(s: SyncStats): string | null {
  if (!s.total) return null
  const parts: string[] = []
  if (s.owned) parts.push(`${s.owned} carte${s.owned > 1 ? 's' : ''} mise${s.owned > 1 ? 's' : ''} à jour`)
  if (s.history) parts.push(`${s.history} évènement${s.history > 1 ? 's' : ''}`)
  if (s.other) parts.push(`${s.other} autre${s.other > 1 ? 's' : ''} élément${s.other > 1 ? 's' : ''}`)
  return `Synchronisé : ${parts.join(', ')}`
}

let running: Promise<void> | null = null
let again = false

async function getToken(interactive: boolean): Promise<string> {
  return currentToken() ?? requestToken({ interactive, hint: state.email ?? undefined })
}

async function runOnce(interactive: boolean): Promise<SyncStats> {
  let token = await getToken(interactive)
  const total: SyncStats = { owned: 0, history: 0, other: 0, total: 0, toUpload: false }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const meta = await findFile(token)
      const remote = meta ? await downloadFile(token, meta.id) : null
      const { result, stats } = await mergeIntoLocal(remote)
      total.owned += stats.owned; total.history += stats.history; total.other += stats.other; total.total += stats.total
      if (stats.toUpload) {
        if (meta) await updateFile(token, meta.id, result.merged, meta)
        else if (!(await createUniqueFile(token, result.merged))) continue // un autre appareil a créé le fichier en même temps : on fusionne avec le sien
      }
      return total
    } catch (e) {
      if (e instanceof ConflictError) continue
      if (e instanceof DriveError && e.status === 401 && attempt === 0) {
        dropToken(); token = await requestToken({ interactive, hint: state.email ?? undefined }); continue
      }
      throw e
    }
  }
  throw new Error('Conflits répétés, nouvel essai plus tard')
}

/** Synchronise maintenant. Ne bloque jamais l'UI ; plusieurs appels simultanés sont regroupés. */
export function syncNow(opts: { interactive?: boolean } = {}): Promise<void> {
  if (!state.enabled) return Promise.resolve()
  if (running) { again = true; return running }
  if (!online()) { set({ phase: 'offline' }); return Promise.resolve() }
  set({ phase: 'syncing', error: null })
  running = (async () => {
    try {
      const stats = await runOnce(!!opts.interactive)
      const now = Date.now()
      ls.set(LS.last, String(now))
      set({ phase: 'idle', lastSyncAt: now, error: null })
      const msg = summarize(stats)
      if (msg) summaryListeners.forEach((l) => l(msg))
    } catch (e) {
      if (e instanceof AuthError) set({ phase: 'reauth', error: e.message })
      else if (!online() || (e instanceof TypeError)) set({ phase: 'offline', error: null })
      else set({ phase: 'error', error: e instanceof Error ? e.message : String(e) })
    } finally {
      running = null
      if (again) { again = false; if (state.phase === 'idle') void syncNow() }
    }
  })()
  return running
}

/** Connexion (clic utilisateur) : consentement Google, puis première synchro (fusion sans perte). */
export async function connect(): Promise<void> {
  if (!isConfigured()) return
  set({ phase: 'syncing', error: null })
  try {
    const token = await requestToken({ interactive: true })
    const email = await getUserEmail(token)
    ls.set(LS.enabled, '1'); ls.set(LS.email, email)
    set({ enabled: true, email })
  } catch (e) {
    set({ phase: state.enabled ? 'reauth' : 'disconnected', error: e instanceof Error ? e.message : String(e) })
    return
  }
  await syncNow({ interactive: true })
}

export function disconnect(): void {
  revokeToken()
  ls.set(LS.enabled, null); ls.set(LS.email, null); ls.set(LS.last, null)
  set({ enabled: false, phase: 'disconnected', email: null, lastSyncAt: null, error: null })
}

// ---------- déclencheurs automatiques ----------

let timer: ReturnType<typeof setTimeout> | undefined
export function scheduleSync(delay = 5000) {
  if (!state.enabled) return
  clearTimeout(timer)
  timer = setTimeout(() => { void syncNow() }, delay)
}

let started = false
/** À appeler une fois au démarrage de l'app : synchro initiale, écoute des changements locaux et du réseau. */
export function startSync(): () => void {
  if (started) return () => {}
  started = true
  const onChange = () => { if (!isApplyingSync()) scheduleSync() }
  const tables = [db.owned, db.wishlist, db.history, db.tombstones, db.sets, db.boosters, db.cards, db.rates, db.importedEvents]
  const hooks: (() => void)[] = []
  for (const t of tables) {
    const c = () => { onChange() }
    t.hook('creating', c); t.hook('updating', c); t.hook('deleting', c)
    hooks.push(() => { t.hook('creating').unsubscribe(c); t.hook('updating').unsubscribe(c); t.hook('deleting').unsubscribe(c) })
  }
  const goOnline = () => { if (state.enabled) { if (state.phase === 'offline') set({ phase: 'idle' }); void syncNow() } }
  const goOffline = () => { if (state.enabled && !running) set({ phase: 'offline' }) }
  window.addEventListener('online', goOnline)
  window.addEventListener('offline', goOffline)
  if (state.enabled) void syncNow()
  return () => {
    started = false
    window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline)
    hooks.forEach((h) => h()); clearTimeout(timer)
  }
}
