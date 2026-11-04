import type { Card, Rarity } from '../types'
import { buildIndex, matchCard, type DexIndex } from './match'
import type { DexEntry } from './types'

export const DEX_RARITIES: Rarity[] = ['D1', 'D2', 'D3', 'D4', 'E1', 'E2', 'E3', 'S1', 'S2', 'C1', 'P']

export interface RarityCount { total: number; owned: number }
export interface DexRow {
  entry: DexEntry
  /** Cartes Pokémon du jeu pour cette entrée (toutes extensions). */
  cards: Card[]
  total: number
  /** Cartes différentes possédées (quantité ≥ 1). */
  owned: number
  byRarity: Partial<Record<Rarity, RarityCount>>
  /** Nombre de raretés différentes (colonne « Raretés différentes » du Sheet). */
  rarityKinds: number
}
export interface DexSummary {
  entries: number
  /** Entrées ayant au moins une carte. */
  withCards: number
  /** Entrées dont au moins une carte est possédée. */
  withOwned: number
  totalCards: number
  ownedCards: number
  byRarity: Partial<Record<Rarity, RarityCount>>
}

export function isPokemonCard(c: Card): boolean {
  return (c as Card & { entityKind?: string }).entityKind !== 'TR'
}

/** Carte -> formId de l'entrée Pokédex (cartes Pokémon uniquement ; Dresseur exclus). */
export function matchAll(idx: DexIndex, cards: Card[]): { byForm: Map<number, Card[]>; unmatched: Card[] } {
  const byForm = new Map<number, Card[]>()
  const unmatched: Card[] = []
  for (const c of cards) {
    if (!isPokemonCard(c)) continue
    const e = matchCard(idx, c)
    if (!e) { unmatched.push(c); continue }
    const l = byForm.get(e.formId) ?? []
    l.push(c)
    byForm.set(e.formId, l)
  }
  return { byForm, unmatched }
}

/** Compte les cartes (1 par carte différente) par rareté, avec la part possédée. */
export function countByRarity(cards: Card[], owned: Map<string, number>): Partial<Record<Rarity, RarityCount>> {
  const out: Partial<Record<Rarity, RarityCount>> = {}
  for (const c of cards) {
    const r = (out[c.rarity] ??= { total: 0, owned: 0 })
    r.total++
    if ((owned.get(c.id) ?? 0) > 0) r.owned++
  }
  return out
}

export function buildDexRows(entries: DexEntry[], cards: Card[], owned: Map<string, number>): { rows: DexRow[]; unmatched: Card[] } {
  const { byForm, unmatched } = matchAll(buildIndex(entries), cards)
  const rows = entries.map((entry): DexRow => {
    const cs = byForm.get(entry.formId) ?? []
    const byRarity = countByRarity(cs, owned)
    return {
      entry, cards: cs, total: cs.length,
      owned: cs.filter((c) => (owned.get(c.id) ?? 0) > 0).length,
      byRarity, rarityKinds: Object.keys(byRarity).length,
    }
  })
  return { rows, unmatched }
}

export function summarize(rows: DexRow[]): DexSummary {
  const byRarity: Partial<Record<Rarity, RarityCount>> = {}
  let withCards = 0, withOwned = 0, totalCards = 0, ownedCards = 0
  for (const r of rows) {
    if (r.total) withCards++
    if (r.owned) withOwned++
    totalCards += r.total
    ownedCards += r.owned
    for (const k of DEX_RARITIES) {
      const c = r.byRarity[k]
      if (!c) continue
      const t = (byRarity[k] ??= { total: 0, owned: 0 })
      t.total += c.total
      t.owned += c.owned
    }
  }
  return { entries: rows.length, withCards, withOwned, totalCards, ownedCards, byRarity }
}
