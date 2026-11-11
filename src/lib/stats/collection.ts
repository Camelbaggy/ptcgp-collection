import type { Card, HistoryEvent, Rarity } from '../types';
import { RARITY_ORDER } from '../calc/rules';
import { shareOffers, tradeOffers } from '../calc/offers';
import type { PackEv } from './packs';

/** Famille de type d'une carte : type Pokémon (premier mot pour les doubles types) ou « Dresseur ». */
export const POKEMON_TYPES = ['Plante', 'Feu', 'Eau', 'Électrique', 'Psy', 'Combat', 'Obscurité', 'Métal', 'Dragon', 'Incolore'] as const;
export const TRAINER = 'Dresseur';

export function typeFamily(type: string | undefined): string | null {
  if (!type) return null;
  const first = type.split(' ')[0];
  if ((POKEMON_TYPES as readonly string[]).includes(first)) return first;
  return TRAINER; // Supporter, Objet, Outil, Stade, Dresseur…
}

export interface TypeSlice { type: string; owned: number; total: number; }
/** Répartition par type : cartes différentes possédées (et total existant). */
export function typeDistribution(cards: Card[], owned: Map<string, number>): TypeSlice[] {
  const m = new Map<string, TypeSlice>();
  for (const c of cards) {
    const t = typeFamily(c.type);
    if (!t) continue;
    const s = m.get(t) ?? { type: t, owned: 0, total: 0 };
    s.total++;
    if ((owned.get(c.id) ?? 0) > 0) s.owned++;
    m.set(t, s);
  }
  return [...m.values()].sort((a, b) => b.owned - a.owned);
}

export interface RarityStock {
  rarity: Rarity;
  /** Exemplaires en trop (quantité − 1), toutes cartes en double. */
  spare: number;
  /** Exemplaires proposables à l'échange / au partage selon les règles de l'accueil (calc/offers). */
  tradeable: number; shareable: number;
  /** Cartes distinctes concernées. */
  tradeCards: number; shareCards: number;
}

/**
 * Doubles par rareté. Échangeables et partageables suivent exactement les règles de l'encart
 * « Échange/Partage » de l'accueil (`tradeOffers` / `shareOffers`), calculées sur `allCards`
 * (la règle « rareté complète » porte sur tout le jeu) puis restreintes à `cards`.
 */
export function duplicateStock(cards: Card[], owned: Map<string, number>, allCards: Card[] = cards): RarityStock[] {
  const trade = new Map(tradeOffers(allCards, owned).map((o) => [o.card.id, o.spare]));
  const share = new Map(shareOffers(allCards, owned).map((o) => [o.card.id, o.spare]));
  const m = new Map<Rarity, RarityStock>();
  for (const c of cards) {
    const q = owned.get(c.id) ?? 0;
    if (q < 2) continue;
    const s = m.get(c.rarity) ?? { rarity: c.rarity, spare: 0, tradeable: 0, shareable: 0, tradeCards: 0, shareCards: 0 };
    s.spare += q - 1;
    const t = trade.get(c.id) ?? 0, sh = share.get(c.id) ?? 0;
    s.tradeable += t; s.shareable += sh;
    if (t > 0) s.tradeCards++;
    if (sh > 0) s.shareCards++;
    m.set(c.rarity, s);
  }
  return RARITY_ORDER.filter((r) => m.has(r)).map((r) => m.get(r)!);
}

/** Packs ouverts par booster, décroissant. */
export function packsByBooster(packs: PackEv[]): { boosterId: string; count: number }[] {
  const m = new Map<string, number>();
  for (const e of packs) m.set(e.boosterId, (m.get(e.boosterId) ?? 0) + 1);
  return [...m].map(([boosterId, count]) => ({ boosterId, count })).sort((a, b) => b.count - a.count);
}

export interface SocialPoint { start: string; shares: number; trades: number; }
/** Partages et échanges par tranche : à partir de listes de jours déjà bucketisés par countByBucket. */
export function mergeSocial(shares: { start: string; count: number }[], trades: { start: string; count: number }[]): SocialPoint[] {
  return shares.map((s, i) => ({ start: s.start, shares: s.count, trades: trades[i]?.count ?? 0 }));
}

export const sharesOf = (evs: HistoryEvent[]) => evs.filter((e): e is Extract<HistoryEvent, { kind: 'share' }> => e.kind === 'share');
export const tradesOf = (evs: HistoryEvent[]) => evs.filter((e): e is Extract<HistoryEvent, { kind: 'trade' }> => e.kind === 'trade');
