/** Retrouver sur Google Drive les profils créés sur un autre appareil (même compte Google). */
import { DEVICE_PREFIX, lsSet } from '../storage'
import { listProfiles, profileDeviceKey, PROFILE_COLORS } from '../profiles'
import { createProfile } from '../profileOps'
import { downloadFile, listProfileFiles } from './drive'
import { getSyncState } from './engine'
import { currentToken, requestToken } from './gis'

/** Ajoute les profils trouvés dans le Drive du compte connecté ; renvoie les noms ajoutés. Leur synchro est activée avec ce compte. */
export async function recoverProfilesFromDrive(): Promise<string[]> {
  const st = getSyncState()
  if (!st.enabled) throw new Error('Connecte d’abord la synchro Google Drive')
  const token = currentToken() ?? await requestToken({ interactive: true, hint: st.email ?? undefined })
  const known = new Set(listProfiles().map((p) => p.id))
  const added: string[] = []
  for (const f of await listProfileFiles(token)) {
    if (known.has(f.profileId)) continue
    const snap = await downloadFile(token, f.id).catch(() => null)
    const meta = snap?.profile
    const name = meta?.name || 'Profil'
    const color = meta && (PROFILE_COLORS as readonly string[]).includes(meta.color) ? meta.color : 'blue'
    const p = await createProfile(name, color, f.profileId)
    lsSet(profileDeviceKey(DEVICE_PREFIX + 'sync.enabled', p.id), '1')
    if (st.email) lsSet(profileDeviceKey(DEVICE_PREFIX + 'sync.email', p.id), st.email)
    added.push(p.name)
  }
  return added
}
