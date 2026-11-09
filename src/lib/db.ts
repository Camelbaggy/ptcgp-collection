import Dexie, { type Table } from 'dexie'
import type {
  Booster, Card, CardSet, HistoryEvent, OwnedCard, PackSlotRates, Wishlist,
} from './types'
import { ASSET_BASE } from './native/platform'
import { stamp } from './sync/device'
import { isSyncSnapshot } from './sync/merge'
import type { ImportedEvent } from './events/pokemonZone'
import { emitReveal, newlyOwnedIds } from './reveal'
import { applyDeltas, canShareCard, canTradeCard, eventDeltas, invert, newId } from './ops'

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
export { REMOTE_BASE } from './native/platform'

/** URL de l'image d'une carte (chemin relatif à public/). */
export function cardImageUrl(c: Pick<Card, 'id' | 'setId' | 'image'>): string {
  const rel = c.image && c.image.length ? c.image : `cards/${c.setId}/${c.id}.webp`
  return ASSET_BASE + rel.replace(/^\/+/, '').replace(/^public\//, '')
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

export interface ReseedPlan { drop: string[]; bundleBoosterIds: Set<string>; rates: PackSlotRates[]; notices: string[] }

/**
 * Prépare le rechargement des tables de référence (hors écriture) :
 * - les taux saisis par l'utilisateur (lignes horodatées) l'emportent sur les taux livrés du même booster,
 *   y compris quand une extension livrée a le même id qu'une extension ajoutée à la main ;
 * - `notices` : extensions livrées nouvelles pour cet appareil (pas déjà présentes, ni livrées avant),
 *   à annoncer sur l'accueil. Vide à la première installation.
 */
export async function planReseed(bundle: Pick<DataBundle, 'sets' | 'boosters' | 'rates'>, prevShipped: string[], hadData: boolean): Promise<ReseedPlan> {
  const bundleBoosterIds = new Set(bundle.boosters.map((b) => b.id))
  const drop = [...new Set([...prevShipped, ...bundle.sets.map((s) => s.id)])]
  const userRates = (await db.rates.toArray()).filter((r) => r.updatedAt && bundleBoosterIds.has(r.boosterId))
  const overridden = new Set(userRates.map((r) => r.boosterId))
  const rates = [...bundle.rates.filter((r) => !overridden.has(r.boosterId)), ...userRates]
  const previous = new Set(prevShipped)
  const notices: string[] = []
  if (hadData && prevShipped.length) {
    const present = new Set((await db.sets.toArray()).map((s) => s.id))
    for (const s of bundle.sets) if (!previous.has(s.id) && !present.has(s.id)) notices.push(s.id)
  }
  return { drop, bundleBoosterIds, rates, notices }
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
      const plan = await planReseed(bundle, prevShipped, cur !== undefined)
      await db.sets.bulkDelete(plan.drop)
      await db.boosters.where('setId').anyOf(plan.drop).delete()
      await db.cards.where('setId').anyOf(plan.drop).delete()
      await db.rates.filter((r) => plan.bundleBoosterIds.has(r.boosterId)).delete()
      await db.sets.bulkPut(bundle.sets)
      await db.boosters.bulkPut(bundle.boosters)
      await db.cards.bulkPut(bundle.cards)
      // Taux saisis par l'utilisateur (ligne horodatée) : prioritaires sur ceux livrés pour le même booster.
      await db.rates.bulkPut(plan.rates)
      await db.meta.bulkPut([
        { key: 'dataVersion', value: bundle.version },
        { key: 'shippedSetIds', value: bundle.sets.map((s) => s.id) },
        ...(plan.notices.length
          ? [{ key: 'newSetNotices', value: [...new Set([...(((await db.meta.get('newSetNotices'))?.value as string[] | undefined) ?? []), ...plan.notices])] }]
          : []),
      ])
    }
    const st = stamp()
    const sd = <T extends object>(x: T): T => ({ ...x, ...st })
    if (emptyUser.owned && bundle.owned?.length) await db.owned.bulkPut(bundle.owned.map(sd))
    if (emptyUser.wishlist && bundle.wishlist?.length) await db.wishlist.bulkPut(bundle.wishlist.map(sd))
    if (emptyUser.history && bundle.history?.length) await db.history.bulkPut(bundle.history.map(sd))
  })
}

// ---------- Évènements (saisie) ----------

async function currentOwned(ids: string[]): Promise<Map<string, number>> {
  const rows = await db.owned.bulkGet(ids)
  return new Map(ids.map((id, i) => [id, rows[i]?.quantity ?? 0]))
}

