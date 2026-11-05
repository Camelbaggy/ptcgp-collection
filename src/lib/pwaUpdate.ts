import { registerSW } from 'virtual:pwa-register'

/** State of the service worker update, shared with the UI banner. */
export type UpdateState = 'idle' | 'downloading' | 'ready'

let state: UpdateState = 'idle'
const listeners = new Set<(s: UpdateState) => void>()
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null
let registration: ServiceWorkerRegistration | null = null

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
      registration = reg
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

export type CheckResult = 'uptodate' | 'found' | 'offline' | 'unsupported' | 'error'

const MIN_CHECK_MS = 700 // keep the spinner visible long enough to be noticed

/** Manual check from Réglages: asks the browser to fetch the service worker again and tells whether a new version exists. */
export async function checkForUpdate(): Promise<CheckResult> {
  if (state !== 'idle') return 'found'
  if (!('serviceWorker' in navigator)) return 'unsupported'
  if (!navigator.onLine) return 'offline'
  const started = Date.now()
  const wait = () => new Promise((r) => setTimeout(r, Math.max(0, MIN_CHECK_MS - (Date.now() - started))))
  try {
    const reg = registration ?? (await navigator.serviceWorker.getRegistration()) ?? null
    if (!reg) { await wait(); return 'unsupported' }
    await reg.update()
    await wait()
    if (reg.waiting && navigator.serviceWorker.controller) { set('ready'); return 'found' }
    if (reg.installing) { if (state === 'idle') set('downloading'); return 'found' }
    return 'uptodate'
  } catch {
    await wait()
    return navigator.onLine ? 'error' : 'offline'
  }
}
