/** Opérations sur les bases des profils (création avec données communes, résumé, suppression, changement). */
import Dexie from 'dexie'
import { PtcgpDB, db } from './db/schema'
import { EVENTS_SYNC_KEY } from './events/autoSync'
import { PM_KEY } from './pocketMads/store'
import {
  MAIN_PROFILE_ID, activeProfileId, addProfile, dbNameFor, forgetProfile, setActiveProfile, type Profile,
} from './profiles'

/** Clés `meta` communes à tout le foyer, recopiées dans un nouveau profil pour ne pas l'ouvrir vide. */
const SHARED_META = [PM_KEY, EVENTS_SYNC_KEY]

/** Crée un profil et recopie depuis la base active ce qui ne dépend pas du joueur (évènements, tier list). */
export async function createProfile(name: string, color: string, id?: string): Promise<Profile> {
  const p = addProfile(name, color, id)
  const target = new PtcgpDB(dbNameFor(p.id))
  try {
    const [events, meta] = await Promise.all([db.importedEvents.toArray(), db.meta.bulkGet(SHARED_META)])
    await target.transaction('rw', target.importedEvents, target.meta, async () => {
      if (!(await target.importedEvents.count())) await target.importedEvents.bulkPut(events)
      for (const m of meta) if (m && !(await target.meta.get(m.key))) await target.meta.put(m)
    })
  } finally { target.close() }
  return p
}

export interface ProfileSummary { owned: number }

/** Nombre de cartes différentes possédées dans un profil (sans changer de profil). */
export async function profileSummary(id: string): Promise<ProfileSummary> {
  if (id === activeProfileId()) return { owned: await db.owned.filter((o) => !o.deleted && o.quantity > 0).count() }
  if (!(await Dexie.exists(dbNameFor(id)))) return { owned: 0 }
  const other = new PtcgpDB(dbNameFor(id))
  try { return { owned: await other.owned.filter((o) => !o.deleted && o.quantity > 0).count() } } finally { other.close() }
}

/** Supprime un profil non actif : base effacée, clés locales retirées. Le fichier Drive est conservé. */
export async function deleteProfile(id: string): Promise<void> {
  if (id === MAIN_PROFILE_ID) throw new Error('Le profil principal ne peut pas être supprimé')
  if (id === activeProfileId()) throw new Error('Passe sur un autre profil avant de supprimer celui-ci')
  await Dexie.delete(dbNameFor(id))
  forgetProfile(id)
}

/** Passe sur un profil : la page est rechargée pour tout repartir sur sa base. */
export function switchProfile(id: string): void {
  if (id === activeProfileId()) return
  setActiveProfile(id)
  location.reload()
}
