import { db } from '../db'
import { deviceId } from './device'
import {
  SYNC_TABLES, TOMBSTONE_TTL_MS, emptyTables, mergeSnapshots, rowKey, countKeys,
  type MergeResult, type SyncRow, type SyncSnapshot, type SyncTable,
} from './merge'

/** Vrai pendant que la synchro écrit des lignes reçues : les écouteurs de changements locaux l'ignorent (pas de resynchro en boucle). */
let applying = false
export const isApplyingSync = () => applying

const ALL_TABLES = () => [db.sets, db.boosters, db.cards, db.rates, db.owned, db.wishlist, db.history, db.meta, db.tombstones, db.importedEvents]

async function shippedSetIds(): Promise<Set<string>> {
  return new Set(((await db.meta.get('shippedSetIds'))?.value as string[] | undefined) ?? [])
}

/** Lit la base locale sous forme de snapshot (à appeler dans une transaction). Seules les extensions ajoutées par l'utilisateur sont incluses. */
export async function buildSnapshot(): Promise<SyncSnapshot> {
  const shipped = await shippedSetIds()
  const [owned, wishlist, history, sets, boosters, cards, rates, tombs, events] = await Promise.all([
    db.owned.toArray(), db.wishlist.toArray(), db.history.toArray(),
    db.sets.toArray(), db.boosters.toArray(), db.cards.toArray(), db.rates.toArray(), db.tombstones.toArray(), db.importedEvents.toArray(),
  ])
  const userSets = sets.filter((s) => !shipped.has(s.id))
  const userSetIds = new Set(userSets.map((s) => s.id))
  const userBoosters = boosters.filter((b) => userSetIds.has(b.setId))
  const ub = new Set(userBoosters.map((b) => b.id))
  const t = emptyTables()
  t.owned = owned as unknown as SyncRow[]
  t.wishlist = wishlist as unknown as SyncRow[]
  t.history = history as unknown as SyncRow[]
  t.sets = userSets as unknown as SyncRow[]
  t.boosters = userBoosters as unknown as SyncRow[]
  t.cards = cards.filter((c) => userSetIds.has(c.setId)) as unknown as SyncRow[]
  // + taux saisis par l'utilisateur pour des boosters livrés (lignes horodatées)
  t.rates = rates.filter((r) => ub.has(r.boosterId) || r.updatedAt) as unknown as SyncRow[]
  t.importedEvents = events as unknown as SyncRow[]
  for (const tb of tombs) {
    const base = { deleted: true, updatedAt: tb.updatedAt, by: tb.by }
    if (tb.table === 'owned' || tb.table === 'wishlist') t[tb.table].push({ cardId: tb.id, ...base })
    else if (tb.table === 'history' || tb.table === 'importedEvents') t[tb.table].push({ id: tb.id, ...base })
  }
  const all = SYNC_TABLES.flatMap((n) => t[n].map((r) => r.updatedAt ?? ''))
  return { app: 'ptcgp-sync', version: 1, deviceId: deviceId(), updatedAt: all.sort().pop() ?? '', tables: t }
}

/** Écrit en base les lignes fusionnées qui diffèrent du local. À appeler dans une transaction. */
export async function applyChanges(res: MergeResult): Promise<void> {
  applying = true
  try { await applyChangesInner(res) } finally { applying = false }
}

async function applyChangesInner(res: MergeResult): Promise<void> {
  const shipped = await shippedSetIds()
  for (const name of SYNC_TABLES) {
    const keys = new Set(res.localChanges[name])
    if (!keys.size) continue
    const rows = res.merged.tables[name].filter((r) => keys.has(rowKey(name, r)))
    const live: SyncRow[] = []
    for (const r of rows) {
      if (name === 'sets' && shipped.has(String(r.id))) continue
      if ((name === 'boosters' || name === 'cards') && shipped.has(String(r.setId))) continue
      if (r.deleted) {
        if (name === 'owned' || name === 'wishlist' || name === 'history' || name === 'importedEvents') {
          const id = String(name === 'history' || name === 'importedEvents' ? r.id : r.cardId)
          await db.table(name).delete(id)
          await db.tombstones.put({ key: `${name}:${id}`, table: name, id, updatedAt: r.updatedAt ?? '', by: r.by ?? '' })
        }
        continue
      }
      live.push(r)
      if (name === 'owned' || name === 'wishlist') await db.tombstones.delete(`${name}:${r.cardId}`)
      if (name === 'history' || name === 'importedEvents') await db.tombstones.delete(`${name}:${r.id}`)
    }
    if (live.length) await db.table(name).bulkPut(live)
  }
}

export interface SyncStats { owned: number; history: number; other: number; total: number; toUpload: boolean; /** quantités recalculées depuis l'historique */ rebased: number }

/** Fusionne `remote` dans la base locale en une seule transaction ; renvoie le snapshot à téléverser si besoin. */
export async function mergeIntoLocal(remote: SyncSnapshot | null): Promise<{ result: MergeResult; stats: SyncStats }> {
  return db.transaction('rw', ALL_TABLES(), async () => {
    // purge des marques de suppression de plus de 90 jours (locales)
    const cutoff = new Date(Date.now() - TOMBSTONE_TTL_MS).toISOString()
    applying = true
    try { await db.tombstones.where('key').above('').filter((tb) => !!tb.updatedAt && tb.updatedAt < cutoff).delete() } finally { applying = false }
    const local = await buildSnapshot()
    const result = mergeSnapshots(local, remote)
    await applyChanges(result)
    const lc = result.localChanges
    const stats: SyncStats = {
      owned: lc.owned.length,
      history: lc.history.length,
      other: countKeys(lc) - lc.owned.length - lc.history.length,
      total: countKeys(lc),
      toUpload: remote === null || countKeys(result.remoteChanges) > 0,
      rebased: result.rebased.length,
    }
    return { result, stats }
  })
}

export async function importSyncSnapshot(s: SyncSnapshot): Promise<void> {
  await mergeIntoLocal(s)
}

export async function exportSyncSnapshot(): Promise<SyncSnapshot> {
  return db.transaction('r', ALL_TABLES(), buildSnapshot)
}

export type { SyncTable }
