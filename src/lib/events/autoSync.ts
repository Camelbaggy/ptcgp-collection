import { PREF_PREFIX, lsGet, lsSet } from '../storage'
import { useSyncExternalStore } from 'react'
import { db, syncImportedEvents } from '../db'
import { nativePzHost, pzSyncSupported } from '../pzSync/host'
import { PzCancelled, type PzHost } from '../pzSync/run'
import { holdWindow, takeWindow, windowBusy } from '../pzSync/window'
import { mergeImports, parsePokemonZoneSchedule } from './pokemonZone'
import { runEventsSync } from './sync'

/**
 * Synchro des évènements depuis Pokémon-Zone (appli Android) : à chaque ouverture ou retour dans l'appli (au plus
 * une fois par heure, fenêtre cachée, abandon discret si une vérification de sécurité s'affiche) et à la demande
 * (bouton de l'écran Évènements).
 */
export const EVENTS_SYNC_KEY = 'events.syncedAt'
export const EVENTS_AUTO_EVERY_MS = 3600_000
/** pause minimale entre deux tentatives automatiques, même ratées */
const RETRY_MS = 30 * 60_000
const LS_TRY = PREF_PREFIX + 'events.autoTry'

export interface EventsSyncState { running: boolean; auto: boolean; label: string; error: string; result: string }
let state: EventsSyncState = { running: false, auto: false, label: '', error: '', result: '' }
const subs = new Set<() => void>()
const set = (p: Partial<EventsSyncState>) => { state = { ...state, ...p }; subs.forEach((f) => f()) }
const handlers = new Set<(a: 'continue' | 'cancel') => void>()

export function useEventsSync(): EventsSyncState {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => state)
}
export function cancelEventsSync(): void { handlers.forEach((h) => h('cancel')) }

/** Interprète les pages lues et met la base à jour. */
export async function saveSchedulePages(pages: string[], now = Date.now()) {
  const [cards, sets] = await Promise.all([db.cards.toCollection().primaryKeys(), db.sets.toCollection().primaryKeys()])
  const opts = { cardIds: new Set(cards as string[]), setIds: sets as string[] }
  const events = mergeImports(pages.filter(Boolean).map((h) => parsePokemonZoneSchedule(h, opts)))
  if (!events.length) throw new Error('Aucun évènement reconnu sur Pokémon-Zone.')
  const r = await syncImportedEvents(events, now)
  await db.meta.put({ key: EVENTS_SYNC_KEY, value: new Date(now).toISOString() })
  return { total: events.length, ...r }
}

/** Lance une lecture (une seule à la fois ; la fenêtre intégrée est partagée avec les autres lectures). */
export async function startEventsSync(auto = false, host: PzHost = nativePzHost()): Promise<boolean> {
  if (state.running) return false
  const release = auto ? holdWindow('events', cancelEventsSync) : await takeWindow('events')
  if (!release) {
    if (!auto) set({ error: 'Une autre lecture Pokémon-Zone est en cours : réessaie dans un instant.' })
    return false
  }
  set({ running: true, auto, label: 'Ouverture de Pokémon-Zone…', error: '', result: '' })
  try {
    const pages = await runEventsSync({
      ...host,
      onUi(cb) { handlers.add(cb); const off = host.onUi(cb); return () => { handlers.delete(cb); off() } },
    }, { silent: auto, onProgress: (label) => set({ label }) })
    const r = await saveSchedulePages(pages)
    set({
      running: false, label: '',
      result: `${r.total} évènements à jour` + (r.fresh ? `, dont ${r.fresh} nouveau${r.fresh > 1 ? 'x' : ''}` : '') + (r.removed ? `, ${r.removed} retiré${r.removed > 1 ? 's' : ''}` : '') + '.',
    })
    return true
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    set({
      running: false, label: '',
      // une lecture automatique ratée reste discrète : on réessaiera plus tard
      error: auto || e instanceof PzCancelled ? '' : /non autoris/i.test(m) ? 'Cette version de l\'appli ne sait pas encore ouvrir Pokémon-Zone : installe la dernière version.' : m,
    })
    return false
  } finally { release() }
}

const readTry = (): number => Number(lsGet(LS_TRY)) || 0
const writeTry = (n: number) => lsSet(LS_TRY, String(n))

/** Vrai si une lecture automatique est due (dernière lecture de plus d'1 h, dernier essai de plus de 30 min). */
export function eventsAutoDue(syncedAt: string | undefined, lastTry: number, now = Date.now()): boolean {
  const last = syncedAt ? Date.parse(syncedAt) : NaN
  if (!Number.isNaN(last) && now - last < EVENTS_AUTO_EVERY_MS) return false
  return now - lastTry >= RETRY_MS
}

export async function maybeAutoEventsSync(): Promise<void> {
  if (state.running || windowBusy() || !navigator.onLine || document.visibilityState !== 'visible') return
  const cur = (await db.meta.get(EVENTS_SYNC_KEY))?.value as string | undefined
  if (!eventsAutoDue(cur, readTry())) return
  if (!(await pzSyncSupported())) return
  writeTry(Date.now())
  await startEventsSync(true)
}
