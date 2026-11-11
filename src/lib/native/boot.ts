/** Démarrage spécifique à l'appli Android (chargé uniquement si `isNative`). */
import { App } from '@capacitor/app'
import { HoloNative } from './holoNative'
import { notifyReady } from './appUpdate'
import { hashFromDeepLink } from './platform'

function openLink(url: string | null | undefined) {
  const h = hashFromDeepLink(url)
  if (h) location.hash = h
}

const nativeLog = (message: string) => { void HoloNative.log({ message: message.slice(0, 800) }).catch(() => {}) }

export function setupNative(): void {
  void notifyReady()
  // évènements Pokémon-Zone (au plus 1 fois par heure) puis tier list PocketMads (au plus toutes les 6 h), relus à l'ouverture
  void import('./autoReads').then((m) => m.setupAutoReads()).catch(() => {})

  window.addEventListener('error', (e) => nativeLog(`JS error: ${e.message} (${e.filename ?? ''}:${e.lineno ?? 0})`))
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    nativeLog(`JS rejet: ${r instanceof Error ? `${r.name}: ${r.message}` : String(r)}`)
  })

  void App.addListener('appUrlOpen', (e) => openLink(e.url))
  void App.getLaunchUrl().then((r) => openLink(r?.url)).catch(() => {})

  void App.addListener('backButton', ({ canGoBack }) => {
    const atRoot = location.hash === '' || location.hash === '#/' || location.hash === '#'
    if (!atRoot && (canGoBack || history.length > 1)) history.back()
    else void App.minimizeApp()
  })
}
