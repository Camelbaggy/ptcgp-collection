export type FormKind = 'base' | 'mega' | 'regional' | 'other'

/** Entrée de public/data/pokedex.json (générée par scripts/build-pokedex.mjs). */
export interface DexEntry {
  dex: number
  /** Id PokeAPI du pokémon (≥ 10001 pour les formes) ; sert aussi d'id de sprite (public/sprites/<formId>.png). */
  formId: number
  gen: number
  nameFr: string
  nameEn: string
  formLabelFr?: string
  formLabelEn?: string
  formKind: FormKind
  /** Ids de types PokeAPI (1..18). */
  types: number[]
}
