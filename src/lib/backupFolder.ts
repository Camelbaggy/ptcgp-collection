/**
 * Dossier de sauvegarde choisi par l'utilisateur (API File System Access : Chrome, Edge, Brave sur PC).
 * Le droit d'écriture est conservé par le navigateur ; après un redémarrage il peut redemander une confirmation
 * (geste de l'utilisateur obligatoire), d'où `ensureFolderPermission`. Indisponible sur Android et Firefox/Safari.
 */
import { exportBackup } from './db'
import { activeProfileId } from './profiles'
import { AUTO_PREFIX, autoFileName, markBackup, namesToPrune } from './autoBackup'

interface DirHandle extends FileSystemDirectoryHandle {
  queryPermission(d: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(d: { mode: 'readwrite' }): Promise<PermissionState>
}
type Picker = (o?: { mode?: 'readwrite'; id?: string }) => Promise<DirHandle>

export const folderSupported = (): boolean => typeof window !== 'undefined' && typeof (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker === 'function'

// Petite base à part (pas Dexie `db` : elle est exportée et synchronisée, un handle ne doit pas l'être).
function openHandles(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('ptcgp-handles', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('h')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function idbGet(): Promise<DirHandle | null> {
  try {
    const d = await openHandles()
    return await new Promise((res, rej) => { const q = d.transaction('h').objectStore('h').get(activeProfileId()); q.onsuccess = () => res((q.result as DirHandle) ?? null); q.onerror = () => rej(q.error) })
  } catch { return null }
}
async function idbSet(h: DirHandle | null): Promise<void> {
  const d = await openHandles()
  await new Promise<void>((res, rej) => {
    const t = d.transaction('h', 'readwrite')
    if (h) t.objectStore('h').put(h, activeProfileId()); else t.objectStore('h').delete(activeProfileId())
    t.oncomplete = () => res(); t.onerror = () => rej(t.error)
  })
}

export async function getFolder(): Promise<DirHandle | null> { return folderSupported() ? idbGet() : null }
export async function forgetFolder(): Promise<void> { await idbSet(null) }

/** Ouvre le sélecteur de dossier (geste requis) et mémorise le choix. Renvoie le nom du dossier, ou null si annulé. */
export async function chooseFolder(): Promise<string | null> {
  try {
    const h = await (window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker({ mode: 'readwrite', id: 'holotheque-sauvegardes' })
    await idbSet(h)
    return h.name
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return null
    throw e
  }
}

/** `request: true` seulement depuis un clic. */
export async function folderPermission(h: DirHandle, request: boolean): Promise<boolean> {
  try {
    if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true
    return request && (await h.requestPermission({ mode: 'readwrite' })) === 'granted'
  } catch { return false }
}

export type WriteResult = { ok: true; name: string } | { ok: false; reason: 'no-folder' | 'permission' | 'error'; message?: string }

/** Écrit la sauvegarde dans le dossier choisi et supprime les copies automatiques les plus anciennes. */
export async function writeToFolder(request: boolean): Promise<WriteResult> {
  const h = await getFolder()
  if (!h) return { ok: false, reason: 'no-folder' }
  if (!(await folderPermission(h, request))) return { ok: false, reason: 'permission' }
  try {
    const name = autoFileName()
    const fh = await h.getFileHandle(name, { create: true })
    const w = await fh.createWritable()
    await w.write(JSON.stringify(await exportBackup()))
    await w.close()
    const names: string[] = []
    for await (const [n] of h.entries()) if (n.startsWith(AUTO_PREFIX)) names.push(n)
    for (const n of namesToPrune(names)) { try { await h.removeEntry(n) } catch { /* ignoré */ } }
    markBackup()
    return { ok: true, name }
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error).message }
  }
}
