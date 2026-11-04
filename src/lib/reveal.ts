/** Détection des cartes nouvellement possédées + petit bus d'évènements pour l'animation « Nouvelle carte ! ». */

/** Cartes passées de 0 à ≥ 1 exemplaire entre deux inventaires (ordre de `after`). */
export function newlyOwnedIds(before: ReadonlyMap<string, number>, after: ReadonlyMap<string, number>): string[] {
  const out: string[] = []
  for (const [id, q] of after) if (q >= 1 && (before.get(id) ?? 0) === 0) out.push(id)
  return out
}

export interface RevealGroup { setId: string; cardIds: string[] }

/** Regroupe par extension (ordre de première apparition), cartes triées par numéro. */
export function groupBySet(ids: readonly string[], cards: ReadonlyMap<string, { setId: string; number: number }>): RevealGroup[] {
  const groups = new Map<string, string[]>()
  for (const id of new Set(ids)) {
    const c = cards.get(id)
    if (!c) continue
    const g = groups.get(c.setId)
    if (g) g.push(id)
    else groups.set(c.setId, [id])
  }
  return [...groups].map(([setId, cardIds]) => ({
    setId,
    cardIds: cardIds.sort((a, b) => cards.get(a)!.number - cards.get(b)!.number),
  }))
}

const KEY = 'ptcgp:reveal.enabled'
/** Réglage « Animation des nouvelles cartes » (activé par défaut). */
export function isRevealEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== 'false' } catch { return true }
}
export function setRevealEnabled(on: boolean) {
  try { localStorage.setItem(KEY, String(on)) } catch { /* ignore */ }
}

type Listener = (ids: string[]) => void
const listeners = new Set<Listener>()
export function onReveal(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
export function emitReveal(ids: string[]) {
  if (ids.length && isRevealEnabled()) listeners.forEach((l) => l(ids))
}
