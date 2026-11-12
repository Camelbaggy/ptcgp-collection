import { useCallback, useContext, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { BoostersContext, CardsContext, OwnedContext, RatesContext, SetsContext, WishlistContext } from './dataContext'
import type { Booster, Card, CardSet, HistoryEvent, PackSlotRates, Rarity, Wishlist } from './types'

const NONE: never[] = []
const NO_OWNED: Map<string, number> = new Map()
const NO_CARD_INDEX: Map<string, Card> = new Map()
const NO_BOOSTER_INDEX: Map<string, Booster> = new Map()

export const RARITIES: Rarity[] = ['D1', 'D2', 'D3', 'D4', 'E1', 'E2', 'E3', 'S1', 'S2', 'C1', 'P']

export const RARITY_LABEL: Record<Rarity, string> = {
  D1: '◆', D2: '◆◆', D3: '◆◆◆', D4: '◆◆◆◆',
  E1: '★', E2: '★★', E3: '★★★', S1: '✦', S2: '✦✦', C1: '♛', P: 'Promo',
}

export const setLabel = (s: { id: string; name: string }) => (s.name && s.name !== s.id ? `${s.id} — ${s.name}` : s.id)

/** Extensions hors série (promos P-*, spéciales SP*) : listées après les extensions régulières. */
export const isSpecialSetId = (id: string) => /^(P-|SP\d)/i.test(id)
/** Régulières par date de sortie (ordre), puis SP*, puis promos P-* à la fin. */
export function splitSets<T extends { id: string }>(sets: T[]): { regular: T[]; special: T[] } {
  const rank = (s: T) => (s.id.startsWith('P-') ? 1 : 0)
  return { regular: sets.filter((s) => !isSpecialSetId(s.id)), special: sets.filter((s) => isSpecialSetId(s.id)).sort((a, b) => rank(a) - rank(b)) }
}

// Tables partagées : lues une seule fois par DataProvider (dataProvider.tsx), monté dans main.tsx.
// Tant que la première lecture n'est pas finie, ces hooks renvoient des listes vides.
/** Extensions dans l'ordre de sortie. */
export const useSets = (): CardSet[] => useContext(SetsContext) ?? NONE
export const useBoosters = (): Booster[] => useContext(BoostersContext)?.list ?? NONE
export const useBoosterById = (): Map<string, Booster> => useContext(BoostersContext)?.byId ?? NO_BOOSTER_INDEX
export const useRates = (): PackSlotRates[] => useContext(RatesContext) ?? NONE
export const useWishlist = (): Wishlist[] => useContext(WishlistContext) ?? NONE
/** Vrai quand les taux ont été lus au moins une fois (sinon useRates renvoie une liste vide). */
export const useRatesLoaded = (): boolean => useContext(RatesContext) !== undefined
/** Derniers évènements (plus récents d'abord), éventuellement d'un seul type. */
export const useHistory = (limit = 30, kind?: HistoryEvent['kind']) =>
  useLiveQuery(() => db.history.orderBy('date').reverse().filter((e) => !e.deleted && (!kind || e.kind === kind)).limit(limit).toArray(), [limit, kind]) ?? NONE

/** Toutes les cartes, triées par extension puis numéro. Même tableau tant que la table ne change pas. */
export const useCards = (): Card[] => useContext(CardsContext)?.sorted ?? NONE
/** Index des cartes par id (partagé, ne pas modifier). */
export const useCardById = (): Map<string, Card> => useContext(CardsContext)?.byId ?? NO_CARD_INDEX
/** Quantités possédées par id de carte (partagé, ne pas modifier). */
export const useOwned = (): Map<string, number> => useContext(OwnedContext) ?? NO_OWNED

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

/** Boosters dont les taux sont des estimations non vérifiées (drapeau livré, et aucun taux saisi par l'utilisateur). */
export function estimatedBoosterIds(boosters: Booster[], rates: { boosterId: string; updatedAt?: string }[]): Set<string> {
  const userSet = new Set(rates.filter((r) => r.updatedAt).map((r) => r.boosterId))
  return new Set(boosters.filter((b) => b.ratesEstimated && !userSet.has(b.id)).map((b) => b.id))
}
export const useEstimatedBoosters = (): Set<string> => {
  const b = useBoosters(), r = useRates()
  return useMemo(() => estimatedBoosterIds(b, r), [b, r])
}

/** Extensions livrées nouvelles à annoncer sur l'accueil (meta « newSetNotices »). */
export const useNewSetNotices = (): string[] =>
  useLiveQuery(async () => ((await db.meta.get('newSetNotices'))?.value as string[] | undefined) ?? [], []) ?? NONE
