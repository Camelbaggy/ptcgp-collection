import { useLiveQuery } from 'dexie-react-hooks'
import { db, setWish } from '../db'
import type { Card } from '../types'
import { resolvePzImage } from './resolve'
import type { PzHome, PzStats, PzThemed } from './types'

/**
 * Instantanés du profil Pokémon-Zone, rangés dans la table `meta` (`pz.home`, `pz.stats`,
 * `pz.themed`). Ils servent de point de départ : l'appli complète ensuite avec ce qui est saisi
 * après `fetchedAt` (boosters, cartes obtenues). Synchronisés par Drive (table `pz` de la synchro, le plus récent `fetchedAt` gagne).
 */
export interface PzSnapshot<T> { fetchedAt: string; data: T }
export interface PzSnapshots { home: PzHome; stats: PzStats; themed: PzThemed }
export type PzSnapshotKind = keyof PzSnapshots

const key = (k: PzSnapshotKind) => `pz.${k}`

export async function savePzSnapshot<K extends PzSnapshotKind>(kind: K, data: PzSnapshots[K], fetchedAt = new Date().toISOString()): Promise<void> {
  await db.meta.put({ key: key(kind), value: { fetchedAt, data } satisfies PzSnapshot<PzSnapshots[K]> })
}

export async function getPzSnapshot<K extends PzSnapshotKind>(kind: K): Promise<PzSnapshot<PzSnapshots[K]> | undefined> {
  return (await db.meta.get(key(kind)))?.value as PzSnapshot<PzSnapshots[K]> | undefined
}

/** Instantané courant (null tant qu'aucun import ; undefined pendant le chargement). */
export function usePzSnapshot<K extends PzSnapshotKind>(kind: K): PzSnapshot<PzSnapshots[K]> | null | undefined {
  return useLiveQuery(async () => ((await db.meta.get(key(kind)))?.value as PzSnapshot<PzSnapshots[K]> | undefined) ?? null, [kind])
}

/**
 * Ajoute les souhaits Pokémon-Zone à la liste (priorité 2), sans toucher aux cartes déjà
 * souhaitées ni retirer celles qui n'y sont plus.
 */
export async function importPzWishlist(images: string[], cards: Card[]): Promise<{ added: Card[]; already: number; unknown: string[] }> {
  const existing = new Set((await db.wishlist.toArray()).map((w) => w.cardId))
  const added: Card[] = []
  const unknown: string[] = []
  let already = 0
  for (const img of images) {
    const c = resolvePzImage(img, cards)
    if (!c) { unknown.push(img); continue }
    if (existing.has(c.id)) { already++; continue }
    existing.add(c.id)
    await setWish(c.id, 2)
    added.push(c)
  }
  return { added, already, unknown }
}
