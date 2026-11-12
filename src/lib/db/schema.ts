import Dexie, { type Table } from 'dexie'
import type {
  Booster, Card, CardSet, HistoryEvent, OwnedCard, PackSlotRates, Wishlist,
} from '../types'
import { ASSET_BASE } from '../native/platform'
import { stamp } from '../sync/device'
import type { ImportedEvent } from '../events/pokemonZone'

export interface MetaRow { key: string; value: unknown }
export type RatesRow = PackSlotRates
/** Suppression logique d'une ligne utilisateur (synchro) : la ligne vivante est retirée, la trace reste ici. */
export interface TombstoneRow { key: string; table: string; id: string; updatedAt: string; by: string }

class PtcgpDB extends Dexie {
  sets!: Table<CardSet, string>
  boosters!: Table<Booster, string>
  cards!: Table<Card, string>
  rates!: Table<RatesRow, [string, string]>
  owned!: Table<OwnedCard, string>
  wishlist!: Table<Wishlist, string>
  history!: Table<HistoryEvent, string>
  meta!: Table<MetaRow, string>
  tombstones!: Table<TombstoneRow, string>
  importedEvents!: Table<ImportedEvent, string>
  constructor() {
    super('ptcgp')
    this.version(1).stores({
      sets: 'id, order',
      boosters: 'id, setId',
      cards: 'id, setId, rarity, *boosterIds',
      rates: '[boosterId+packType], boosterId',
      owned: 'cardId',
      wishlist: 'cardId, priority',
      history: 'id, date, kind',
      meta: 'key',
    })
    // v2 : synchro (updatedAt par ligne + tombstones pour les suppressions).
    this.version(2).stores({ tombstones: 'key' }).upgrade(async (tx) => {
      const st = stamp()
      for (const t of ['owned', 'wishlist', 'history']) {
        await tx.table(t).toCollection().modify((r: { updatedAt?: string; by?: string }) => { r.updatedAt ??= st.updatedAt; r.by ??= st.by })
      }
      const shipped = new Set(((await tx.table('meta').get('shippedSetIds'))?.value as string[] | undefined) ?? [])
      const user = new Set<string>()
      await tx.table('sets').toCollection().modify((r: { id: string; updatedAt?: string; by?: string }) => {
        if (shipped.has(r.id)) return
        user.add(r.id); r.updatedAt ??= st.updatedAt; r.by ??= st.by
      })
      const stampIf = (r: { setId?: string; boosterId?: string; updatedAt?: string; by?: string }) => { r.updatedAt ??= st.updatedAt; r.by ??= st.by }
      await tx.table('boosters').toCollection().modify((r: { setId: string }) => { if (user.has(r.setId)) stampIf(r) })
      await tx.table('cards').toCollection().modify((r: { setId: string }) => { if (user.has(r.setId)) stampIf(r) })
      const ub = new Set((await tx.table('boosters').toArray()).filter((b: { setId: string }) => user.has(b.setId)).map((b: { id: string }) => b.id))
      await tx.table('rates').toCollection().modify((r: { boosterId: string }) => { if (ub.has(r.boosterId)) stampIf(r) })
    })
    // v3 : évènements importés depuis Pokémon-Zone (synchronisés, LWW par id).
    this.version(3).stores({ importedEvents: 'id, start, end, type' })
  }
}

export const db = new PtcgpDB()

export const BASE = import.meta.env.BASE_URL
export { REMOTE_BASE } from '../native/platform'

/** URL de l'image d'une carte (chemin relatif à public/). */
export function cardImageUrl(c: Pick<Card, 'id' | 'setId' | 'image'>): string {
  const rel = c.image && c.image.length ? c.image : `cards/${c.setId}/${c.id}.webp`
  return ASSET_BASE + rel.replace(/^\/+/, '').replace(/^public\//, '')
}

