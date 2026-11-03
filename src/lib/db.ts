import Dexie, { type Table } from 'dexie'
import type {
  Booster, Card, CardSet, HistoryEvent, OwnedCard, PackSlotRates, Wishlist,
} from './types'
import { applyDeltas, canGive, eventDeltas, invert, newId } from './ops'

export interface MetaRow { key: string; value: unknown }
export type RatesRow = PackSlotRates

class PtcgpDB extends Dexie {
  sets!: Table<CardSet, string>
  boosters!: Table<Booster, string>
  cards!: Table<Card, string>
  rates!: Table<RatesRow, [string, string]>
  owned!: Table<OwnedCard, string>
  wishlist!: Table<Wishlist, string>
  history!: Table<HistoryEvent, string>
  meta!: Table<MetaRow, string>
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
  }
}

export const db = new PtcgpDB()

export const BASE = import.meta.env.BASE_URL

/** URL de l'image d'une carte (chemin relatif à public/). */
export function cardImageUrl(c: Pick<Card, 'id' | 'setId' | 'image'>): string {
  const rel = c.image && c.image.length ? c.image : `cards/${c.setId}/${c.id}.webp`
  return BASE + rel.replace(/^\/+/, '').replace(/^public\//, '')
}

// ---------- Chargement des données de référence ----------

interface DataBundle {
  sets: CardSet[]; boosters: Booster[]; cards: Card[]; rates: PackSlotRates[]
  owned?: OwnedCard[]; wishlist?: Wishlist[]; history?: HistoryEvent[]
  version: string
}

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + ':' + s.length
}

