/** Client minimal Google Drive v3 (appDataFolder) pour le fichier de synchro. */
import { isSyncSnapshot, type SyncSnapshot } from './merge'

export const SYNC_FILE_NAME = 'ptcgp-sync.json'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export class DriveError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export class ConflictError extends Error {}

export interface RemoteMeta { id: string; version: string; modifiedTime: string }

type Fetch = typeof fetch
const auth = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })

async function check(r: Response): Promise<Response> {
  if (!r.ok) throw new DriveError(r.status, `Drive ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  return r
}

export async function findFile(token: string, f: Fetch = fetch): Promise<RemoteMeta | null> {
  const q = encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`)
  const r = await check(await f(
    `${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,version,modifiedTime)&orderBy=modifiedTime desc&pageSize=10`,
    { headers: auth(token) }))
  const j = (await r.json()) as { files?: RemoteMeta[] }
  return j.files?.[0] ?? null
}

export async function getMeta(token: string, id: string, f: Fetch = fetch): Promise<RemoteMeta> {
  const r = await check(await f(`${API}/files/${id}?fields=id,version,modifiedTime`, { headers: auth(token) }))
  return (await r.json()) as RemoteMeta
}

export async function downloadFile(token: string, id: string, f: Fetch = fetch): Promise<SyncSnapshot> {
  const r = await check(await f(`${API}/files/${id}?alt=media`, { headers: auth(token) }))
  const j = await r.json()
  if (!isSyncSnapshot(j)) throw new Error('Fichier de synchro invalide')
  return j
}

export async function createFile(token: string, snap: SyncSnapshot, f: Fetch = fetch): Promise<RemoteMeta> {
  const boundary = 'ptcgp' + Math.random().toString(36).slice(2)
  const meta = { name: SYNC_FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' }
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(snap)}\r\n--${boundary}--`
  const r = await check(await f(`${UPLOAD}/files?uploadType=multipart&fields=id,version,modifiedTime`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  }))
  return (await r.json()) as RemoteMeta
}

/**
 * Met à jour le contenu. `expected` = version vue au téléchargement : si le fichier a changé depuis,
 * ConflictError (l'appelant re-télécharge, fusionne et réessaie). Contrôle optimiste par `version`.
 */
export async function updateFile(
  token: string, id: string, snap: SyncSnapshot, expected: RemoteMeta, f: Fetch = fetch,
): Promise<RemoteMeta> {
  const cur = await getMeta(token, id, f)
  if (cur.version !== expected.version) throw new ConflictError('Fichier modifié entre-temps')
  const r = await check(await f(`${UPLOAD}/files/${id}?uploadType=media&fields=id,version,modifiedTime`, {
    method: 'PATCH',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(snap),
  }))
  return (await r.json()) as RemoteMeta
}

/** E-mail du compte (best effort : peut être refusé avec le seul scope appdata). */
export async function getUserEmail(token: string, f: Fetch = fetch): Promise<string | null> {
  try {
    const r = await f(`${API}/about?fields=user(emailAddress)`, { headers: auth(token) })
    if (!r.ok) return null
    return ((await r.json()) as { user?: { emailAddress?: string } }).user?.emailAddress ?? null
  } catch { return null }
}