/** Écrit (ou supprime avec tombstone) une quantité possédée, horodatée pour la synchro. */
async function writeOwned(cardId: string, q: number): Promise<void> {
  const st = stamp()
  if (q === 0) {
    await db.owned.delete(cardId)
    await db.tombstones.put({ key: `owned:${cardId}`, table: 'owned', id: cardId, ...st })
  } else {
    await db.owned.put({ cardId, quantity: q, ...st })
    await db.tombstones.delete(`owned:${cardId}`)
  }
}

async function applyEvent(ev: HistoryEvent, deltas: Map<string, number>): Promise<void> {
  const fresh = await db.transaction('rw', db.owned, db.history, db.tombstones, async () => {
    const ids = [...deltas.keys()]
    const before = await currentOwned(ids)
    const next = applyDeltas(before, deltas)
    for (const id of ids) await writeOwned(id, next.get(id)!)
    await db.history.add({ ...ev, ...stamp() })
    return newlyOwnedIds(before, next)
  })
  emitReveal(fresh)
}

const nowIso = () => new Date().toISOString()

export async function addPack(boosterId: string, cardIds: string[]): Promise<HistoryEvent> {
  if (!cardIds.length) throw new Error('Aucune carte')
  const ev: HistoryEvent = { id: newId(), kind: 'pack', date: nowIso(), boosterId, cardIds }
  await applyEvent(ev, eventDeltas(ev))
  return ev
}

/** Plusieurs packs d'un coup (récap d'ouverture) : un évènement par pack, dans l'ordre, une seule animation de nouvelles cartes. */
export async function addPacks(packs: { boosterId: string; cardIds: string[] }[]): Promise<HistoryEvent[]> {
  const list = packs.filter((p) => p.cardIds.length)
  if (!list.length) throw new Error('Aucune carte')
  const t0 = Date.now()
  const evs: HistoryEvent[] = list.map((p, i) => ({ id: newId(), kind: 'pack', date: new Date(t0 + i).toISOString(), boosterId: p.boosterId, cardIds: p.cardIds }))
  const fresh = await db.transaction('rw', db.owned, db.history, db.tombstones, async () => {
    const all = new Set<string>()
    const seen = new Set<string>()
    for (const ev of evs) {
      const deltas = eventDeltas(ev)
      const ids = [...deltas.keys()]
      const before = await currentOwned(ids)
      const next = applyDeltas(before, deltas)
      for (const id of ids) await writeOwned(id, next.get(id)!)
      await db.history.add({ ...ev, ...stamp() })
      for (const id of newlyOwnedIds(before, next)) if (!seen.has(id)) { seen.add(id); all.add(id) }
    }
    return [...all]
  })
  emitReveal(fresh)
  return evs
}

/** Annule les n derniers évènements (récap de plusieurs boosters). */
export async function undoLastN(n: number): Promise<void> {
  for (let i = 0; i < n; i++) if (!(await undoLast())) break
}

/** Corrige le booster d'un pack déjà enregistré (ne change pas l'inventaire). */
export async function setPackBooster(eventId: string, boosterId: string): Promise<void> {
  await db.transaction('rw', db.history, async () => {
    const ev = await db.history.get(eventId)
    if (!ev || ev.kind !== 'pack' || ev.boosterId === boosterId) return
    await db.history.put({ ...ev, boosterId, ...stamp() })
  })
}

export async function share(cardId: string, direction: 'given' | 'received', friend?: string): Promise<HistoryEvent> {
  if (direction === 'given') {
    const q = (await db.owned.get(cardId))?.quantity ?? 0
    const card = await db.cards.get(cardId)
    if (card && !canShareCard(card.rarity, q)) throw new Error('Carte non partageable (D1–D4, au moins 2 exemplaires)')
  }
  const ev: HistoryEvent = { id: newId(), kind: 'share', date: nowIso(), cardId, direction, friend: friend || undefined }
  await applyEvent(ev, eventDeltas(ev))
  return ev
}

export async function trade(given: string, received: string, friend?: string, tokens?: number): Promise<HistoryEvent> {
  const q = (await db.owned.get(given))?.quantity ?? 0
  const card = await db.cards.get(given)
  if (card && !canTradeCard(card.rarity, q)) throw new Error('Carte non échangeable (D1–D4, E1, E2, S1, S2, au moins 2 exemplaires)')
  const ev: HistoryEvent = { id: newId(), kind: 'trade', date: nowIso(), given, received, friend: friend || undefined, tokens }
  await applyEvent(ev, eventDeltas(ev))
  return ev
}

