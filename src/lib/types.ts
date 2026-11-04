export type Rarity = 'D1'|'D2'|'D3'|'D4'|'E1'|'E2'|'E3'|'S1'|'S2'|'C1'|'P'; // P = promo / sans rareté
export interface CardSet extends Stamp { id: string; name: string; nameEn?: string; releaseDate?: string; order: number; }
export interface Booster extends Stamp { id: string; setId: string; name: string; }            // id ex. "A1-Mewtwo", "B3-Unique"
export interface Card extends Stamp { id: string; setId: string; number: number; name: string; nameEn?: string;
                     type?: string; stage?: string; rarity: Rarity; boosterIds: string[];
                     finish?: string; image?: string; /* chemin relatif public/cards/... */ }
// Taux d'obtention par emplacement de booster (données saisies, pas de logique en dur)
/** Un emplacement : % par rareté. Champs optionnels : taux par finition ('*' = toutes, carte sans finition = 'Normale'),
 *  restriction du tirage à certaines cartes, exclusion de certaines cartes. */
export interface PackSlot { slot: number; rates: Partial<Record<Rarity, number>>;
  byFinish?: Record<string, Partial<Record<Rarity, number>>>; poolCardIds?: string[]; excludeCardIds?: string[]; }
export interface PackSlotRates extends Stamp { boosterId: string; packType: 'normal'|'rare'|string; packTypeRate: number; // proba du type de pack
                          slots: PackSlot[]; }
/** Métadonnées de synchro : date de dernière modif (ISO), appareil auteur, suppression logique (dans les snapshots). */
export interface Stamp { updatedAt?: string; by?: string; deleted?: boolean; }
export interface OwnedCard extends Stamp { cardId: string; quantity: number; }
export interface Wishlist extends Stamp { cardId: string; priority: number; }
export type HistoryEvent = Stamp & (
  | { id: string; kind: 'pack'; date: string; boosterId: string; cardIds: string[] }
  | { id: string; kind: 'share'; date: string; cardId: string; direction: 'given'|'received'; friend?: string }
  | { id: string; kind: 'trade'; date: string; given: string; received: string; friend?: string; tokens?: number }
  | { id: string; kind: 'correction'; date: string; changes: { cardId: string; from: number; to: number }[] });
