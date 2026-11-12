/**
 * Modification ou suppression d'un évènement ancien de l'historique (lot E3, constat U6).
 *
 * Modifier = retirer l'ancien évènement et en ajouter un nouveau (nouvel id, même date). La synchro Drive
 * (docs/sync.md) compare les historiques par id : l'ancien id disparaît (marque de suppression), le nouveau
 * apparaît, et `rebaseOwned` ajuste les autres appareils comme pour n'importe quel ajout ou annulation.
 *
 * Effet sur les quantités, carte par carte : `δ(nouveau) − δ(ancien)`, sauf si une `correction` plus récente
 * touche la carte. Une correction est une valeur absolue datée (« à telle date, j'en avais N ») : elle a déjà
 * absorbé l'évènement, donc la quantité actuelle ne bouge pas. C'est la même règle que la fusion et que
 * Réglages › « Vérifier les quantités ».
 */
import { eventDeltas } from './ops'
import type { HistoryEvent } from './types'

export interface ImpactLine {
  cardId: string
  /** Quantité actuelle. */
  before: number
  /** Quantité après la modification (≥ 0). */
  after: number
  /** Variation demandée par la modification, avant prise en compte des corrections plus récentes. */
  delta: number
  /** Une mise à jour plus récente fixe déjà cette carte : sa quantité ne change pas. */
  absorbed: boolean
  /** La quantité serait devenue négative : elle est ramenée à 0. */
  clamped: boolean
}

/** Vrai si `e` est postérieur à `ref` (date, puis id pour départager), comme dans `sync/rebase.ts`. */
const after = (e: HistoryEvent, ref: HistoryEvent) => e.date > ref.date || (e.date === ref.date && e.id > ref.id)

/** Variation par carte du remplacement de `old` par `next` (l'un des deux peut manquer). */
export function replaceDeltas(old: HistoryEvent | null, next: HistoryEvent | null): Map<string, number> {
  const m = new Map<string, number>()
  if (next) for (const [id, d] of eventDeltas(next)) m.set(id, (m.get(id) ?? 0) + d)
  if (old) for (const [id, d] of eventDeltas(old)) m.set(id, (m.get(id) ?? 0) - d)
  for (const [id, d] of m) if (!d) m.delete(id)
  return m
}

/**
 * Effet sur les quantités de remplacer `old` par `next` (`next` absent = suppression, `old` absent = ajout à la
 * date de `next`). `history` = tout l'historique (pour trouver les corrections plus récentes).
 */
export function editImpact(
  old: HistoryEvent | null,
  next: HistoryEvent | null,
  history: readonly HistoryEvent[],
  owned: ReadonlyMap<string, number>,
): ImpactLine[] {
  const ref = old ?? next
  if (!ref) return []
  const deltas = replaceDeltas(old, next)
  const later = new Set<string>()
  for (const e of history) {
    if (e.deleted || e.kind !== 'correction' || e.id === old?.id || e.id === next?.id || !after(e, ref)) continue
    for (const c of e.changes) if (deltas.has(c.cardId)) later.add(c.cardId)
  }
  const out: ImpactLine[] = []
  for (const [cardId, delta] of deltas) {
    const before = owned.get(cardId) ?? 0
    const absorbed = later.has(cardId)
    const raw = absorbed ? before : before + delta
    out.push({ cardId, before, after: Math.max(0, raw), delta, absorbed, clamped: raw < 0 })
  }
  return out.sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0))
}

/** Message d'erreur si le brouillon n'est pas enregistrable, sinon null. */
export function validateEvent(e: HistoryEvent): string | null {
  switch (e.kind) {
    case 'pack': return e.cardIds.length ? null : 'Un booster doit contenir au moins une carte. Supprime-le plutôt.'
    case 'share': return e.cardId ? null : 'Choisis une carte.'
    case 'trade':
      if (!e.given || !e.received) return 'Choisis la carte donnée et la carte reçue.'
      if (e.given === e.received) return 'La carte donnée et la carte reçue doivent être différentes.'
      if (e.tokens !== undefined && (!Number.isInteger(e.tokens) || e.tokens < 0)) return 'Le nombre de jetons doit être un entier positif.'
      return null
    case 'correction':
      if (!e.changes.length) return 'Une mise à jour doit modifier au moins une carte. Supprime-la plutôt.'
      return e.changes.every((c) => Number.isInteger(c.to) && c.to >= 0) ? null : 'Les quantités doivent être des entiers positifs.'
  }
}

/** Vrai si le brouillon ne change rien par rapport à l'évènement d'origine (hors horodatage). */
export function sameEvent(a: HistoryEvent, b: HistoryEvent): boolean {
  const body = (e: HistoryEvent) => {
    const { updatedAt: _u, by: _b, deleted: _d, id: _i, ...rest } = e
    const r = rest as Record<string, unknown>
    return JSON.stringify(Object.keys(r).sort().filter((k) => r[k] !== undefined).map((k) => [k, r[k]]))
  }
  return body(a) === body(b)
}
