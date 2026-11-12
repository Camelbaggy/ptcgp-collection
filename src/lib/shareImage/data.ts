import type { Card, CardSet } from '../types'
import { collectionTotals, completionBySet, type OwnedMap } from '../calc'

export interface ShareSetLine { id: string; name: string; pct: number; owned: number; total: number }

export interface ShareData {
  pct: number
  owned: number
  total: number
  pct2: number
  packs: number
  /** Extensions les plus récentes d'abord, au plus `MAX_SETS`. */
  sets: ShareSetLine[]
  date: string
}

/** Nombre de barres d'extension sur l'image (les plus récentes). */
export const MAX_SETS = 10

/** Extensions promo et spéciales (P-A, P-B, SP1…) : pas de barre de progression sur l'image. */
const isPromoSet = (id: string) => /^(P-|SP)/.test(id)

/** Résumé de progression pour l'image à partager (aucune donnée personnelle hors chiffres de collection). */
export function buildShareData(sets: CardSet[], cards: Card[], owned: OwnedMap, packs: number, now: Date): ShareData {
  const totals = collectionTotals(cards, owned)
  const bySet = completionBySet(cards, owned)
  const lines = [...sets]
    .filter((s) => bySet[s.id]?.total && !isPromoSet(s.id))
    .sort((a, b) => b.order - a.order)
    .slice(0, MAX_SETS)
    .map((s) => ({ id: s.id, name: s.name, pct: bySet[s.id].pct, owned: bySet[s.id].owned, total: bySet[s.id].total }))
  return {
    pct: totals.pct, owned: totals.owned, total: totals.total, pct2: totals.pct2, packs,
    sets: lines,
    date: now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

export const fmtPct = (v: number, digits = 1) => (v * 100).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
