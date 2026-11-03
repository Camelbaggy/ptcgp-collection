import type { Booster, Card, CardSet } from '../types'

/** What every importer returns; feeds the "Nouvelle extension" screen. */
export interface ImportedSet {
  set: CardSet
  boosters: Booster[]
  cards: Card[]
  /** Non-fatal problems (unparsed lines, missing rarity...) to show to the user. */
  warnings: string[]
}
