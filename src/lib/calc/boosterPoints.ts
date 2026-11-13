import type { Card, PackSlotRates, Rarity } from '../types';
import { PACK_POINTS_PER_PACK } from '../stats/packs';
import { RARITY_ORDER } from './rules';
import { missingCardOdds, type OwnedMap } from './probability';

/**
 * Planificateur de points Booster : écran « Échange de points Booster » du jeu.
 * Chaque pack ouvert rapporte 5 points de son extension ; une carte manquante s'achète au prix de sa rareté.
 * Les prix sont des constantes de configuration (à revérifier dans le jeu, modifiables dans l'appli).
 * Les promos ne s'achètent pas.
 */
export type PointCosts = Partial<Record<Rarity, number>>;

export const DEFAULT_POINT_COSTS: PointCosts = { D1: 35, D2: 70, D3: 150, D4: 500, E1: 400, E2: 1250, E3: 1500, S1: 1000, S2: 1350, C1: 2500 };

/** Raretés qui peuvent avoir un prix (affichées dans l'éditeur de prix). */
export const BUYABLE_RARITIES: Rarity[] = RARITY_ORDER.filter((r) => r !== 'P');

export interface PlanItem {
  card: Card;
  cost: number;
  /** Chance par pack de tirer cette carte dans le meilleur booster de l'extension (exemplaires attendus). */
  pPerPack: number;
  /** Packs à ouvrir en moyenne pour la tirer (Infinity si aucun booster ne la donne). */
  packsToOpen: number;
  /** Packs à ouvrir pour gagner assez de points (coût / 5). */
  packsToBuy: number;
  verdict: 'buy' | 'open';
}

export interface RarityRow { rarity: Rarity; missing: number; unitCost: number; total: number; }

export interface SetPlan {
  items: PlanItem[];
  balance: number;
  totalCost: number;
  /** Points qui manquent pour tout acheter (0 si le solde suffit). */
  shortfall: number;
  packsToEarnShortfall: number;
  byRarity: RarityRow[];
  /** Achats conseillés avec le solde : cartes où acheter bat ouvrir, meilleur gain de packs par point d'abord. */
  recommended: PlanItem[];
  spent: number;
  leftover: number;
}

export const packsForPoints = (points: number): number => Math.ceil(Math.max(0, points) / PACK_POINTS_PER_PACK);

/** Prix d'une carte (0 ou absent = non achetable). */
export const costOf = (card: Card, costs: PointCosts): number => costs[card.rarity] ?? 0;

export function planSet(
  setId: string,
  cards: Card[],
  boosterIds: string[],
  rates: PackSlotRates[],
  owned: OwnedMap,
  balance: number,
  costs: PointCosts = DEFAULT_POINT_COSTS,
): SetPlan {
  const best = new Map<string, number>();
  for (const b of boosterIds) {
    for (const o of missingCardOdds(b, cards, rates, owned)) {
      if (o.card.setId === setId && o.p > (best.get(o.card.id) ?? 0)) best.set(o.card.id, o.p);
    }
  }
  const items: PlanItem[] = cards
    .filter((c) => c.setId === setId && (owned.get(c.id) ?? 0) === 0 && costOf(c, costs) > 0)
    .map((card) => {
      const cost = costOf(card, costs);
      const pPerPack = best.get(card.id) ?? 0;
      const packsToOpen = pPerPack > 0 ? 1 / pPerPack : Infinity;
      const packsToBuy = cost / PACK_POINTS_PER_PACK;
      return { card, cost, pPerPack, packsToOpen, packsToBuy, verdict: packsToOpen > packsToBuy ? 'buy' as const : 'open' as const };
    })
    // Chères d'abord, puis par numéro : l'ordre d'affichage par défaut.
    .sort((a, b) => b.cost - a.cost || a.card.number - b.card.number);

  const totalCost = items.reduce((n, i) => n + i.cost, 0);
  const shortfall = Math.max(0, totalCost - balance);

  const rows = new Map<Rarity, RarityRow>();
  for (const i of items) {
    const r = rows.get(i.card.rarity) ?? { rarity: i.card.rarity, missing: 0, unitCost: i.cost, total: 0 };
    r.missing++; r.total += i.cost;
    rows.set(i.card.rarity, r);
  }
  const byRarity = RARITY_ORDER.filter((r) => rows.has(r)).map((r) => rows.get(r)!);

  // Gain en packs par point dépensé : une carte quasi impossible à tirer et peu chère passe en premier.
  const ratio = (i: PlanItem) => (Number.isFinite(i.packsToOpen) ? i.packsToOpen : 1e9) / i.cost;
  const recommended: PlanItem[] = [];
  let left = Math.max(0, balance);
  for (const i of items.filter((x) => x.verdict === 'buy').sort((a, b) => ratio(b) - ratio(a) || a.cost - b.cost)) {
    if (i.cost <= left) { recommended.push(i); left -= i.cost; }
  }
  const spent = recommended.reduce((n, i) => n + i.cost, 0);
  return { items, balance, totalCost, shortfall, packsToEarnShortfall: packsForPoints(shortfall), byRarity, recommended, spent, leftover: Math.max(0, balance) - spent };
}
