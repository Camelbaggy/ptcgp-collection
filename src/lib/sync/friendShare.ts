/**
 * Échanges entre amis, mise à jour automatique (2026-11-12).
 * Chaque Holothèque publie son code d'échange dans un petit fichier JSON de son propre Drive
 * (scope `drive.file` : l'appli ne voit que les fichiers qu'elle a créés), lisible par toute personne
 * qui a le lien. L'appli d'un ami relit ce fichier sans connexion Google, avec une clé API publique
 * (restreinte aux domaines de l'appli dans la console Google Cloud).
 * Contenu : seulement le pseudo, la date et le code (doubles + manquantes), rien d'autre.
 */

/** Clé API Google publique (projet « PTCGP Collection »), restreinte à l'API Drive et aux référents camelbaggy.github.io et localhost. */
export const GOOGLE_API_KEY: string = (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined) || 'AIzaSyBOxArUI5XFw9qc4CQjsEa_Yczo8N3bB_A'
export const canReadFriendFiles = () => GOOGLE_API_KEY.length > 0

export const FRIEND_FILE_NAME = 'Holothèque - code d’échange.json'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export interface PublishedCode { app: 'holotheque'; v: 1; name: string; date: string; code: string }

export class FriendShareError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

type Fetch = typeof fetch
const auth = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })

async function check(r: Response): Promise<Response> {
  if (!r.ok) throw new FriendShareError(r.status, `Drive ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  return r
}

export const isPublishedCode = (x: unknown): x is PublishedCode => {
  const o = x as Partial<PublishedCode> | null
  return !!o && o.app === 'holotheque' && o.v === 1 && typeof o.name === 'string' && typeof o.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(o.date) && typeof o.code === 'string' && /^[A-Za-z0-9_-]{1,20000}$/.test(o.code)
}

/** Identifiant de fichier Drive plausible (évite d'injecter n'importe quoi dans l'URL). */
export const isFileId = (s: string | null | undefined): s is string => !!s && /^[A-Za-z0-9_-]{10,100}$/.test(s)

async function createPublicFile(token: string, content: PublishedCode, f: Fetch): Promise<string> {
  const boundary = 'holo' + Math.random().toString(36).slice(2)
  const meta = { name: FRIEND_FILE_NAME, mimeType: 'application/json', description: 'Code d’échange Holothèque, lisible par tes amis qui ont le lien. Mis à jour automatiquement.' }
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`
    + `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(content)}\r\n--${boundary}--`
  const r = await check(await f(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST', headers: { ...auth(token), 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  }))
  const { id } = (await r.json()) as { id: string }
  await check(await f(`${API}/files/${id}/permissions?fields=id`, {
    method: 'POST', headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone', allowFileDiscovery: false }),
  }))
  return id
}

/** Publie (ou met à jour) le fichier public ; renvoie son id. Recrée le fichier s'il a été supprimé. */
export async function publishCode(token: string, content: PublishedCode, fileId: string | null, f: Fetch = fetch): Promise<string> {
  if (fileId) {
    const r = await f(`${UPLOAD}/files/${fileId}?uploadType=media&fields=id,trashed`, {
      method: 'PATCH', headers: { ...auth(token), 'Content-Type': 'application/json' }, body: JSON.stringify(content),
    })
    if (r.ok) {
      const j = (await r.json()) as { trashed?: boolean }
      if (!j.trashed) return fileId
    } else if (r.status !== 404 && r.status !== 403) await check(r)
  }
  return createPublicFile(token, content, f)
}

/** Supprime le fichier public (désactivation). */
export async function unpublishCode(token: string, fileId: string, f: Fetch = fetch): Promise<void> {
  const r = await f(`${API}/files/${fileId}`, { method: 'DELETE', headers: auth(token) })
  if (!r.ok && r.status !== 404) await check(r)
}

/** Lit le code publié par un ami (sans connexion Google, avec la clé API). */
export async function fetchPublishedCode(fileId: string, f: Fetch = fetch, key = GOOGLE_API_KEY): Promise<PublishedCode> {
  if (!key) throw new FriendShareError(0, 'Lecture automatique pas encore configurée')
  if (!isFileId(fileId)) throw new FriendShareError(0, 'Lien d’ami invalide')
  const r = await f(`${API}/files/${fileId}?alt=media&key=${encodeURIComponent(key)}`)
  if (r.status === 404) throw new FriendShareError(404, 'Ton ami a désactivé la mise à jour automatique')
  await check(r)
  const j: unknown = await r.json().catch(() => null)
  if (!isPublishedCode(j)) throw new FriendShareError(0, 'Fichier d’ami illisible')
  return j
}
