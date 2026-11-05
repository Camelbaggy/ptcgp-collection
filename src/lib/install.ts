/** Installation de la PWA : capture `beforeinstallprompt` dès le démarrage. */
interface BIPEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BIPEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((f) => f())

export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch { return false }
}

/** iPhone / iPad (Safari ne propose pas d'invite d'installation : il faut passer par Partager). */
export function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
}

if (typeof window !== 'undefined') {
  installed = isStandalone()
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BIPEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
}

export const isInstalled = () => installed
export const canInstall = () => !installed && deferred !== null

export function onInstallChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const ev = deferred
  deferred = null
  emit()
  await ev.prompt()
  const { outcome } = await ev.userChoice
  if (outcome === 'accepted') { installed = true; emit() }
  return outcome === 'accepted'
}
