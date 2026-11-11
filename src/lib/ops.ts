import type { HistoryEvent, Rarity } from './types'
import { TRADE_RULES } from './calc/rules'

/** Variation de quantité par carte provoquée par un évènement. */
export function eventDeltas(ev: HistoryEvent): Map<string, number> {
  const m = new Map<string, number>()
  const add = (id: string, n: number) => m.set(id, (m.get(id) ?? 0) + n)
  if (ev.kind === 'pack') ev.cardIds.forEach((id) => add(id, 1))
  else if (ev.kind === 'share') add(ev.cardId, ev.direction === 'given' ? -1 : 1)
  else if (ev.kind === 'correction') ev.changes.forEach((c) => add(c.cardId, c.to - c.from))
  else {
    add(ev.given, -1)
    add(ev.received, 1)
  }
  return m
}

export function invert(deltas: Map<string, number>): Map<string, number> {
  return new Map([...deltas].map(([k, v]) => [k, -v]))
}

/** Applique des deltas à un inventaire. Lève une erreur si une quantité devient négative. */
export function applyDeltas(
  owned: Map<string, number>,
  deltas: Map<string, number>,
): Map<string, number> {
  const out = new Map(owned)
  for (const [id, d] of deltas) {
    const q = (out.get(id) ?? 0) + d
    if (q < 0) throw new Error(`Quantité insuffisante pour ${id}`)
    out.set(id, q)
  }
  return out
}

/** Une carte ne peut être donnée que si on en possède au moins 2 exemplaires. */
export const canGive = (qty: number) => qty >= 2

/** Règles de Nicolas : partage = D1–D4, échange = D1–D4, E1, E2, S1, S2 ; toujours qty >= 2. */
export function canShareCard(rarity: Rarity, qty: number): boolean {
  const r = TRADE_RULES.shareableRarities
  return qty >= TRADE_RULES.minQuantityToOffer && (r === 'all' || r.includes(rarity))
}
export function canTradeCard(rarity: Rarity, qty: number): boolean {
  return qty >= TRADE_RULES.minQuantityToOffer && TRADE_RULES.tradableRarities.includes(rarity)
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** Dernier évènement annulable : le plus récent saisi sur cet appareil (jamais celui d'un autre appareil). */
export function pickUndoable(events: HistoryEvent[], device: string): HistoryEvent | null {
  let best: HistoryEvent | null = null
  for (const e of events) {
    if (e.deleted || (e.by && e.by !== device)) continue
    if (!best || e.date > best.date) best = e
  }
  return best
}
