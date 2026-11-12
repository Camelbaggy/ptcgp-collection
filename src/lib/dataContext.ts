import { createContext } from 'react'
import type { Booster, Card, CardSet, PackSlotRates, Wishlist } from './types'

/**
 * Données de référence et quantités partagées par tous les écrans.
 *
 * Monté une seule fois (main.tsx) : chaque table est lue par une seule requête Dexie,
 * relancée seulement quand cette table change, au lieu d'une requête par composant.
 * Un contexte par table pour qu'un changement de quantité ne redessine pas les écrans
 * qui n'utilisent que les cartes ou les extensions.
 *
 * `undefined` = pas encore lu (chargement). Le fournisseur est dans DataProvider.tsx,
 * les hooks publics dans useData.ts.
 */

export interface CardsData {
  /** Ordre de la base (clé primaire), celui que lisaient l'accueil et les stats. */
  raw: Card[]
  /** Triées par extension puis numéro, l'ordre d'affichage. */
  sorted: Card[]
  byId: Map<string, Card>
}

export interface BoostersData { list: Booster[]; byId: Map<string, Booster> }

export const SetsContext = createContext<CardSet[] | undefined>(undefined)
export const BoostersContext = createContext<BoostersData | undefined>(undefined)
export const CardsContext = createContext<CardsData | undefined>(undefined)
export const RatesContext = createContext<PackSlotRates[] | undefined>(undefined)
export const OwnedContext = createContext<Map<string, number> | undefined>(undefined)
export const WishlistContext = createContext<Wishlist[] | undefined>(undefined)

export const compareCards = (a: Card, b: Card) => (a.setId === b.setId ? a.number - b.number : a.setId.localeCompare(b.setId))
