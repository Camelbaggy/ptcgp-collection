import type { Card, PackSlotRates, Rarity } from './types'
import { expectedHits, type OwnedMap } from './calc/probability'

/** Objectif de collection : un périmètre (extension, booster ou tout), des raretés, un nombre d'exemplaires visé. */
export interface Goal {
  id: string
  setId?: string
  boosterId?: string
  /** Vide = toutes les raretés. */
  rarities: Rarity[]
  /** 1 = la 1ère copie de chaque carte, 2 = deux exemplaires (à échanger ou partager). */
  copies: 1 | 2
  createdAt: string
}

/** Cartes concernées par l'objectif. */
export function goalCards(goal: Goal, cards: Card[]): Card[] {
  return cards.filter((c) =>
    (!goal.setId || c.setId === goal.setId) &&
    (!goal.boosterId || c.boosterIds.includes(goal.boosterId)) &&
    (!goal.rarities.length || goal.rarities.includes(c.rarity)))
}

export interface GoalMissing { card: Card; need: number }
export interface GoalProgress { total: number; done: number; pct: number; missing: GoalMissing[]; /** exemplaires manquants au total */ missingCopies: number }

export function goalProgress(goal: Goal, cards: Card[], owned: OwnedMap): GoalProgress {
  const list = goalCards(goal, cards)
  const missing: GoalMissing[] = []
  for (const card of list) {
    const need = goal.copies - (owned.get(card.id) ?? 0)
    if (need > 0) missing.push({ card, need })
  }
  const total = list.length
  const done = total - missing.length
  return { total, done, pct: total ? done / total : 0, missing, missingCopies: missing.reduce((s, m) => s + m.need, 0) }
}

// ---------------------------------------------------------------------------
// Estimation en packs (problème du collectionneur à probabilités inégales)

/** Loi du temps T pour obtenir toutes les cartes : chaque carte i apparaît dans un pack avec la proba ps[i] (indépendamment). */
export function collectorStats(ps: number[]): { mean: number; sd: number } {
  const q = ps.filter((p) => p > 0).map((p) => Math.min(1, p))
  if (!q.length) return { mean: 0, sd: 0 }
  // P(T > t) = 1 - Π (1 - (1-p)^t). Somme jusqu'à ce que la queue soit négligeable.
  const pow = q.map(() => 1)
  let mean = 0, second = 0
  const pmin = Math.min(...q)
  const cap = Math.ceil(60 / pmin) + 10
  for (let t = 0; t < cap; t++) {
    let cdf = 1
    for (let i = 0; i < q.length; i++) cdf *= 1 - pow[i]
    const tail = 1 - cdf
    mean += tail
    second += (2 * t + 1) * tail
    if (t > 5 && tail < 1e-7) break
    for (let i = 0; i < q.length; i++) pow[i] *= 1 - q[i]
  }
  return { mean, sd: Math.sqrt(Math.max(0, second - mean * mean)) }
}

export interface BoosterEstimate { boosterId: string; cards: number; mean: number; sd: number }
export interface GoalEstimate {
  /** Packs attendus (somme des boosters ; un booster à la fois, les doublons d'autres cartes sont ignorés). */
  mean: number
  /** Environ 9 fois sur 10, on y arrive avec ce nombre de packs ou moins. */
  p90: number
  byBooster: BoosterEstimate[]
  /** Cartes qu'aucun booster à taux connus ne donne (promos, missions, taux inconnus) : exclues de l'estimation. */
  unreachable: Card[]
}

/**
 * Estime le nombre de packs pour finir l'objectif. Chaque carte manquante est visée dans son meilleur booster ;
 * pour 2 exemplaires, la chance par pack est divisée par le nombre d'exemplaires manquants (approximation).
 */
export function estimateGoal(missing: GoalMissing[], allCards: Card[], rates: PackSlotRates[], onlyBoosterId?: string): GoalEstimate {
  const ratesBy = new Map<string, PackSlotRates[]>()
  for (const r of rates) (ratesBy.get(r.boosterId) ?? ratesBy.set(r.boosterId, []).get(r.boosterId)!).push(r)
  const poolCache = new Map<string, Card[]>()
  const pool = (b: string) => poolCache.get(b) ?? (poolCache.set(b, allCards.filter((c) => c.boosterIds.includes(b))), poolCache.get(b)!)
  const groups = new Map<string, number[]>()
  const unreachable: Card[] = []
  for (const { card, need } of missing) {
    let best = { b: '', p: 0 }
    for (const b of card.boosterIds) {
      if (onlyBoosterId && b !== onlyBoosterId) continue
      const r = ratesBy.get(b)
      if (!r) continue
      const p = Math.min(1, expectedHits(r, pool(b), (c) => c.id === card.id))
      if (p > best.p) best = { b, p }
    }
    if (!best.b) { unreachable.push(card); continue }
    ;(groups.get(best.b) ?? groups.set(best.b, []).get(best.b)!).push(best.p / need)
  }
  const byBooster: BoosterEstimate[] = [...groups].map(([boosterId, ps]) => ({ boosterId, cards: ps.length, ...collectorStats(ps) }))
    .sort((a, b) => b.mean - a.mean)
  const mean = byBooster.reduce((s, b) => s + b.mean, 0)
  const sd = Math.sqrt(byBooster.reduce((s, b) => s + b.sd * b.sd, 0))
  return { mean, p90: mean + 1.28 * sd, byBooster, unreachable }
}

/** Packs par jour sur la fenêtre (0 si aucun pack) : sert à traduire l'estimation en semaines. */
export function packsPerDay(packDays: string[], today: string, windowDays = 30): number {
  const t = Date.parse(today + 'T00:00:00Z')
  const n = packDays.filter((d) => { const x = (t - Date.parse(d + 'T00:00:00Z')) / 864e5; return x >= 0 && x < windowDays }).length
  return n / windowDays
}
