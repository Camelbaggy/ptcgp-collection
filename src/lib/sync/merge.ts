/**
 * Fusion pure de deux snapshots de synchro (local / distant).
 * - Chaque ligne a updatedAt (ISO), by (appareil) et éventuellement deleted (tombstone).
 * - Last-writer-wins par clé ; à égalité d'updatedAt, départage déterministe par `by`
 *   (puis tombstone, puis contenu), donc la fusion est commutative.
 * - Historique : union par id ; une suppression (undo) l'emporte toujours.
 * - Quantités (`owned`) : la ligne gagnante est ensuite rebasée sur l'historique fusionné, pour ne perdre
 *   aucun pack saisi hors ligne sur deux appareils (docs/sync.md). Une ligne recalculée prend le tampon
 *   `now` de l'appareil local.
 */
import { rebaseOwned, type Side } from './rebase'

export const SYNC_TABLES = ['owned', 'wishlist', 'history', 'sets', 'boosters', 'cards', 'rates', 'importedEvents'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

export type SyncRow = Record<string, unknown> & { updatedAt?: string; by?: string; deleted?: boolean }

export interface SyncSnapshot {
  app: 'ptcgp-sync'
  version: 1
  deviceId: string
  updatedAt: string
  tables: Record<SyncTable, SyncRow[]>
}

export const emptyTables = (): Record<SyncTable, SyncRow[]> =>
  ({ owned: [], wishlist: [], history: [], sets: [], boosters: [], cards: [], rates: [], importedEvents: [] })

export function emptySnapshot(deviceId = ''): SyncSnapshot {
  return { app: 'ptcgp-sync', version: 1, deviceId, updatedAt: '', tables: emptyTables() }
}

export function rowKey(table: SyncTable, r: SyncRow): string {
  switch (table) {
    case 'owned': case 'wishlist': return String(r.cardId)
    case 'rates': return `${r.boosterId}|${r.packType}`
    default: return String(r.id)
  }
}

/** JSON canonique (clés triées, undefined ignoré) pour comparer deux lignes. */
export function canon(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as object).filter(([, y]) => y !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x)
}

const ts = (r: SyncRow) => r.updatedAt ?? ''

/** Vrai si a l'emporte sur b. */
function newer(a: SyncRow, b: SyncRow): boolean {
  if (ts(a) !== ts(b)) return ts(a) > ts(b)
  const ba = a.by ?? '', bb = b.by ?? ''
  if (ba !== bb) return ba > bb
  if (!!a.deleted !== !!b.deleted) return !!a.deleted
  return canon(a) >= canon(b)
}

export function mergeRow(table: SyncTable, a: SyncRow, b: SyncRow): SyncRow {
  if (table === 'history') {
    const dead = a.deleted || b.deleted
    const base = !a.deleted ? a : !b.deleted ? b : newer(a, b) ? a : b
    if (!dead) return newer(a, b) ? a : b
    const updatedAt = ts(a) > ts(b) ? ts(a) : ts(b)
    const dels = [a, b].filter((r) => r.deleted)
    const by = dels.sort((x, y) => (newer(x, y) ? -1 : 1))[0].by
    return { ...base, deleted: true, updatedAt: updatedAt || undefined, by }
  }
  return newer(a, b) ? a : b
}

export interface MergeResult {
  merged: SyncSnapshot
  /** Clés dont la valeur fusionnée diffère du local (à écrire en base). */
  localChanges: Record<SyncTable, string[]>
  /** Clés dont la valeur fusionnée diffère du distant (à téléverser). */
  remoteChanges: Record<SyncTable, string[]>
  /** Cartes dont la quantité a été recalculée depuis l'historique fusionné (docs/sync.md). */
  rebased: string[]
}

const noKeys = (): Record<SyncTable, string[]> =>
  ({ owned: [], wishlist: [], history: [], sets: [], boosters: [], cards: [], rates: [], importedEvents: [] })

/** Les marques de suppression plus vieilles que ça sont purgées (un appareil resté hors ligne plus longtemps pourrait ressusciter la ligne). */
export const TOMBSTONE_TTL_MS = 90 * 24 * 3600 * 1000

