import { DEVICE_PREFIX, lsGet, lsSet } from '../../lib/storage'
import { profileDeviceKey } from '../../lib/profiles'

/** Codes d'amis déjà ouverts, gardés sur cet appareil seulement (jamais exportés ni synchronisés), par profil. */
export interface SavedFriend { name: string; date: string; code: string }

const MAX = 12
const key = () => profileDeviceKey(DEVICE_PREFIX + 'friendCodes')

export function loadFriends(): SavedFriend[] {
  try {
    const v: unknown = JSON.parse(lsGet(key()) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is SavedFriend => !!x && typeof x.code === 'string' && typeof x.name === 'string' && typeof x.date === 'string') : []
  } catch { return [] }
}

function save(list: SavedFriend[]): SavedFriend[] { lsSet(key(), JSON.stringify(list)); return list }

/** Ajoute ou met à jour un ami (même pseudo non vide ⇒ remplacé par le code le plus récent), en tête de liste. */
export function rememberFriend(f: SavedFriend): SavedFriend[] {
  const rest = loadFriends().filter((x) => x.code !== f.code && !(f.name && x.name === f.name))
  return save([f, ...rest].slice(0, MAX))
}

export function forgetFriend(code: string): SavedFriend[] {
  return save(loadFriends().filter((x) => x.code !== code))
}
