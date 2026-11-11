import { useSyncExternalStore } from 'react'
import { nativePzHost } from './host'
import { PzCancelled, runPzSync, type PzHost, type PzSyncMode } from './run'
import { pzPayloadHtml } from '../importers/pzCollection'
import { parsePzHome, parsePzStats } from '../pzProfile/parse'
import { savePzSnapshot } from '../pzProfile/store'

/**
 * Mode `stats` : rien à vérifier (aucune quantité de carte ne change), les instantanés accueil et
 * statistiques sont enregistrés tout de suite. Renvoie le nombre de pages enregistrées.
 */
export async function savePzStatsResult(json: string): Promise<number> {
  const html = pzPayloadHtml(json)
  let n = 0
  if (html.home) { const h = parsePzHome(html.home); if (h.rarityProgress.length || h.currencies.length) { await savePzSnapshot('home', h); n++ } }
  if (html.stats) { const st = parsePzStats(html.stats); if (st.counters.length) { await savePzSnapshot('stats', st); n++ } }
  return n
}

/**
 * État de la synchro Pokémon-Zone de l'appli Android. Il vit hors des écrans : la barre de
 * progression reste affichée où que l'on aille, et le résultat attend la revue (`takePzSyncResult`).
 */
export interface PzSyncState {
  status: 'idle' | 'running' | 'done' | 'error'
  mode: PzSyncMode
  /** mode `sets` : extensions demandées (codes Pokémon-Zone) */
  sets: string[]
  label: string
  done: number
  total: number
  error: string
  /** JSON v3 lu sur Pokémon-Zone, en attente de revue */
  json: string | null
}

const IDLE: PzSyncState = { status: 'idle', mode: 'quick', sets: [], label: '', done: 0, total: 0, error: '', json: null }
let state: PzSyncState = IDLE
const subs = new Set<() => void>()
const set = (p: Partial<PzSyncState>) => { state = { ...state, ...p }; subs.forEach((f) => f()) }

let cancelHandlers = new Set<(a: 'continue' | 'cancel') => void>()

export function usePzSync(): PzSyncState {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => state)
}
export const getPzSync = (): PzSyncState => state

/** Lance la synchro (une seule à la fois). `host` : remplaçable pour les tests. */
export async function startPzSync(
  player: string, mode: PzSyncMode, knownSets: string[],
  pick: { sets?: string[]; withProfile?: boolean } = {}, host: PzHost = nativePzHost(),
): Promise<void> {
  if (state.status === 'running') return
  set({ ...IDLE, status: 'running', mode, sets: pick.sets ?? [], label: 'Ouverture de Pokémon-Zone…' })
  cancelHandlers = new Set()
  const wrapped: PzHost = {
    ...host,
    onUi(cb) {
      cancelHandlers.add(cb)
      const off = host.onUi(cb)
      return () => { cancelHandlers.delete(cb); off() }
    },
  }
  try {
    const json = await runPzSync(wrapped, {
      player, mode, knownSets, ...pick,
      onProgress: (p) => set({ label: p.label, done: p.done, total: p.total }),
    })
    if (mode === 'stats') {
      const n = await savePzStatsResult(json)
      if (!n) throw new Error('Les statistiques Pokémon-Zone n\'ont pas pu être lues.')
      set({ status: 'done', json: null, label: 'Statistiques à jour' })
    } else set({ status: 'done', json, label: 'Terminé' })
  } catch (e) {
    if (e instanceof PzCancelled) set({ ...IDLE })
    else set({ status: 'error', error: e instanceof Error ? e.message : String(e), json: null })
  }
}

export function cancelPzSync(): void {
  cancelHandlers.forEach((h) => h('cancel'))
}

/** Récupère puis oublie le résultat en attente de revue. */
export function takePzSyncResult(): string | null {
  const j = state.json
  if (j !== null) set({ ...IDLE })
  return j
}

export function dismissPzSync(): void {
  if (state.status !== 'running') set({ ...IDLE })
}
