/**
 * Contrat JS ↔ natif de l'appli Android (Capacitor). Implémentation Kotlin : native/holo-native/.
 * Sur le web (PWA), `isNative` est faux et aucune de ces méthodes ne doit être appelée.
 *
 * Capture d'écran (jalon 2) : on lit uniquement l'écran du téléphone, avec l'accord explicite
 * de l'utilisateur (fenêtre système Android à chaque session). Aucun accès au jeu ni au compte.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export const isNative = Capacitor.isNativePlatform()

/** Une capture enregistrée par le natif dans le cache de l'appli (PNG). */
export interface CaptureItem {
  id: string
  /** horodatage ms */
  at: number
  width: number
  height: number
  /** chemin fichier natif ; à lire avec `captureBlob()` */
  path: string
  /** vrai si l'image est (presque) entièrement noire : écran protégé par le jeu ? */
  black: boolean
}

/** Une vidéo d'écran (MP4 H.264, sans son) enregistrée par le natif dans le cache de l'appli. */
export interface RecordingItem {
  id: string
  at: number
  durationMs: number
  width: number
  height: number
  /** chemin fichier natif ; à lire avec `captureBlob()` */
  path: string
}

export interface CaptureStatus {
  /** session de capture en cours (autorisation accordée, service de premier plan actif) */
  active: boolean
  /** nombre de captures en attente de lecture par l'appli */
  pending: number
}

export interface HoloNativePlugin {
  // ---------- Capture d'écran ----------
  /** Demande l'autorisation Android (MediaProjection) et démarre le service de premier plan. */
  startCaptureSession(): Promise<{ granted: boolean }>
  stopCaptureSession(): Promise<void>
  captureStatus(): Promise<CaptureStatus>
  /** Programme une capture dans `delayMs` (le temps de revenir au jeu). Vibre quand c'est fait. */
  scheduleCapture(opts: { delayMs: number }): Promise<void>
  /** Renvoie puis oublie les captures en attente (faites par minuterie ou par la notification). */
  takeCaptures(): Promise<{ items: CaptureItem[] }>
  /** Supprime le fichier d'une capture déjà lue. */
  deleteCapture(opts: { id: string }): Promise<void>
  addListener(event: 'captureTaken', cb: (e: { id: string; at: number; black: boolean }) => void): Promise<PluginListenerHandle>
  addListener(event: 'captureSessionEnded', cb: (e: { reason: string }) => void): Promise<PluginListenerHandle>

  // ---------- Enregistrement vidéo de l'écran (défilement d'un set, récap de 10 boosters) ----------
  /**
   * Programme le début d'un enregistrement MP4 de l'écran dans `delayMs` (le temps de revenir au jeu),
   * dans la session de capture déjà ouverte (la même autorisation). Largeur réduite à `maxWidth` px (720 par défaut).
   * La notification propose alors « Arrêter l'enregistrement ».
   */
  startRecording(opts: { delayMs: number; maxWidth?: number }): Promise<void>
  /** Arrête l'enregistrement en cours ; la vidéo rejoint la liste renvoyée par `takeRecordings()`. */
  stopRecording(): Promise<void>
  recordingStatus(): Promise<{ recording: boolean; pending: number }>
  /** Renvoie puis oublie les vidéos terminées (arrêtées depuis l'appli ou la notification). */
  takeRecordings(): Promise<{ items: RecordingItem[] }>
  /** Supprime le fichier d'une vidéo déjà lue. */
  deleteRecording(opts: { id: string }): Promise<void>
  addListener(event: 'recordingStopped', cb: (e: { id: string; durationMs: number }) => void): Promise<PluginListenerHandle>

  // ---------- Synchro Pokémon-Zone (fenêtre intégrée) ----------
  /** Ouvre la fenêtre intégrée (WebView) sur une page pokemon-zone.com, visible, au-dessus de l'appli. */
  pzOpen(opts: { url: string; status?: string }): Promise<void>
  /** Charge une page pokemon-zone.com ; `ok` faux en cas d'erreur ou de délai dépassé. */
  pzNavigate(opts: { url: string; timeoutMs?: number }): Promise<{ ok: boolean; url: string }>
  /** Évalue un script dans la page affichée (refusé si elle n'est pas sur pokemon-zone.com) ; le script produit une chaîne. */
  pzEval(opts: { js: string }): Promise<{ value: string | null }>
  /** Montre la fenêtre ou la cache (elle reste active, hors de l'écran). `button` : libellé du bouton d'action de la barre. */
  pzSetVisible(opts: { visible: boolean; status?: string; button?: string }): Promise<void>
  pzClose(): Promise<void>
  addListener(event: 'pzUi', cb: (e: { action: 'continue' | 'cancel' }) => void): Promise<PluginListenerHandle>

  // ---------- Connexion Google (synchro Drive) ----------
  /**
   * Jeton OAuth via l'API d'autorisation Google d'Android (pas de fenêtre web, bloquée dans les WebView).
   * `interactive: false` échoue (code "consent_required") si l'utilisateur doit encore accepter.
   */
  googleAuthorize(opts: { scopes: string[]; interactive: boolean }): Promise<{ accessToken: string; email?: string }>
  googleSignOut(): Promise<void>

  // ---------- Journal de diagnostic ----------
  /** Dernières lignes du journal natif (capture, autorisations, service), les plus récentes à la fin. */
  getLog(): Promise<{ lines: string[] }>
  clearLog(): Promise<void>
  log(opts: { message: string }): Promise<void>
}

export const HoloNative = registerPlugin<HoloNativePlugin>('HoloNative')

/** Contenu d'une capture, prêt pour `recognizeScreenshot`. */
export async function captureBlob(item: Pick<CaptureItem, 'path'>): Promise<Blob> {
  const r = await fetch(Capacitor.convertFileSrc(item.path))
  if (!r.ok) throw new Error('Capture illisible')
  return r.blob()
}
