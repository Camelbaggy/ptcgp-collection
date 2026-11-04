import type { DexRow } from './aggregate'

export type DexSortKey = 'dex' | 'name' | 'total' | 'owned' | 'missing' | 'pct' | 'rarities' | 'gen'
export type SortDir = 'asc' | 'desc'

export const DEX_SORTS: { key: DexSortKey; label: string; defaultDir: SortDir }[] = [
  { key: 'dex', label: 'N° Pokédex', defaultDir: 'asc' },
  { key: 'name', label: 'Nom', defaultDir: 'asc' },
  { key: 'total', label: 'Nombre de cartes différentes', defaultDir: 'desc' },
  { key: 'owned', label: 'Cartes différentes possédées', defaultDir: 'desc' },
  { key: 'missing', label: 'Cartes manquantes', defaultDir: 'desc' },
  { key: 'pct', label: '% de complétion', defaultDir: 'desc' },
  { key: 'rarities', label: 'Raretés différentes', defaultDir: 'desc' },
  { key: 'gen', label: 'Génération', defaultDir: 'asc' },
]

export const defaultDir = (key: DexSortKey): SortDir => DEX_SORTS.find((s) => s.key === key)?.defaultDir ?? 'asc'

/** Ordre du Pokédex national : n°, puis l'espèce de base avant ses formes (formId croissant). */
export function compareDex(a: DexRow, b: DexRow): number {
  return a.entry.dex - b.entry.dex || a.entry.formId - b.entry.formId
}

const num: Record<Exclude<DexSortKey, 'dex' | 'name'>, (r: DexRow) => number> = {
  total: (r) => r.total,
  owned: (r) => r.owned,
  missing: (r) => r.total - r.owned,
  pct: (r) => (r.total ? r.owned / r.total : 0),
  rarities: (r) => r.rarityKinds,
  gen: (r) => r.entry.gen,
}

/** Tri pur (ne modifie pas l'entrée). Égalités départagées par n° Pokédex croissant, quel que soit le sens. */
export function sortDexRows(rows: DexRow[], key: DexSortKey, dir: SortDir = defaultDir(key)): DexRow[] {
  const sign = dir === 'asc' ? 1 : -1
  const primary: (a: DexRow, b: DexRow) => number =
    key === 'dex' ? compareDex
    : key === 'name' ? (a, b) => a.entry.nameFr.localeCompare(b.entry.nameFr, 'fr')
    : (a, b) => num[key](a) - num[key](b)
  return [...rows].sort((a, b) => sign * primary(a, b) || compareDex(a, b))
}
