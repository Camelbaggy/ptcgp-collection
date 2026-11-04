import { useSyncAutostart } from './useSync'

/** Composant invisible : lance la synchro auto. À placer dans <ToastProvider>. */
export default function SyncController() {
  useSyncAutostart()
  return null
}
