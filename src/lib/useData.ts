import { useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { Booster, Card, CardSet, Rarity, Wishlist } from './types'

const NONE: never[] = []

export const RARITIES: Rarity[] = ['D1', 'D2', 'D3', 'D4', 'E1', 'E2', 'E3', 'S1', 'S2', 'C1', 'P']

export const RARITY_LABEL: Record<Rarity, string> = {
  D1: '◆', D2: '◆◆', D3: '◆◆◆', D4: '◆◆◆◆',
  E1: '★', E2: '★★', E3: '★★★', S1: '✦', S2: '✦✦', C1: '♛', P: 'Promo',
}

export const setLabel = (s: { id: string; name: string }) => (s.name && s.name !== s.id ? `${s.id} — ${s.name}` : s.id)

export const useSets = (): CardSet[] => useLiveQuery(() => db.sets.orderBy('order').toArray(), []) ?? NONE
export const useBoosters = (): Booster[] => useLiveQuery(() => db.boosters.toArray(), []) ?? NONE
export const useRates = () => useLiveQuery(() => db.rates.toArray(), []) ?? NONE
export const useWishlist = (): Wishlist[] => useLiveQuery(() => db.wishlist.toArray(), []) ?? NONE
export const useHistory = () =>
  useLiveQuery(() => db.history.orderBy('date').reverse().filter((e) => !e.deleted).limit(30).toArray(), []) ?? NONE

export function useCards(): Card[] {
  return (
    useLiveQuery(async () => {
      const c = await db.cards.toArray()
      return c.sort((a, b) => (a.setId === b.setId ? a.number - b.number : a.setId.localeCompare(b.setId)))
    }, []) ?? NONE
  )
}

export function useOwned(): Map<string, number> {
  return useLiveQuery(async () => new Map((await db.owned.toArray()).map((o) => [o.cardId, o.quantity])), []) ?? new Map()
}

/** État persisté dans localStorage (confort uniquement, tolère l'absence de stockage). */
export function usePersisted<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem('ptcgp:' + key)
      return s === null ? init : (JSON.parse(s) as T)
    } catch { return init }
  })
  const set = useCallback((n: T) => {
    setV(n)
    try { localStorage.setItem('ptcgp:' + key, JSON.stringify(n)) } catch { /* ignore */ }
  }, [key])
  return [v, set]
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function matchCard(c: Card, q: string, rarities: Rarity[]): boolean {
  if (rarities.length && !rarities.includes(c.rarity)) return false
  if (!q) return true
  const n = normalize(q)
  return normalize(c.name).includes(n) || normalize(c.nameEn ?? '').includes(n) || c.id.toLowerCase() === n || String(c.number) === n
}
