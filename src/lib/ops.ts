import type { HistoryEvent } from './types'

/** Variation de quantité par carte provoquée par un évènement. */
export function eventDeltas(ev: HistoryEvent): Map<string, number> {
  const m = new Map<string, number>()
  const add = (id: string, n: number) => m.set(id, (m.get(id) ?? 0) + n)
  if (ev.kind === 'pack') ev.cardIds.forEach((id) => add(id, 1))
  else if (ev.kind === 'share') add(ev.cardId, ev.direction === 'given' ? -1 : 1)
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

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
