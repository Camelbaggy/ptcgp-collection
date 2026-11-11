import { PREF_PREFIX, lsGet, lsSet } from '../storage'
/**
 * Mises à jour de l'appli Android (pas de service worker) : le site publié sur GitHub Pages
 * contient `app-version.json` ({version, url, date}) ; `url` est un zip du build web.
 * On le télécharge en arrière-plan avec @capgo/capacitor-updater (mode manuel), puis on
 * propose « Recharger » (pwaUpdate.ts expose le même état que pour le service worker).
 */
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { REMOTE_BASE } from './platform'
import { HoloNative } from './holoNative'

const log = (m: string) => { HoloNative.log({ message: '[maj] ' + m }).catch(() => {}) }
import type { CheckResult, UpdateState } from '../pwaUpdate'

export const VERSION_URL = `${REMOTE_BASE}app-version.json`
const LS_APPLIED = PREF_PREFIX + 'app.bundleVersion'
const CHECK_EVERY_MS = 30 * 60 * 1000

interface RemoteVersion { version: string; url: string; date?: string; checksum?: string }

const ls = {
  get(): string | null { return lsGet(LS_APPLIED) },
  set(v: string) { lsSet(LS_APPLIED, v) },
}

let setState: (s: UpdateState) => void = () => {}
let readyBundleId: string | null = null
let busy: Promise<CheckResult> | null = null

/** À appeler au démarrage : confirme que le bundle courant fonctionne (sinon le plugin revient en arrière). */
export async function notifyReady(): Promise<void> {
  try { await CapacitorUpdater.notifyAppReady() } catch { /* ignoré */ }
}

async function fetchRemote(): Promise<RemoteVersion | null> {
  const r = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' })
  if (!r.ok) { log(`app-version.json : HTTP ${r.status}`); return null }
  const j = (await r.json()) as Partial<RemoteVersion>
  return j && typeof j.version === 'string' && typeof j.url === 'string' ? { version: j.version, url: j.url, date: j.date, checksum: j.checksum } : null
}

/** Version du bundle en cours : celle du plugin, sinon la dernière appliquée, sinon le build embarqué. */
async function currentVersion(): Promise<string[]> {
  const known = new Set<string>([__APP_BUILD__, __APP_BUNDLE__])
  const applied = ls.get()
  if (applied) known.add(applied)
  try {
    const cur = await CapacitorUpdater.current()
    const v = cur.bundle?.version
    if (v && v !== 'builtin') known.add(v)
  } catch { /* ignoré */ }
  return [...known]
}

function isNewer(remote: RemoteVersion, known: string[]): boolean {
  if (known.includes(remote.version)) return false
  // Garde-fou contre un retour en arrière : une date antérieure au build embarqué n'est pas une mise à jour.
  const rd = remote.date ? Date.parse(remote.date) : NaN
  const bd = Date.parse(__APP_BUILD_DATE__)
  if (!Number.isNaN(rd) && !Number.isNaN(bd) && rd < bd) return false
  return true
}

async function run(): Promise<CheckResult> {
  if (readyBundleId) { setState('ready'); return 'found' }
  if (!navigator.onLine) return 'offline'
  try {
    const remote = await fetchRemote()
    if (!remote) return 'error'
    if (!isNewer(remote, await currentVersion())) return 'uptodate'
    setState('downloading')
    let id: string | undefined
    try {
      id = (await CapacitorUpdater.list()).bundles.find((b) => b.version === remote.version && b.status === 'success')?.id
    } catch { /* ignoré */ }
    // le plugin refuse un zip sans empreinte SHA-256 (« Checksum required »)
    if (!remote.checksum) { log('app-version.json sans checksum'); setState('idle'); return 'error' }
    if (!id) {
      log(`téléchargement ${remote.version}`)
      id = (await CapacitorUpdater.download({ url: remote.url, version: remote.version, checksum: remote.checksum })).id
      log(`téléchargé ${remote.version} (${id})`)
    }
    readyBundleId = id
    pendingVersion = remote.version
    setState('ready')
    return 'found'
  } catch (e) {
    log(`échec : ${(e as Error)?.message || String(e)}`)
    setState('idle')
    return navigator.onLine ? 'error' : 'offline'
  }
}

let pendingVersion: string | null = null

export function checkAppUpdate(): Promise<CheckResult> {
  return (busy ??= run().finally(() => { busy = null }))
}

/** Active le bundle téléchargé et recharge l'appli. */
export function applyAppUpdate(): void {
  if (!readyBundleId) { location.reload(); return }
  if (pendingVersion) ls.set(pendingVersion)
  CapacitorUpdater.set({ id: readyBundleId }).catch(() => location.reload())
}

export function setupAppUpdates(set: (s: UpdateState) => void): void {
  setState = set
  const check = () => { void checkAppUpdate() }
  check()
  setInterval(check, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
}
