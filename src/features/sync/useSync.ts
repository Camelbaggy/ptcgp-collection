import { useEffect, useSyncExternalStore } from 'react'
import { getSyncState, subscribeSync, startSync, onSyncSummary } from '../../lib/sync/engine'
import { useToast } from '../../components/Toast'

export const useSyncState = () => useSyncExternalStore(subscribeSync, getSyncState, getSyncState)

export function ago(ts: number | null, now = Date.now()): string {
  if (!ts) return 'jamais'
  const m = Math.floor((now - ts) / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`
}

export function statusLabel(s: ReturnType<typeof getSyncState>): string {
  if (!s.configured) return 'Synchro non configurée'
  if (!s.enabled) return 'Non connecté'
  switch (s.phase) {
    case 'syncing': return 'Synchronisation…'
    case 'offline': return 'Hors ligne (en attente)'
    case 'error': return `Erreur : ${s.error ?? 'inconnue'}`
    case 'reauth': return 'Reconnexion nécessaire'
    default: return `Synchronisé ${ago(s.lastSyncAt)}`
  }
}

/** Démarre la synchro auto (une fois) et affiche le résumé en toast. À monter dans <ToastProvider>. */
export function useSyncAutostart() {
  const toast = useToast()
  useEffect(() => onSyncSummary((m) => toast(m)), [toast])
  useEffect(() => startSync(), [])
}
