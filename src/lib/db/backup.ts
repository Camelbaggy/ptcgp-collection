import type { Booster, Card, CardSet, HistoryEvent, OwnedCard, PackSlotRates, Wishlist } from '../types'
import { stamp } from '../sync/device'
import { exportSettings, importSettings } from '../storage'
import { validateBackup } from '../backupValidate'
import { isSyncSnapshot } from '../sync/merge'
import type { ImportedEvent } from '../events/pokemonZone'
import { db, type MetaRow } from './schema'

// ---------- Sauvegarde ----------

export interface Backup {
  app: 'ptcgp-collection'; version: 1; date: string
  sets: CardSet[]; boosters: Booster[]; cards: Card[]; rates: PackSlotRates[]
  owned: OwnedCard[]; wishlist: Wishlist[]; history: HistoryEvent[]; meta: MetaRow[]
  importedEvents?: ImportedEvent[]
  /** Préférences d'affichage de l'appareil (localStorage `ptcgp:*`, voir storage.ts). */
  settings?: Record<string, string>
}

export async function exportBackup(): Promise<Backup> {
  const [sets, boosters, cards, rates, owned, wishlist, history, meta, importedEvents] = await Promise.all([
    db.sets.toArray(), db.boosters.toArray(), db.cards.toArray(), db.rates.toArray(),
    db.owned.toArray(), db.wishlist.toArray(), db.history.toArray(), db.meta.toArray(), db.importedEvents.toArray(),
  ])
  return { app: 'ptcgp-collection', version: 1, date: new Date().toISOString(), sets, boosters, cards, rates, owned, wishlist, history, meta, importedEvents, settings: exportSettings() }
}

export async function importBackup(data: unknown): Promise<void> {
  if (isSyncSnapshot(data)) {
    // Fichier de synchro (ptcgp-sync.json) : fusion sans perte.
    const { importSyncSnapshot } = await import('../sync/snapshot')
    await importSyncSnapshot(data)
    return
  }
  validateBackup(data)
  const b = data as Partial<Backup>
  const st = stamp()
  const sd = <T extends object>(x: T): T => ({ ...x, ...st })
  await db.transaction('rw', [db.sets, db.boosters, db.cards, db.rates, db.owned, db.wishlist, db.history, db.meta, db.tombstones, db.importedEvents], async () => {
    const [oldOwned, oldWish, oldHist] = await Promise.all([
      db.owned.toCollection().primaryKeys(), db.wishlist.toCollection().primaryKeys(), db.history.toCollection().primaryKeys(),
    ])
    await Promise.all([db.sets, db.boosters, db.cards, db.rates, db.owned, db.wishlist, db.history, db.tombstones].map((t) => t.clear()))
    await db.sets.bulkPut(b.sets ?? [])
    await db.boosters.bulkPut(b.boosters ?? [])
    await db.cards.bulkPut(b.cards ?? [])
    await db.rates.bulkPut(b.rates ?? [])
    // updatedAt = maintenant : la sauvegarde importée se propage aux autres appareils.
    await db.owned.bulkPut((b.owned ?? []).map((r) => sd({ ...r, deleted: undefined })))
    await db.wishlist.bulkPut((b.wishlist ?? []).map((r) => sd({ ...r, deleted: undefined })))
    await db.history.bulkPut((b.history ?? []).map((r) => sd({ ...r, deleted: undefined })))
    // Les clés `meta` absentes du fichier (instantanés Pokémon-Zone, tier list…) sont conservées.
    await db.meta.bulkPut(b.meta ?? [])
    if (Array.isArray(b.importedEvents)) { await db.importedEvents.clear(); await db.importedEvents.bulkPut(b.importedEvents.map((r) => sd(r))) }
    // Les lignes absentes de la sauvegarde sont supprimées aussi sur les autres appareils.
    const tomb = (table: string, keep: Set<string>, old: string[]) =>
      db.tombstones.bulkPut(old.filter((id) => !keep.has(id)).map((id) => ({ key: `${table}:${id}`, table, id, ...st })))
    await tomb('owned', new Set((b.owned ?? []).map((r) => r.cardId)), oldOwned as string[])
    await tomb('wishlist', new Set((b.wishlist ?? []).map((r) => r.cardId)), oldWish as string[])
    await tomb('history', new Set((b.history ?? []).map((r) => r.id)), oldHist as string[])
  })
  // Préférences : appliquées après la transaction, seulement si la sauvegarde en contient.
  importSettings(b.settings)
}

export async function resetUserData(): Promise<void> {
  await db.transaction('rw', db.owned, db.wishlist, db.history, db.tombstones, async () => {
    const st = stamp()
    for (const [table, t] of [['owned', db.owned], ['wishlist', db.wishlist], ['history', db.history]] as const) {
      const keys = (await t.toCollection().primaryKeys()) as string[]
      await db.tombstones.bulkPut(keys.map((id) => ({ key: `${table}:${id}`, table, id, ...st })))
      await t.clear()
    }
  })
}

