import type { Booster, Card, CardSet, HistoryEvent, PackSlotRates } from '../types'
import { deviceId, stamp } from '../sync/device'
import type { ImportedEvent } from '../events/pokemonZone'
import { emitReveal, newlyOwnedIds } from '../reveal'
import { applyDeltas, canShareCard, canTradeCard, eventDeltas, invert, newId, pickUndoable } from '../ops'
import { db } from './schema'
import { editImpact, replaceDeltas, validateEvent } from '../historyEdit'

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

/** Date d'évènement strictement croissante sur cet appareil (deux saisies dans la même milliseconde restent ordonnées pour l'annulation). */
let lastEventMs = 0
const nowIso = () => { lastEventMs = Math.max(Date.now(), lastEventMs + 1); return new Date(lastEventMs).toISOString() }

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

/** Erreur d'annulation dont le message est destiné à l'utilisateur. */
export class UndoError extends Error {}

/** Annule le dernier évènement de cet appareil : inverse les quantités et le retire de l'historique (tombstone pour la synchro). */
export async function undoLast(): Promise<HistoryEvent | null> {
  return db.transaction('rw', db.owned, db.history, db.tombstones, async () => {
    const all = await db.history.toArray()
    const last = pickUndoable(all, deviceId())
    if (!last) {
      if (all.some((e) => !e.deleted)) throw new UndoError('Rien à annuler ici : les derniers évènements viennent d’un autre appareil. Annule-les depuis cet appareil-là.')
      return null
    }
    const deltas = invert(eventDeltas(last))
    const ids = [...deltas.keys()]
    let next: Map<string, number>
    try { next = applyDeltas(await currentOwned(ids), deltas) } catch {
      throw new UndoError('Impossible d’annuler : les cartes concernées ont changé depuis (échange, partage ou correction). Corrige les quantités à la main dans la Collection.')
    }
    for (const id of ids) await writeOwned(id, next.get(id)!)
    await db.history.delete(last.id)
    await db.tombstones.put({ key: `history:${last.id}`, table: 'history', id: last.id, ...stamp() })
    return last
  })
}

/**
 * Modifie ou supprime n'importe quel évènement (lot E3, voir `lib/historyEdit.ts`) : retire `oldId` (marque de
 * suppression pour la synchro) et ajoute `next` sous un nouvel id, à la date de l'ancien ; les quantités sont
 * recalculées, sauf pour les cartes qu'une mise à jour plus récente a déjà fixées. Avec `oldId` nul, réinsère
 * `next` à sa propre date (sert à « Annuler » une modification). Renvoie de quoi revenir en arrière.
 */
export async function rewriteEvent(oldId: string | null, next: HistoryEvent | null): Promise<{ removed: HistoryEvent | null; added: HistoryEvent | null }> {
  const res = await db.transaction('rw', db.owned, db.history, db.tombstones, async () => {
    const old = oldId ? (await db.history.get(oldId)) ?? null : null
    if (oldId && !old) throw new UndoError('Cet évènement n’existe plus (supprimé ou modifié sur un autre appareil).')
    let added: HistoryEvent | null = null
    if (next) {
      const err = validateEvent(next)
      if (err) throw new UndoError(err)
      const { updatedAt: _u, by: _b, deleted: _d, ...body } = next
      added = { ...body, id: newId(), date: old?.date ?? next.date } as HistoryEvent
    }
    const all = (await db.history.toArray()).filter((e) => !e.deleted)
    const ids = [...replaceDeltas(old, added).keys()]
    const before = await currentOwned(ids)
    const lines = editImpact(old, added, all, before)
    for (const l of lines) if (l.after !== l.before) await writeOwned(l.cardId, l.after)
    if (old) {
      await db.history.delete(old.id)
      await db.tombstones.put({ key: `history:${old.id}`, table: 'history', id: old.id, ...stamp() })
    }
    if (added) await db.history.add({ ...added, ...stamp() })
    const removed = old ? (({ updatedAt: _u, by: _b, ...rest }) => rest as HistoryEvent)(old) : null
    return { removed, added, fresh: lines.filter((l) => l.before === 0 && l.after > 0).map((l) => l.cardId) }
  })
  emitReveal(res.fresh)
  return { removed: res.removed, added: res.added }
}

/** À brancher sur `undoLast().catch(...)` : affiche le message clair au lieu d'une erreur brute. */
export function onUndoError(toast: (msg: string) => void): (e: unknown) => void {
  return (e) => toast(e instanceof UndoError ? e.message : 'Annulation impossible.')
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

// ---------- Évènements importés (Pokémon-Zone) ----------

/** Enregistre (upsert par id) des évènements importés ; chaque ligne est horodatée pour la synchro. */
export async function saveImportedEvents(events: ImportedEvent[]): Promise<void> {
  const st = stamp()
  await db.importedEvents.bulkPut(events.map((e) => ({ ...e, ...st })))
}

const eventBody = (e: ImportedEvent) => { const { updatedAt: _u, by: _b, ...rest } = e; return JSON.stringify(rest) }

/**
 * Synchro des pages Pokémon-Zone : enregistre les évènements nouveaux ou modifiés (les lignes identiques ne sont pas
 * réécrites, pour ne pas tout renvoyer à la synchro Drive), et retire ceux qui n'ont pas encore commencé mais ne sont
 * plus annoncés (renommés, déplacés ou annulés). Renvoie le nombre de lignes écrites et retirées.
 */
export async function syncImportedEvents(events: ImportedEvent[], now = Date.now()): Promise<{ written: number; removed: number; fresh: number }> {
  const st = stamp()
  return db.transaction('rw', db.importedEvents, db.tombstones, async () => {
    const old = new Map((await db.importedEvents.toArray()).map((e) => [e.id, e]))
    const changed = events.filter((e) => { const p = old.get(e.id); return !p || eventBody(p) !== eventBody(e) })
    const keep = new Set(events.map((e) => e.id))
    const gone = [...old.values()].filter((e) => !keep.has(e.id) && e.source === 'pokemon-zone' && Date.parse(e.start) > now).map((e) => e.id)
    if (changed.length) {
      await db.importedEvents.bulkPut(changed.map((e) => ({ ...e, ...st })))
      await db.tombstones.bulkDelete(changed.map((e) => `importedEvents:${e.id}`))
    }
    if (gone.length) {
      await db.importedEvents.bulkDelete(gone)
      await db.tombstones.bulkPut(gone.map((id) => ({ key: `importedEvents:${id}`, table: 'importedEvents', id, ...st })))
    }
    return { written: changed.length, removed: gone.length, fresh: events.filter((e) => !old.has(e.id)).length }
  })
}
