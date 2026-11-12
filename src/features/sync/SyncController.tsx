import { useEffect } from 'react'
import { useSyncAutostart } from './useSync'
import { onSyncDone } from '../../lib/sync/engine'

const publishFriendCode = () => { void import('../exchange/friendAuto').then((m) => m.publishIfEnabled()).catch(() => {}) }

/** Composant invisible : lance la synchro auto, et republie le code d'échange entre amis (si activé). À placer dans <ToastProvider>. */
export default function SyncController() {
  useSyncAutostart()
  useEffect(() => {
    const t = setTimeout(publishFriendCode, 8000)
    const off = onSyncDone(publishFriendCode)
    return () => { clearTimeout(t); off() }
  }, [])
  return null
}
