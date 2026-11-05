import type { Card, Rarity } from '../types';
import type { OwnedMap } from './probability';
import { RARITY_ORDER, TRADE_RULES, type TradeRules } from './rules';

/**
 * Règles de Nicolas pour l'encart « Échange/Partage » de l'accueil (2026-11-05).
 *  - Échange : seulement entre cartes de même rareté, et seulement pour compléter la collection :
 *    une rareté dont on possède déjà toutes les cartes du jeu n'est plus proposée à l'échange.
 *  - D1–D4 : on garde 2 exemplaires (on n'échange / ne partage qu'à partir du 3e),
 *    sauf les cartes « brillantes » des boosters de luxe (A4b, B4b…, `finish: 'Brillante'`) : on garde 1 exemplaire.
 *  - E1 et au-delà (E1, E2, S1, S2) : on garde 1 exemplaire.
 *  - E3, C1 et promos : non échangeables.
 *  - Partage : D1–D4 seulement, mêmes seuils ; pas de filtre « rareté complète » (le partage aide les amis).
 */
export interface OfferEntry { card: Card; quantity: number; /** Exemplaires disponibles (quantité − exemplaires gardés). */ spare: number; }

const isDiamond = (r: Rarity) => r === 'D1' || r === 'D2' || r === 'D3' || r === 'D4';
export const isShinyFinish = (c: Card) => c.finish === 'Brillante';

/** Exemplaires que Nicolas garde avant de proposer une carte. */
export function keepCount(card: Card): number {
  return isDiamond(card.rarity) && !isShinyFinish(card) ? 2 : 1;
}

/** Raretés dont toutes les cartes du jeu sont possédées (≥ 1 exemplaire). */
export function completeRarities(cards: Card[], owned: OwnedMap): Set<Rarity> {
  const missing = new Set<Rarity>();
  const seen = new Set<Rarity>();
  for (const c of cards) {
    seen.add(c.rarity);
    if ((owned.get(c.id) ?? 0) < 1) missing.add(c.rarity);
  }
  return new Set([...seen].filter((r) => !missing.has(r)));
}

const rank = (r: Rarity) => RARITY_ORDER.indexOf(r);

/** Rareté décroissante, puis nombre d'exemplaires décroissant, puis id. */
export function sortOffers(list: OfferEntry[]): OfferEntry[] {
  return [...list].sort((a, b) => rank(b.card.rarity) - rank(a.card.rarity) || b.quantity - a.quantity || a.card.id.localeCompare(b.card.id, 'fr', { numeric: true }));
}

function offers(cards: Card[], owned: OwnedMap, ok: (c: Card) => boolean): OfferEntry[] {
  const out: OfferEntry[] = [];
  for (const c of cards) {
    if (!ok(c)) continue;
    const q = owned.get(c.id) ?? 0;
    const spare = q - keepCount(c);
    if (spare > 0) out.push({ card: c, quantity: q, spare });
  }
  return sortOffers(out);
}

/** Cartes à proposer à l'échange (triées par rareté puis exemplaires décroissants). */
export function tradeOffers(cards: Card[], owned: OwnedMap, rules: TradeRules = TRADE_RULES): OfferEntry[] {
  const done = completeRarities(cards, owned);
  return offers(cards, owned, (c) => rules.tradableRarities.includes(c.rarity) && !done.has(c.rarity));
}

/** Cartes à proposer au partage (triées par rareté puis exemplaires décroissants). */
export function shareOffers(cards: Card[], owned: OwnedMap, rules: TradeRules = TRADE_RULES): OfferEntry[] {
  return offers(cards, owned, (c) => rules.shareableRarities === 'all' || rules.shareableRarities.includes(c.rarity));
}
