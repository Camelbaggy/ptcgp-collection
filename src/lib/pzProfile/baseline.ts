/**
 * L'instantané Pokémon-Zone sert de point de départ : l'appli le prolonge avec les packs
 * complets saisis après la date de l'import (`fetchedAt`). Logique pure, sans accès à la base.
 */
import type { HistoryEvent } from '../types'
import { PACK_POINTS_PER_PACK, isFullPack, onlyPacks, type PackEv } from '../stats/packs'
import type { PzHome, PzStats } from './types'

/** Clé de compteur « Packs opened » / « Cards obtained » (libellé anglais en kebab-case). */
export const PACKS_OPENED_KEY = 'packs-opened'
export const CARDS_OBTAINED_KEY = 'cards-obtained'

/** Code de set Pokémon-Zone (`A1`, `B4b`, `PROMO-A`) -> id de set de l'appli (`A1`, `B4b`, `P-A`), insensible à la casse. */
export function pzSetToSetId(code: string, setIds: string[]): string | null {
  const c = code.trim().toLowerCase()
  const alt = c.replace(/^promo-/, 'p-')
  return setIds.find((id) => id.toLowerCase() === c) ?? setIds.find((id) => id.toLowerCase() === alt) ?? null
}

/** Packs complets saisis dans l'appli strictement après `fetchedAt`. */
export function packsAfter(history: HistoryEvent[], fetchedAt: string): PackEv[] {
  const t = Date.parse(fetchedAt)
  if (Number.isNaN(t)) return []
  return onlyPacks(history).filter((e) => isFullPack(e) && Date.parse(e.date) > t)
}

export interface Baseline {
  /** Packs ouverts : compteur PZ + packs de l'appli après l'import (null si le compteur PZ est absent). */
  packsOpened: number | null
  cardsObtained: number | null
  /** Packs et cartes ajoutés par l'appli depuis l'import. */
  addedPacks: number
  addedCards: number
  /** Points de booster par code de set PZ. */
  packPoints: { setCode: string; points: number; added: number }[]
  /** Packs ouverts par code de set PZ. */
  packsBySet: { setCode: string; name: string; packs: number; added: number }[]
}

export interface BaselineInput {
  fetchedAt: string
  home?: PzHome | null
  stats?: PzStats | null
  history: HistoryEvent[]
  /** Identifiant de set d'un booster (`A1-Mewtwo` -> `A1`). */
  boosterSet: (boosterId: string) => string
  setIds: string[]
}

const counter = (s: PzStats | null | undefined, key: string) => s?.counters.find((c) => c.key === key)?.value ?? null

export function computeBaseline(i: BaselineInput): Baseline {
  const after = packsAfter(i.history, i.fetchedAt)
  const addedCards = after.reduce((n, e) => n + e.cardIds.length, 0)
  const perSet = new Map<string, number>()
  for (const e of after) { const s = i.boosterSet(e.boosterId); perSet.set(s, (perSet.get(s) ?? 0) + 1) }
  const addedFor = (code: string) => {
    const sid = pzSetToSetId(code, i.setIds)
    return sid ? perSet.get(sid) ?? 0 : 0
  }
  const pk = counter(i.stats, PACKS_OPENED_KEY)
  const ck = counter(i.stats, CARDS_OBTAINED_KEY)
  return {
    packsOpened: pk === null ? null : pk + after.length,
    cardsObtained: ck === null ? null : ck + addedCards,
    addedPacks: after.length,
    addedCards,
    packPoints: (i.home?.packPoints ?? []).map((p) => {
      const added = addedFor(p.setCode)
      return { setCode: p.setCode, points: p.points + added * PACK_POINTS_PER_PACK, added }
    }),
    packsBySet: (i.stats?.packsBySet ?? []).map((p) => {
      const added = addedFor(p.setCode)
      return { ...p, packs: p.packs + added, added }
    }),
  }
}