/** Annule le dernier évènement : inverse les quantités et le retire de l'historique (tombstone pour la synchro). */
export async function undoLast(): Promise<HistoryEvent | null> {
  return db.transaction('rw', db.owned, db.history, db.tombstones, async () => {
    const last = (await db.history.orderBy('date').reverse().filter((e) => !e.deleted).first())
    if (!last) return null
    const deltas = invert(eventDeltas(last))
    const ids = [...deltas.keys()]
    const next = applyDeltas(await currentOwned(ids), deltas)
    for (const id of ids) await writeOwned(id, next.get(id)!)
    await db.history.delete(last.id)
    await db.tombstones.put({ key: `history:${last.id}`, table: 'history', id: last.id, ...stamp() })
    return last
  })
}

/** Mise à jour en masse : fixe les quantités et écrit un évènement 'correction' (annulable). */
export async function applyCorrections(changes: { cardId: string; to: number }[]): Promise<HistoryEvent | null> {
  const fresh: string[] = []
  const ev = await db.transaction('rw', db.owned, db.history, db.tombstones, async () => {
    const rows = await db.owned.bulkGet(changes.map((c) => c.cardId))
    const real = changes
      .map((c, i) => ({ cardId: c.cardId, from: rows[i]?.quantity ?? 0, to: Math.max(0, Math.floor(c.to)) }))
      .filter((c) => c.from !== c.to)
    if (!real.length) return null
    for (const c of real) await writeOwned(c.cardId, c.to)
    fresh.push(...real.filter((c) => c.from === 0 && c.to >= 1).map((c) => c.cardId))
    const ev: HistoryEvent = { id: newId(), kind: 'correction', date: nowIso(), changes: real }
    await db.history.add({ ...ev, ...stamp() })
    return ev
  })
  emitReveal(fresh)
  return ev
}

/** Ajustement manuel (fiche carte), sans évènement d'historique. */
export async function setOwned(cardId: string, quantity: number): Promise<void> {
  const q = Math.max(0, Math.floor(quantity))
  const wasZero = await db.transaction('rw', db.owned, db.tombstones, async () => {
    const before = (await db.owned.get(cardId))?.quantity ?? 0
    await writeOwned(cardId, q)
    return before === 0
  })
  if (wasZero && q >= 1) emitReveal([cardId])
}

export async function setWish(cardId: string, priority: number | null): Promise<void> {
  await db.transaction('rw', db.wishlist, db.tombstones, async () => {
    const st = stamp()
    if (priority === null) {
      await db.wishlist.delete(cardId)
      await db.tombstones.put({ key: `wishlist:${cardId}`, table: 'wishlist', id: cardId, ...st })
    } else {
      await db.wishlist.put({ cardId, priority, ...st })
      await db.tombstones.delete(`wishlist:${cardId}`)
    }
  })
}

/** Sauvegarde d'une nouvelle extension (écran Nouvelle extension). */
export async function saveNewSet(
  set: CardSet, boosters: Booster[], cards: Card[], rates: PackSlotRates[],
): Promise<void> {
  await db.transaction('rw', [db.sets, db.boosters, db.cards, db.rates], async () => {
    const st = stamp()
    const s = <T extends object>(x: T): T => ({ ...x, ...st })
    await db.sets.put(s(set))
    await db.boosters.bulkPut(boosters.map(s))
    await db.cards.bulkPut(cards.map(s))
    await db.rates.bulkPut(rates.map(s))
  })
}

/**
 * Enregistre des taux saisis par l'utilisateur pour des boosters (livrés ou non) : lignes horodatées, donc
 * prioritaires sur les taux livrés (voir planReseed) et synchronisées. Un type de pack retiré est conservé
 * à 0 % (ligne vide) pour que la suppression se propage aussi. Le drapeau « taux estimés » disparaît.
 */
export async function saveRates(boosterIds: string[], rates: PackSlotRates[]): Promise<void> {
  await db.transaction('rw', [db.rates, db.meta, db.boosters], async () => {
    const st = stamp()
    const have = (await db.rates.toArray()).filter((r) => boosterIds.includes(r.boosterId))
    const kept = new Set(rates.map((r) => `${r.boosterId}|${r.packType}`))
    const removed = have.filter((r) => !kept.has(`${r.boosterId}|${r.packType}`) && r.slots.length)
      .map((r): PackSlotRates => ({ boosterId: r.boosterId, packType: r.packType, packTypeRate: 0, slots: [] }))
    await db.rates.bulkDelete(have.map((r) => [r.boosterId, r.packType] as [string, string]))
    await db.rates.bulkPut([...rates, ...removed].map((r) => ({ ...r, ...st })))
    await dismissNewSetNotices((await db.boosters.bulkGet(boosterIds)).map((b) => b?.setId).filter((x): x is string => !!x))
  })
}

