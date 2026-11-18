import { db } from '../../lib/db'
import { DEVICE_PREFIX, lsGet, lsSet, lsRemove, prefGet, prefSet } from '../../lib/storage'
import { profileDeviceKey, profilePrefName } from '../../lib/profiles'
import { FRIEND_SCOPE, requestToken, dropToken } from '../../lib/sync/gis'
import { canReadFriendFiles, fetchPublishedCode, FriendShareError, isFileId, publishCode, unpublishCode, type PublishedCode } from '../../lib/sync/friendShare'
import { encodeFriendCode, myFriendCode } from '../../lib/calc/friendTrades'
import { loadFriends, updateFriend, type SavedFriend } from './friendStore'

/**
 * Mise à jour automatique des échanges entre amis :
 *  - publication de mon code dans un fichier public de mon Drive (si activée), après chaque synchro,
 *    à l'ouverture de l'appli et de l'onglet, seulement si le code a changé ;
 *  - relecture des fichiers de mes amis à l'ouverture de l'onglet (au plus une fois par heure et par ami).
 */

const AUTO_PREF = 'friend.autoPublish'
const fileKey = () => profileDeviceKey(DEVICE_PREFIX + 'friendFileId')
const lastKey = () => profileDeviceKey(DEVICE_PREFIX + 'friendPublished')
export const REFRESH_EVERY = 60 * 60 * 1000

export const autoPublishEnabled = (): boolean => prefGet(profilePrefName(AUTO_PREF), false)
export const myFileId = (): string | null => { const v = lsGet(fileKey()); return isFileId(v) ? v : null }

const today = () => new Date().toISOString().slice(0, 10)

async function currentContent(): Promise<PublishedCode> {
  const [cards, owned] = await Promise.all([db.cards.toArray(), db.owned.toArray()])
  const map = new Map(owned.map((o) => [o.cardId, o.quantity]))
  const name = prefGet(profilePrefName('friend.myName'), '').trim()
  const code = await encodeFriendCode(myFriendCode(cards, map, name, today()))
  return { app: 'holotheque', v: 1, name, date: today(), code }
}

let publishing: Promise<string | null> | null = null

/**
 * Publie mon code si la mise à jour automatique est activée et que le code a changé.
 * `interactive` : clic de l'utilisateur (fenêtre de consentement Google possible). Renvoie l'id du fichier.
 */
export function publishIfEnabled(opts: { interactive?: boolean; force?: boolean } = {}): Promise<string | null> {
  if (!autoPublishEnabled() && !opts.force) return Promise.resolve(null)
  if (publishing) return publishing
  publishing = (async () => {
    try {
      const content = await currentContent()
      const sig = `${content.name}|${content.code}`
      const id = myFileId()
      if (id && !opts.force && lsGet(lastKey()) === sig) return id
      let token = await requestToken({ interactive: !!opts.interactive, scope: FRIEND_SCOPE })
      let newId: string
      try { newId = await publishCode(token, content, id) }
      catch (e) {
        if (!(e instanceof FriendShareError && e.status === 401)) throw e
        dropToken(FRIEND_SCOPE)
        token = await requestToken({ interactive: !!opts.interactive, scope: FRIEND_SCOPE })
        newId = await publishCode(token, content, id)
      }
      lsSet(fileKey(), newId); lsSet(lastKey(), sig)
      return newId
    } finally { publishing = null }
  })()
  return publishing
}

/** Active la mise à jour automatique (clic) : consentement Google puis première publication. */
export async function enableAutoPublish(): Promise<string | null> {
  const id = await publishIfEnabled({ interactive: true, force: true })
  prefSet(profilePrefName(AUTO_PREF), true)
  return id
}

/** Désactive : supprime le fichier public (au mieux) ; les liens déjà envoyés cessent de se mettre à jour. */
export async function disableAutoPublish(): Promise<void> {
  prefSet(profilePrefName(AUTO_PREF), false)
  const id = myFileId()
  lsRemove(fileKey()); lsRemove(lastKey())
  if (!id) return
  try { await unpublishCode(await requestToken({ interactive: true, scope: FRIEND_SCOPE }), id) } catch { /* fichier laissé en place */ }
}

/**
 * Relit les fichiers des amis suivis (au plus une fois par heure, sauf `force`).
 * Renvoie la liste à jour et les erreurs par ami (fichier supprimé, hors connexion…).
 */
export async function refreshFriends(force = false, now = Date.now()): Promise<{ list: SavedFriend[]; changed: boolean; errors: Map<string, string> }> {
  const errors = new Map<string, string>()
  let changed = false
  if (!canReadFriendFiles()) return { list: loadFriends(), changed, errors }
  const due = loadFriends().filter((f) => f.fileId && (force || !f.checkedAt || now - f.checkedAt > REFRESH_EVERY))
  await Promise.all(due.map(async (f) => {
    try {
      const p = await fetchPublishedCode(f.fileId!)
      const newer = p.code !== f.code || p.name !== f.name || p.date !== f.date
      if (newer) changed = true
      updateFriend(f.fileId!, { code: p.code, name: p.name, date: p.date, checkedAt: now })
    } catch (e) {
      errors.set(f.fileId!, (e as Error).message)
      if (e instanceof FriendShareError && e.status === 404) updateFriend(f.fileId!, { checkedAt: now })
    }
  }))
  return { list: loadFriends(), changed, errors }
}
