import type { Rarity } from '../types';

/**
 * Règles d'échange / partage de Pokémon TCG Pocket (état connu, à revérifier si le jeu évolue).
 *
 * Échange (Trade, depuis le 29/04/2025) :
 *  - seules les cartes ◊1 à ◊4 (D1–D4) et ☆1 (E1) des extensions de base sont échangeables ;
 *  - ☆2, ☆3, chromatiques (S1/S2), couronne (C1) et promos ne le sont pas ;
 *  - il faut 1 exemplaire de plus que ce qu'on garde (on ne peut pas échanger sa seule copie) ;
 *  - chaque échange coûte des « Jetons d'échange » (D3 : 120, D4 : 500, E1 : 400 ; D1/D2 : gratuit/faible) ;
 *  - les deux cartes échangées doivent être de même rareté.
 *  Ces valeurs sont des constantes de configuration : les modifier ici suffit.
 *
 * « Partage » (dans l'application de Nicolas) : mise à disposition d'un double à un ami.
 * Règle de Nicolas : échangeables = D1–D4, E1, E2, S1, S2 ; partageables = D1–D4 ; quantité >= 2.
 */
export interface TradeRules {
  tradableRarities: Rarity[];
  /** Quantité minimale à posséder pour proposer un exemplaire. */
  minQuantityToOffer: number;
  /** Coût en jetons d'échange par rareté (informatif). */
  tokenCost: Partial<Record<Rarity, number>>;
  /** Raretés dont les doubles sont partageables. */
  shareableRarities: Rarity[] | 'all';
}

export const TRADE_RULES: TradeRules = {
  tradableRarities: ['D1', 'D2', 'D3', 'D4', 'E1', 'E2', 'S1', 'S2'],
  minQuantityToOffer: 2,
  tokenCost: { D1: 0, D2: 0, D3: 120, D4: 500, E1: 400 },
  shareableRarities: ['D1', 'D2', 'D3', 'D4'],
};

/** Raretés considérées « rares » pour les statistiques de chance. */
export const RARE_RARITIES: Rarity[] = ['E1', 'E2', 'E3', 'S1', 'S2', 'C1'];

export const RARITY_ORDER: Rarity[] = ['D1', 'D2', 'D3', 'D4', 'E1', 'E2', 'E3', 'S1', 'S2', 'C1', 'P'];

export const RARITY_LABEL: Record<Rarity, string> = {
  D1: '◆', D2: '◆◆', D3: '◆◆◆', D4: '◆◆◆◆',
  E1: '★', E2: '★★', E3: '★★★',
  S1: '✦', S2: '✦✦', C1: '♛', P: 'Promo',
};
