import { DEVICE_PREFIX, lsGet, lsSet } from '../../lib/storage'
import { profileDeviceKey } from '../../lib/profiles'

/**
 * Codes d'amis déjà ouverts, gardés sur cet appareil seulement (jamais exportés ni synchronisés), par profil.
 * `fileId` : fichier Drive public de l'ami (mise à jour automatique) ; `checkedAt` : dernière relecture (ms).
 */
export interface SavedFriend { name: string; date: string; code: string; fileId?: string; checkedAt?: number }

const MAX = 12
const key = () => profileDeviceKey(DEVICE_PREFIX + 'friendCodes')

export function loadFriends(): SavedFriend[] {
  try {
    const v: unknown = JSON.parse(lsGet(key()) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is SavedFriend => !!x && typeof x.code === 'string' && typeof x.name === 'string' && typeof x.date === 'string') : []
  } catch { return [] }
}

function save(list: SavedFriend[]): SavedFriend[] { lsSet(key(), JSON.stringify(list)); return list }

const same = (a: SavedFriend, b: SavedFriend) =>
  a.code === b.code || (!!a.fileId && a.fileId === b.fileId) || (!!a.name && a.name === b.name)

/** Ajoute ou met à jour un ami (même fichier, même code ou même pseudo ⇒ remplacé), en tête de liste. Garde son fichier Drive. */
export function rememberFriend(f: SavedFriend): SavedFriend[] {
  const list = loadFriends()
  const old = list.find((x) => same(x, f))
  const next = { ...f, fileId: f.fileId ?? old?.fileId, checkedAt: f.checkedAt ?? old?.checkedAt }
  return save([next, ...list.filter((x) => !same(x, f))].slice(0, MAX))
}

/** Remplace un ami sur place (relecture automatique), sans changer l'ordre. */
export function updateFriend(fileId: string, patch: Partial<SavedFriend>): SavedFriend[] {
  return save(loadFriends().map((x) => (x.fileId === fileId ? { ...x, ...patch } : x)))
}

export function forgetFriend(code: string): SavedFriend[] {
  return save(loadFriends().filter((x) => x.code !== code))
}
