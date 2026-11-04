/**
 * Fusion pure de deux snapshots de synchro (local / distant).
 * - Chaque ligne a updatedAt (ISO), by (appareil) et éventuellement deleted (tombstone).
 * - Last-writer-wins par clé ; à égalité d'updatedAt, départage déterministe par `by`
 *   (puis tombstone, puis contenu), donc la fusion est commutative.
 * - Historique : union par id ; une suppression (undo) l'emporte toujours.
 */
export const SYNC_TABLES = ['owned', 'wishlist', 'history', 'sets', 'boosters', 'cards', 'rates'] as const
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
  ({ owned: [], wishlist: [], history: [], sets: [], boosters: [], cards: [], rates: [] })

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
}

const noKeys = (): Record<SyncTable, string[]> =>
  ({ owned: [], wishlist: [], history: [], sets: [], boosters: [], cards: [], rates: [] })

export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot | null): MergeResult {
  const r = remote ?? emptySnapshot()
  const tables = emptyTables()
  const localChanges = noKeys(), remoteChanges = noKeys()
  for (const t of SYNC_TABLES) {
    const L = new Map(local.tables[t].map((x) => [rowKey(t, x), x]))
    const R = new Map((r.tables[t] ?? []).map((x) => [rowKey(t, x), x]))
    const keys = [...new Set([...L.keys(), ...R.keys()])].sort()
    for (const k of keys) {
      const a = L.get(k), b = R.get(k)
      const m = a && b ? mergeRow(t, a, b) : (a ?? b)!
      tables[t].push(m)
      if (!a || canon(a) !== canon(m)) localChanges[t].push(k)
      if (!b || canon(b) !== canon(m)) remoteChanges[t].push(k)
    }
  }
  const updatedAt = [local.updatedAt, r.updatedAt].sort().pop() ?? ''
  return { merged: { app: 'ptcgp-sync', version: 1, deviceId: local.deviceId, updatedAt, tables }, localChanges, remoteChanges }
}

export const countKeys = (c: Record<SyncTable, string[]>) => SYNC_TABLES.reduce((n, t) => n + c[t].length, 0)

export function isSyncSnapshot(x: unknown): x is SyncSnapshot {
  const s = x as Partial<SyncSnapshot> | null
  return !!s && s.app === 'ptcgp-sync' && s.version === 1 && !!s.tables && typeof s.tables === 'object'
}
