import type { RecapBooster } from './videoScan/recapTypes'

/** Boosters du récap dans l'ordre du jeu (numéro croissant ; à numéro égal, l'ordre de lecture est gardé). */
export function sortRecapBoosters<T extends Pick<RecapBooster, 'index'>>(boosters: T[]): T[] {
  return boosters.map((b, i) => ({ b, i })).sort((x, y) => x.b.index - y.b.index || x.i - y.i).map((x) => x.b)
}

/** Une carte est douteuse si elle ressemble peu à la meilleure candidate, ou si deux cartes différentes sont proches. */
export function isDoubtful(candidates: { card: { name: string }; dist: number }[], threshold: number, margin = 0.04): boolean {
  const best = candidates[0], second = candidates[1]
  return !best || best.dist > threshold || (!!second && second.card.name !== best.card.name && second.dist - best.dist < margin)
}

export interface PackDraft { boosterId: string; cardIds: string[] }

/** Un pack par booster coché (dans l'ordre), cartes « ignorées » (id vide) retirées ; les boosters vides sont omis. */
export function buildPacks(picks: string[][], included: boolean[], boosterId: string): PackDraft[] {
  return picks.flatMap((ids, i) => {
    const cardIds = ids.filter(Boolean)
    return included[i] !== false && cardIds.length ? [{ boosterId, cardIds }] : []
  })
}

/** Dernier nombre d'exemplaires lu pour chaque carte (boosters cochés seulement, le plus tardif l'emporte). */
export function lastCounts(picks: string[][], counts: (number | null)[][], included: boolean[]): Map<string, number> {
  const m = new Map<string, number>()
  picks.forEach((ids, i) => {
    if (included[i] === false) return
    ids.forEach((id, j) => {
      const n = counts[i]?.[j]
      if (id && typeof n === 'number') m.set(id, n)
    })
  })
  return m
}

export interface CountMismatch { cardId: string; game: number; local: number }

/** Cartes dont la quantité enregistrée diffère de celle affichée par le jeu. */
export function countMismatches(game: Map<string, number>, owned: Map<string, number>): CountMismatch[] {
  return [...game].flatMap(([cardId, g]) => {
    const local = owned.get(cardId) ?? 0
    return local === g ? [] : [{ cardId, game: g, local }]
  })
}
