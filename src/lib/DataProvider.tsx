import { useMemo, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import {
  BoostersContext, CardsContext, OwnedContext, RatesContext, SetsContext, WishlistContext,
  compareCards, type BoostersData, type CardsData,
} from './dataContext'

/** Lit une fois les tables partagées et les fournit à toute l'appli (voir dataContext.ts). */
export function DataProvider({ children }: { children: ReactNode }) {
  const sets = useLiveQuery(() => db.sets.orderBy('order').toArray(), [])
  const boosterRows = useLiveQuery(() => db.boosters.toArray(), [])
  const cardRows = useLiveQuery(() => db.cards.toArray(), [])
  const rates = useLiveQuery(() => db.rates.toArray(), [])
  const ownedRows = useLiveQuery(() => db.owned.toArray(), [])
  const wishlist = useLiveQuery(() => db.wishlist.toArray(), [])

  const boosters = useMemo<BoostersData | undefined>(
    () => boosterRows && { list: boosterRows, byId: new Map(boosterRows.map((b) => [b.id, b])) },
    [boosterRows],
  )
  const cards = useMemo<CardsData | undefined>(
    () => cardRows && { raw: cardRows, sorted: [...cardRows].sort(compareCards), byId: new Map(cardRows.map((c) => [c.id, c])) },
    [cardRows],
  )
  const owned = useMemo(() => ownedRows && new Map(ownedRows.map((o) => [o.cardId, o.quantity])), [ownedRows])

  return (
    <SetsContext.Provider value={sets}>
      <BoostersContext.Provider value={boosters}>
        <CardsContext.Provider value={cards}>
          <RatesContext.Provider value={rates}>
            <OwnedContext.Provider value={owned}>
              <WishlistContext.Provider value={wishlist}>{children}</WishlistContext.Provider>
            </OwnedContext.Provider>
          </RatesContext.Provider>
        </CardsContext.Provider>
      </BoostersContext.Provider>
    </SetsContext.Provider>
  )
}
