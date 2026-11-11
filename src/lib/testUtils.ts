/** Aides communes aux tests qui touchent la base (fake-indexeddb) : fausse mémoire locale et changement d'appareil. */
import { db } from './db'

const store = new Map<string, string>()
export const fakeLocalStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
}

/** Se fait passer pour l'appareil `id` (les écritures suivantes portent `by: id`). */
export function setDevice(id: string): void { fakeLocalStorage.setItem('ptcgp.deviceId', id) }

/** Base vide et neuve. */
export async function resetDb(): Promise<void> {
  await db.delete()
  await db.open()
}
