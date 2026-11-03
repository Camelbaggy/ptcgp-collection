export type Rarity = 'D1'|'D2'|'D3'|'D4'|'E1'|'E2'|'E3'|'S1'|'S2'|'C1'|'P'; // P = promo / sans rareté
export interface CardSet  { id: string; name: string; nameEn?: string; releaseDate?: string; order: number; }
export interface Booster  { id: string; setId: string; name: string; }            // id ex. "A1-Mewtwo", "B3-Unique"
export interface Card     { id: string; setId: string; number: number; name: string; nameEn?: string;
                     type?: string; stage?: string; rarity: Rarity; boosterIds: string[];
                     finish?: string; image?: string; /* chemin relatif public/cards/... */ }
// Taux d'obtention par emplacement de booster (données saisies, pas de logique en dur)
export interface PackSlotRates { boosterId: string; packType: 'normal'|'rare'|string; packTypeRate: number; // proba du type de pack
                          slots: { slot: number; rates: Partial<Record<Rarity, number>> }[]; }      // % par rareté
export interface OwnedCard { cardId: string; quantity: number; }
export interface Wishlist   { cardId: string; priority: number; }
export type HistoryEvent =
  | { id: string; kind: 'pack'; date: string; boosterId: string; cardIds: string[] }
  | { id: string; kind: 'share'; date: string; cardId: string; direction: 'given'|'received'; friend?: string }
  | { id: string; kind: 'trade'; date: string; given: string; received: string; friend?: string; tokens?: number };