async function fetchText(name: string): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}data/${name}.json`, { cache: 'no-cache' })
    if (!r.ok) return null
    const t = await r.text()
    // Un fallback SPA peut renvoyer du HTML : on l'ignore.
    return t.trim().startsWith('<') ? null : t
  } catch { return null }
}

async function loadBundle(): Promise<DataBundle> {
  const names = ['sets', 'boosters', 'cards', 'rates'] as const
  const texts = await Promise.all(names.map(fetchText))
  if (texts.every((t) => t !== null)) {
    const [sets, boosters, cards, rates] = texts.map((t) => JSON.parse(t!))
    const extra = await Promise.all(['owned', 'wishlist', 'history'].map(fetchText))
    const [owned, wishlist, history] = extra.map((t) => (t ? JSON.parse(t) : undefined))
    const version = hash(texts.join('|'))
    return { sets, boosters, cards, rates, owned, wishlist, history, version }
  }
  // Pas de données livrées : jeu de développement.
  const [s, b, c, r] = await Promise.all([
    import('./fixtures/sets.json'), import('./fixtures/boosters.json'),
    import('./fixtures/cards.json'), import('./fixtures/rates.json'),
  ])
  return {
    sets: s.default as CardSet[], boosters: b.default as Booster[],
    cards: c.default as Card[], rates: r.default as PackSlotRates[], version: 'fixtures',
  }
}

/**
 * Charge public/data/*.json (sets, boosters, cards, rates, + optionnels owned/wishlist/history).
 * Tables de référence remplacées quand la version change (les extensions ajoutées par
 * l'utilisateur, absentes des données livrées, sont conservées).
 * Tables utilisateur remplies seulement si vides.
 */
export async function seedIfNeeded(): Promise<void> {
  const bundle = await loadBundle()
  const cur = await db.meta.get('dataVersion')
  const prevShipped = ((await db.meta.get('shippedSetIds'))?.value as string[] | undefined) ?? []
  const needRef = cur?.value !== bundle.version
  const emptyUser = {
    owned: (await db.owned.count()) === 0,
    wishlist: (await db.wishlist.count()) === 0,
    history: (await db.history.count()) === 0,
  }
  if (!needRef && !emptyUser.owned && !emptyUser.wishlist && !emptyUser.history) return

  await db.transaction('rw', [db.sets, db.boosters, db.cards, db.rates, db.owned, db.wishlist, db.history, db.meta], async () => {
    if (needRef) {
      const drop = new Set([...prevShipped, ...bundle.sets.map((s) => s.id)])
      await db.sets.bulkDelete([...drop])
      await db.boosters.where('setId').anyOf([...drop]).delete()
      await db.cards.where('setId').anyOf([...drop]).delete()
      const boosterIds = new Set(bundle.boosters.map((b) => b.id))
      await db.rates.filter((r) => boosterIds.has(r.boosterId)).delete()
      await db.sets.bulkPut(bundle.sets)
      await db.boosters.bulkPut(bundle.boosters)
      await db.cards.bulkPut(bundle.cards)
      await db.rates.bulkPut(bundle.rates)
      await db.meta.bulkPut([
        { key: 'dataVersion', value: bundle.version },
        { key: 'shippedSetIds', value: bundle.sets.map((s) => s.id) },
      ])
    }
    if (emptyUser.owned && bundle.owned?.length) await db.owned.bulkPut(bundle.owned)
    if (emptyUser.wishlist && bundle.wishlist?.length) await db.wishlist.bulkPut(bundle.wishlist)
    if (emptyUser.history && bundle.history?.length) await db.history.bulkPut(bundle.history)
  })
}

// ---------- Évènements (saisie) ----------

async function currentOwned(ids: string[]): Promise<Map<string, number>> {
  const rows = await db.owned.bulkGet(ids)
  return new Map(ids.map((id, i) => [id, rows[i]?.quantity ?? 0]))
}

async function applyEvent(ev: HistoryEvent, deltas: Map<string, number>): Promise<void> {
  await db.transaction('rw', db.owned, db.history, async () => {
    const ids = [...deltas.keys()]
    const next = applyDeltas(await currentOwned(ids), deltas)
    for (const id of ids) {
      const q = next.get(id)!
      if (q === 0) await db.owned.delete(id)
      else await db.owned.put({ cardId: id, quantity: q })
    }
    await db.history.add(ev)
  })
}

const nowIso = () => new Date().toISOString()

export async function addPack(boosterId: string, cardIds: string[]): Promise<HistoryEvent> {
  if (!cardIds.length) throw new Error('Aucune carte')
  const ev: HistoryEvent = { id: newId(), kind: 'pack', date: nowIso(), boosterId, cardIds }
  await applyEvent(ev, eventDeltas(ev))
  return ev
}

export async function share(cardId: string, direction: 'given' | 'received', friend?: string): Promise<HistoryEvent> {
  if (direction === 'given') {
    const q = (await db.owned.get(cardId))?.quantity ?? 0
    if (!canGive(q)) throw new Error('Il faut au moins 2 exemplaires pour donner une carte')
  }
  const ev: HistoryEvent = { id: newId(), kind: 'share', date: nowIso(), cardId, direction, friend: friend || undefined }
  await applyEvent(ev, eventDeltas(ev))
  return ev
}

export async function trade(given: string, received: string, friend?: string, tokens?: number): Promise<HistoryEvent> {
  const q = (await db.owned.get(given))?.quantity ?? 0
  if (!canGive(q)) throw new Error('Il faut au moins 2 exemplaires pour échanger une carte')
  const ev: HistoryEvent = { id: newId(), kind: 'trade', date: nowIso(), given, received, friend: friend || undefined, tokens }
  await applyEvent(ev, eventDeltas(ev))
  return ev
}

/** Annule le dernier évènement (inverse les quantités et le supprime de l'historique). */
export async function undoLast(): Promise<HistoryEvent | null> {
  return db.transaction('rw', db.owned, db.history, async () => {
    const last = (await db.history.orderBy('date').reverse().first())
    if (!last) return null
    const deltas = invert(eventDeltas(last))
    const ids = [...deltas.keys()]
    const next = applyDeltas(await currentOwned(ids), deltas)
    for (const id of ids) {
      const q = next.get(id)!
      if (q === 0) await db.owned.delete(id)
      else await db.owned.put({ cardId: id, quantity: q })
    }
    await db.history.delete(last.id)
    return last
  })
}

/** Ajustement manuel (fiche carte), sans évènement d'historique. */
export async function setOwned(cardId: string, quantity: number): Promise<void> {
  const q = Math.max(0, Math.floor(quantity))
  if (q === 0) await db.owned.delete(cardId)
  else await db.owned.put({ cardId, quantity: q })
}

export async function setWish(cardId: string, priority: number | null): Promise<void> {
  if (priority === null) await db.wishlist.delete(cardId)
  else await db.wishlist.put({ cardId, priority })
}

/** Sauvegarde d'une nouvelle extension (écran Nouvelle extension). */
export async function saveNewSet(
  set: CardSet, boosters: Booster[], cards: Card[], rates: PackSlotRates[],
): Promise<void> {
  await db.transaction('rw', [db.sets, db.boosters, db.cards, db.rates], async () => {
    await db.sets.put(set)
    await db.boosters.bulkPut(boosters)
    await db.cards.bulkPut(cards)
    await db.rates.bulkPut(rates)
  })
}

// ---------- Sauvegarde ----------

export interface Backup {
  app: 'ptcgp-collection'; version: 1; date: string
  sets: CardSet[]; boosters: Booster[]; cards: Card[]; rates: PackSlotRates[]
  owned: OwnedCard[]; wishlist: Wishlist[]; history: HistoryEvent[]; meta: MetaRow[]
}

export async function exportBackup(): Promise<Backup> {
  const [sets, boosters, cards, rates, owned, wishlist, history, meta] = await Promise.all([
    db.sets.toArray(), db.boosters.toArray(), db.cards.toArray(), db.rates.toArray(),
    db.owned.toArray(), db.wishlist.toArray(), db.history.toArray(), db.meta.toArray(),
  ])
  return { app: 'ptcgp-collection', version: 1, date: nowIso(), sets, boosters, cards, rates, owned, wishlist, history, meta }
}

export async function importBackup(data: unknown): Promise<void> {
  const b = data as Partial<Backup>
  if (!b || b.app !== 'ptcgp-collection' || !Array.isArray(b.owned) || !Array.isArray(b.cards))
    throw new Error('Fichier de sauvegarde invalide')
  await db.transaction('rw', [db.sets, db.boosters, db.cards, db.rates, db.owned, db.wishlist, db.history, db.meta], async () => {
    await Promise.all([db.sets, db.boosters, db.cards, db.rates, db.owned, db.wishlist, db.history, db.meta].map((t) => t.clear()))
    await db.sets.bulkPut(b.sets ?? [])
    await db.boosters.bulkPut(b.boosters ?? [])
    await db.cards.bulkPut(b.cards ?? [])
    await db.rates.bulkPut(b.rates ?? [])
    await db.owned.bulkPut(b.owned ?? [])
    await db.wishlist.bulkPut(b.wishlist ?? [])
    await db.history.bulkPut(b.history ?? [])
    await db.meta.bulkPut(b.meta ?? [])
  })
}

export async function resetUserData(): Promise<void> {
  await db.transaction('rw', db.owned, db.wishlist, db.history, async () => {
    await Promise.all([db.owned.clear(), db.wishlist.clear(), db.history.clear()])
  })
}