/** Retire des annonces « nouvelle extension » les extensions données. */
export async function dismissNewSetNotices(setIds: string[]): Promise<void> {
  const cur = ((await db.meta.get('newSetNotices'))?.value as string[] | undefined) ?? []
  const next = cur.filter((id) => !setIds.includes(id))
  if (next.length !== cur.length) await db.meta.put({ key: 'newSetNotices', value: next })
}

// ---------- Sauvegarde ----------

export interface Backup {
  app: 'ptcgp-collection'; version: 1; date: string
  sets: CardSet[]; boosters: Booster[]; cards: Card[]; rates: PackSlotRates[]
  owned: OwnedCard[]; wishlist: Wishlist[]; history: HistoryEvent[]; meta: MetaRow[]
  importedEvents?: ImportedEvent[]
}

export async function exportBackup(): Promise<Backup> {
  const [sets, boosters, cards, rates, owned, wishlist, history, meta, importedEvents] = await Promise.all([
    db.sets.toArray(), db.boosters.toArray(), db.cards.toArray(), db.rates.toArray(),
    db.owned.toArray(), db.wishlist.toArray(), db.history.toArray(), db.meta.toArray(), db.importedEvents.toArray(),
  ])
  return { app: 'ptcgp-collection', version: 1, date: nowIso(), sets, boosters, cards, rates, owned, wishlist, history, meta, importedEvents }
}

export async function importBackup(data: unknown): Promise<void> {
  if (isSyncSnapshot(data)) {
    // Fichier de synchro (ptcgp-sync.json) : fusion sans perte.
    const { importSyncSnapshot } = await import('./sync/snapshot')
    await importSyncSnapshot(data)
    return
  }
  const b = data as Partial<Backup>
  if (!b || b.app !== 'ptcgp-collection' || !Array.isArray(b.owned) || !Array.isArray(b.cards))
    throw new Error('Fichier de sauvegarde invalide')
  const st = stamp()
  const sd = <T extends object>(x: T): T => ({ ...x, ...st })
  await db.transaction('rw', [db.sets, db.boosters, db.cards, db.rates, db.owned, db.wishlist, db.history, db.meta, db.tombstones, db.importedEvents], async () => {
    const [oldOwned, oldWish, oldHist] = await Promise.all([
      db.owned.toCollection().primaryKeys(), db.wishlist.toCollection().primaryKeys(), db.history.toCollection().primaryKeys(),
    ])
    await Promise.all([db.sets, db.boosters, db.cards, db.rates, db.owned, db.wishlist, db.history, db.meta, db.tombstones].map((t) => t.clear()))
    await db.sets.bulkPut(b.sets ?? [])
    await db.boosters.bulkPut(b.boosters ?? [])
    await db.cards.bulkPut(b.cards ?? [])
    await db.rates.bulkPut(b.rates ?? [])
    // updatedAt = maintenant : la sauvegarde importée se propage aux autres appareils.
    await db.owned.bulkPut((b.owned ?? []).map((r) => sd({ ...r, deleted: undefined })))
    await db.wishlist.bulkPut((b.wishlist ?? []).map((r) => sd({ ...r, deleted: undefined })))
    await db.history.bulkPut((b.history ?? []).map((r) => sd({ ...r, deleted: undefined })))
    await db.meta.bulkPut(b.meta ?? [])
    if (Array.isArray(b.importedEvents)) { await db.importedEvents.clear(); await db.importedEvents.bulkPut(b.importedEvents.map((r) => sd(r))) }
    // Les lignes absentes de la sauvegarde sont supprimées aussi sur les autres appareils.
    const tomb = (table: string, keep: Set<string>, old: string[]) =>
      db.tombstones.bulkPut(old.filter((id) => !keep.has(id)).map((id) => ({ key: `${table}:${id}`, table, id, ...st })))
    await tomb('owned', new Set((b.owned ?? []).map((r) => r.cardId)), oldOwned as string[])
    await tomb('wishlist', new Set((b.wishlist ?? []).map((r) => r.cardId)), oldWish as string[])
    await tomb('history', new Set((b.history ?? []).map((r) => r.id)), oldHist as string[])
  })
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

// ---------- Évènements importés (Pokémon-Zone) ----------

/** Enregistre (upsert par id) des évènements importés ; chaque ligne est horodatée pour la synchro. */
export async function saveImportedEvents(events: ImportedEvent[]): Promise<void> {
  const st = stamp()
  await db.importedEvents.bulkPut(events.map((e) => ({ ...e, ...st })))
}
