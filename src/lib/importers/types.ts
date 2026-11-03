import type { Booster, Card, CardSet } from '../types'

/** What every importer returns; feeds the "Nouvelle extension" screen. */
export interface ImportedSet {
  set: CardSet
  boosters: Booster[]
  /** New cards only. */
  cards: Card[]
  /** Existing cards whose boosterIds were extended by a reprint in this set (upsert them). */
  updatedCards?: Card[]
  /** Non-fatal problems (unparsed lines, missing rarity...) to show to the user. */
  warnings: string[]
}
