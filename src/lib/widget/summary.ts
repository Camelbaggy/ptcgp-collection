/**
 * Résumé affiché par le widget d'écran d'accueil Android (lot F11) : complétion de la collection et boosters
 * à ouvrir en premier, calculés exactement comme l'accueil (`collectionTotals`, tri par `legacyNew`).
 * Pur : le natif ne fait qu'afficher ce que l'appli lui envoie.
 */
import { analyzeBooster, collectionTotals, type OwnedMap } from '../calc'
import type { Booster, Card, PackSlotRates } from '../types'

export interface WidgetBooster {
  id: string
  /** « A4 · Ho-Oh » */
  label: string
  /** chance d'au moins une nouvelle carte dans un pack (0..1), comme « de nouvelle carte » sur l'accueil */
  pNew: number
  /** cartes encore manquantes dans ce booster */
  missing: number
  /** image du pack (URL absolue), vide s'il n'y en a pas */
  image: string
}

export interface WidgetSummary {
  /** 0..1 */
  pct: number
  owned: number
  total: number
  /** part des cartes avec une 2e copie (0..1) */
  pct2: number
  /** jusqu'à 3 boosters, le meilleur d'abord ; vide si aucun booster n'a de carte manquante */
  boosters: WidgetBooster[]
}

export function widgetSummary(
  cards: Card[],
  boosters: Booster[],
  rates: PackSlotRates[],
  owned: OwnedMap,
  imageUrl: (boosterId: string) => string,
): WidgetSummary {
  const t = collectionTotals(cards, owned)
  const ranked = boosters
    .filter((b) => !b.entryOnly && rates.some((r) => r.boosterId === b.id))
    .map((b) => ({ b, a: analyzeBooster(b.id, cards, rates, owned) }))
    .filter(({ a }) => a.legacyNew > 0)
    .sort((x, y) => y.a.legacyNew - x.a.legacyNew)
    .slice(0, 3)
  return {
    pct: t.pct,
    owned: t.owned,
    total: t.total,
    pct2: t.pct2,
    boosters: ranked.map(({ b, a }) => ({
      id: b.id,
      label: `${b.setId} · ${b.name}`,
      pNew: a.legacyNew,
      missing: a.total - a.owned,
      image: imageUrl(b.id),
    })),
  }
}

/** Valeurs arrondies : le widget n'est réécrit que si ce qu'il affiche change. */
export function widgetKey(s: WidgetSummary): string {
  return JSON.stringify({
    p: Math.round(s.pct * 1000), o: s.owned, t: s.total, p2: Math.round(s.pct2 * 100),
    b: s.boosters.map((b) => [b.id, Math.round(b.pNew * 1000), b.missing]),
  })
}