/** Vrai si la ligne est une marque de suppression assez ancienne pour être oubliée. */
export function isExpiredTombstone(r: SyncRow, now: number): boolean {
  return !!r.deleted && !!r.updatedAt && r.updatedAt < new Date(now - TOMBSTONE_TTL_MS).toISOString()
}

/**
 * Fusionne local et distant.
 * - `updatedAt` des lignes distantes est borné à `now` : un appareil dont l'horloge avance ne gagne pas tous les conflits.
 * - Les marques de suppression de plus de 90 jours sont retirées du résultat (et signalées comme à réécrire côté distant).
 */
export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot | null, now = Date.now()): MergeResult {
  const r = remote ?? emptySnapshot()
  const nowIso = new Date(now).toISOString()
  const tables = emptyTables()
  const localChanges = noKeys(), remoteChanges = noKeys()
  const sides: Partial<Record<SyncTable, { L: Map<string, SyncRow>; R: Map<string, SyncRow>; keys: string[] }>> = {}
  for (const t of SYNC_TABLES) {
    const L = new Map(local.tables[t].filter((x) => !isExpiredTombstone(x, now)).map((x) => [rowKey(t, x), x]))
    const rawRemote = r.tables[t] ?? []
    const R = new Map(rawRemote.filter((x) => !isExpiredTombstone(x, now)).map((x) => [rowKey(t, x), x]))
    for (const x of rawRemote) if (isExpiredTombstone(x, now)) remoteChanges[t].push(rowKey(t, x))
    const keys = [...new Set([...L.keys(), ...R.keys()])].sort()
    sides[t] = { L, R, keys }
    for (const k of keys) {
      const a = L.get(k), b = R.get(k)
      const bc = b && b.updatedAt && b.updatedAt > nowIso ? { ...b, updatedAt: nowIso } : b
      tables[t].push(a && bc ? mergeRow(t, a, bc) : (a ?? bc)!)
    }
  }

  // Quantités : la ligne gagnante est rebasée sur l'historique fusionné (évènements qu'elle ignorait).
  const rebased: string[] = []
  {
    const { L } = sides.owned!
    const winners = new Map<string, { quantity: number; side: Side }>()
    for (const m of tables.owned) {
      const k = rowKey('owned', m)
      winners.set(k, { quantity: m.deleted ? 0 : Number(m.quantity) || 0, side: L.get(k) === m ? 'local' : 'remote' })
    }
    const next = rebaseOwned(winners, { local: local.tables.history, remote: r.tables.history ?? [], merged: tables.history })
    if (next.size) {
      const stamp = { updatedAt: nowIso, by: local.deviceId }
      tables.owned = tables.owned.map((m) => {
        const k = rowKey('owned', m)
        const q = next.get(k)
        if (q === undefined) return m
        rebased.push(k)
        return q > 0 ? { cardId: k, quantity: q, ...stamp } : { cardId: k, deleted: true, ...stamp }
      })
    }
  }

  for (const t of SYNC_TABLES) {
    const { L, R } = sides[t]!
    for (const m of tables[t]) {
      const k = rowKey(t, m)
      const a = L.get(k), b = R.get(k)
      if (!a || canon(a) !== canon(m)) localChanges[t].push(k)
      if (!b || canon(b) !== canon(m)) remoteChanges[t].push(k)
    }
  }
  const updatedAt = [local.updatedAt, r.updatedAt, ...(rebased.length ? [nowIso] : [])].sort().pop() ?? ''
  return { merged: { app: 'ptcgp-sync', version: 1, deviceId: local.deviceId, updatedAt, tables }, localChanges, remoteChanges, rebased }
}

export const countKeys = (c: Record<SyncTable, string[]>) => SYNC_TABLES.reduce((n, t) => n + c[t].length, 0)

export function isSyncSnapshot(x: unknown): x is SyncSnapshot {
  const s = x as Partial<SyncSnapshot> | null
  return !!s && s.app === 'ptcgp-sync' && s.version === 1 && !!s.tables && typeof s.tables === 'object'
}
