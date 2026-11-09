import type { Card } from './types'

/**
 * Boosters pouvant contenir toutes les cartes d'un pack, du plus probable au moins probable.
 * Score = nombre de cartes que le booster contient (les rééditions des boosters de luxe gardent
 * l'id de la carte d'origine, avec le booster de luxe dans `boosterIds`) ; à égalité, `prefer` passe devant.
 */
export function rankBoosters(cards: Pick<Card, 'boosterIds'>[], prefer?: string): { boosterId: string; hits: number }[] {
  const hits = new Map<string, number>()
  for (const c of cards) for (const b of new Set(c.boosterIds)) hits.set(b, (hits.get(b) ?? 0) + 1)
  return [...hits]
    .map(([boosterId, n]) => ({ boosterId, hits: n }))
    .sort((a, b) => b.hits - a.hits || Number(b.boosterId === prefer) - Number(a.boosterId === prefer) || a.boosterId.localeCompare(b.boosterId))
}

/** Booster le plus probable d'un pack reconnu (undefined si aucune carte n'a de booster). */
export const pickBooster = (cards: Pick<Card, 'boosterIds'>[], prefer?: string) => rankBoosters(cards, prefer)[0]?.boosterId
