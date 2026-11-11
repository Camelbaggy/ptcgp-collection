/**
 * Quantités possédées recalculées à partir de l'historique (voir docs/sync.md).
 * - `rebaseOwned` : après fusion, applique à la ligne `owned` gagnante les évènements que son appareil ne connaissait pas.
 * - `checkOwnedConsistency` : compare les quantités à la dernière correction + évènements suivants.
 * Une `correction` est une valeur absolue datée : elle absorbe les évènements datés avant elle.
 */
import { eventDeltas } from '../ops'
import type { HistoryEvent } from '../types'
import type { SyncRow } from './merge'

type Ev = HistoryEvent & { deleted?: boolean }

function deltasOf(e: Ev): Map<string, number> {
  try { return eventDeltas(e) } catch { return new Map() }
}

const isLive = (r: SyncRow): r is SyncRow & Ev => !r.deleted && typeof r.kind === 'string' && typeof r.id === 'string'

/** Vrai si `e` est postérieur à `c` (date, puis id pour départager). */
const after = (e: Ev, c: Ev) => e.date > c.date || (e.date === c.date && e.id > c.id)

/** Valeur fixée par la correction `c` pour la carte (dernière entrée si la carte apparaît plusieurs fois). */
function correctionTo(c: Ev, cardId: string): number | undefined {
  if (c.kind !== 'correction') return undefined
  let to: number | undefined
  for (const ch of c.changes ?? []) if (ch.cardId === cardId) to = ch.to
  return to
}

interface Touch { ev: Ev; delta: number }

/** Index carte → évènements qui la touchent (avec leur variation). */
function byCard(events: Iterable<Ev>, sign = 1): Map<string, Touch[]> {
  const m = new Map<string, Touch[]>()
  for (const ev of events) {
    for (const [id, d] of deltasOf(ev)) {
      if (!d && ev.kind !== 'correction') continue
      const list = m.get(id)
      if (list) list.push({ ev, delta: sign * d })
      else m.set(id, [{ ev, delta: sign * d }])
    }
  }
  return m
}

/** Correction la plus récente touchant chaque carte. */
function latestCorrections(events: Iterable<Ev>): Map<string, Ev> {
  const m = new Map<string, Ev>()
  for (const ev of events) {
    if (ev.kind !== 'correction') continue
    for (const ch of ev.changes ?? []) {
      const cur = m.get(ch.cardId)
      if (!cur || after(ev, cur)) m.set(ch.cardId, ev)
    }
  }
  return m
}

const liveMap = (rows: SyncRow[]) => new Map(rows.filter(isLive).map((e) => [e.id, e as Ev]))

/** Quantité attendue d'une carte : valeur de la correction `c` + évènements postérieurs. */
function fromCorrection(cardId: string, c: Ev, touches: Touch[] | undefined): number {
  let q = correctionTo(c, cardId) ?? 0
  for (const t of touches ?? []) if (t.ev !== c && after(t.ev, c)) q += t.delta
  return q
}

export type Side = 'local' | 'remote'

/**
 * Recalcule les quantités des cartes dont la ligne gagnante ignore des évènements de l'historique fusionné.
 * @param winners carte → quantité gagnante (0 pour une marque de suppression) et côté d'où elle vient
 * @returns carte → nouvelle quantité (≥ 0), seulement pour les cartes qui changent
 */
export function rebaseOwned(
  winners: Map<string, { quantity: number; side: Side }>,
  history: { local: SyncRow[]; remote: SyncRow[]; merged: SyncRow[] },
): Map<string, number> {
  const M = liveMap(history.merged)
  const out = new Map<string, number>()
  const sides = { local: liveMap(history.local), remote: liveMap(history.remote) }
  let corr: Map<string, Ev> | null = null
  let mByCard: Map<string, Touch[]> | null = null
  for (const side of ['local', 'remote'] as const) {
    const S = sides[side]
    const plus = [...M.values()].filter((e) => !S.has(e.id))
    const minus = [...S.values()].filter((e) => !M.has(e.id))
    if (!plus.length && !minus.length) continue
    const touched = byCard(plus)
    for (const [id, list] of byCard(minus, -1)) touched.set(id, [...(touched.get(id) ?? []), ...list])
    for (const [cardId, list] of touched) {
      const w = winners.get(cardId)
      if (!w || w.side !== side) continue
      corr ??= latestCorrections(M.values())
      const c = corr.get(cardId)
      let q: number
      if (c && !S.has(c.id)) {
        // le gagnant ignore la dernière correction : on repart de sa valeur absolue
        mByCard ??= byCard(M.values())
        q = fromCorrection(cardId, c, mByCard.get(cardId))
      } else {
        q = w.quantity
        for (const t of list) if (!c || (t.ev !== c && after(t.ev, c))) q += t.delta
      }
      q = Math.max(0, q)
      if (q !== w.quantity) out.set(cardId, q)
    }
  }
  return out
}

export interface Discrepancy { cardId: string; quantity: number; expected: number; since: string }

/**
 * Cartes dont la quantité diffère de « dernière correction + évènements suivants ».
 * Les cartes sans correction ne sont pas vérifiables (l'historique ne part pas de 0).
 */
export function checkOwnedConsistency(owned: { cardId: string; quantity: number }[], history: SyncRow[]): Discrepancy[] {
  const live = [...liveMap(history).values()]
  const corr = latestCorrections(live)
  if (!corr.size) return []
  const touches = byCard(live)
  const q = new Map(owned.map((o) => [o.cardId, o.quantity]))
  const out: Discrepancy[] = []
  for (const [cardId, c] of corr) {
    const expected = Math.max(0, fromCorrection(cardId, c, touches.get(cardId)))
    const quantity = q.get(cardId) ?? 0
    if (quantity !== expected) out.push({ cardId, quantity, expected, since: c.date })
  }
  return out.sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0))
}
