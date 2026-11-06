/** Google Identity Services : chargé à la demande, jeton OAuth (scope drive.appdata) gardé en mémoire uniquement. */
// Public OAuth client id (not a secret); can be overridden at build time with VITE_GOOGLE_CLIENT_ID.
export const CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '1041120278633-rduag2vvlt9tee2pf50v0eqc1gpdie7o.apps.googleusercontent.com'
export const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
import { HoloNative, isNative } from '../native/holoNative'

const GSI_URL = 'https://accounts.google.com/gsi/client'

interface TokenResponse { access_token?: string; expires_in?: number | string; error?: string; error_description?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string; login_hint?: string }): void }
interface GoogleGlobal {
  accounts: { oauth2: {
    initTokenClient(c: {
      client_id: string; scope: string; callback: (r: TokenResponse) => void
      error_callback?: (e: { type?: string; message?: string }) => void; hint?: string
    }): TokenClient
    revoke(token: string, done?: () => void): void
  } }
}
declare global { interface Window { google?: GoogleGlobal } }

export const isConfigured = () => CLIENT_ID.length > 0

let loading: Promise<void> | null = null
export function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Pas de navigateur'))
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return (loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GSI_URL; s.async = true
    s.onload = () => resolve()
    s.onerror = () => { loading = null; s.remove(); reject(new Error('Impossible de charger Google (hors connexion ?)')) }
    document.head.appendChild(s)
  }))
}

let token: { value: string; exp: number } | null = null

export const currentToken = (): string | null => (token && token.exp - 60_000 > Date.now() ? token.value : null)

export class AuthError extends Error {}

/**
 * Demande un jeton. `interactive` : fenêtre de consentement (clic utilisateur requis) ;
 * sinon tentative silencieuse (prompt: ''), qui peut échouer si la session Google n'est plus valide.
 */
export async function requestToken(opts: { interactive: boolean; hint?: string }): Promise<string> {
  if (!isConfigured()) throw new AuthError('Synchro non configurée')
  if (!opts.interactive) {
    const t = currentToken()
    if (t) return t
  }
  if (isNative) return requestNativeToken(opts.interactive)
  await loadGis()
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AuthError('Reconnexion Google nécessaire')), opts.interactive ? 120_000 : 15_000)
    const done = (f: () => void) => { clearTimeout(timer); f() }
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      hint: opts.hint,
      callback: (r) => done(() => {
        if (r.access_token) {
          token = { value: r.access_token, exp: Date.now() + Number(r.expires_in ?? 3600) * 1000 }
          resolve(r.access_token)
        } else reject(new AuthError(r.error_description || r.error || 'Connexion refusée'))
      }),
      error_callback: (e) => done(() => reject(new AuthError(e.type === 'popup_closed' ? 'Connexion annulée' : e.message || 'Reconnexion Google nécessaire'))),
    })
    client.requestAccessToken({ prompt: opts.interactive ? 'consent' : '', login_hint: opts.hint })
  })
}

/** Appli Android : API d'autorisation Google native (la fenêtre web GIS est bloquée dans les WebView). */
async function requestNativeToken(interactive: boolean): Promise<string> {
  try {
    const r = await HoloNative.googleAuthorize({ scopes: [SCOPE], interactive })
    token = { value: r.accessToken, exp: Date.now() + 3500 * 1000 }
    return r.accessToken
  } catch (e) {
    const err = e as { code?: string; message?: string }
    if (err.code === 'consent_required') throw new AuthError('Reconnexion Google nécessaire')
    throw new AuthError(err.message || 'Connexion refusée')
  }
}

export function dropToken() { token = null }

export function revokeToken(): void {
  const t = token?.value
  token = null
  if (isNative) { void HoloNative.googleSignOut().catch(() => {}); return }
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t)
}
