import { registerSW } from 'virtual:pwa-register'

/** State of the service worker update, shared with the UI banner. */
export type UpdateState = 'idle' | 'downloading' | 'ready'

let state: UpdateState = 'idle'
const listeners = new Set<(s: UpdateState) => void>()
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null

function set(s: UpdateState) {
  state = s
  listeners.forEach((l) => l(s))
}

export function getUpdateState(): UpdateState {
  return state
}

export function onUpdateState(l: (s: UpdateState) => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function reloadToUpdate(): void {
  if (applyUpdate) void applyUpdate(true)
  else location.reload()
}

const CHECK_EVERY_MS = 30 * 60 * 1000

/** Registers the service worker in "prompt" mode: a new version is downloaded in the background, then the banner offers to reload. */
export function setupPwaUpdates(): void {
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh: () => set('ready'),
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const watch = (sw: ServiceWorker | null) => {
        if (!sw || !navigator.serviceWorker.controller) return // first install: nothing to announce
        set('downloading')
        sw.addEventListener('statechange', () => {
          if (sw.state === 'redundant') set('idle')
        })
      }
      watch(reg.installing)
      reg.addEventListener('updatefound', () => watch(reg.installing))
      const check = () => {
        if (navigator.onLine) void reg.update().catch(() => {})
      }
      setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}
