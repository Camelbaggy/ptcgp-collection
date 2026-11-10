/**
 * Tier list PocketMads (https://app.pocketmads.com/tier-list), lue dans la page affichée par un
 * vrai navigateur (fenêtre intégrée de l'appli Android ou favori). Jamais via leur API.
 */
export type PmTierKey = '0' | '1' | '2' | '3' | 'S'
export interface PmDeck {
  /** nom affiché par PocketMads (anglais, comme Limitless) */
  name: string
  /** identifiant d'archétype du lien `/meta-game/<id>` (identifiant Limitless) */
  id?: string
  score?: number
  /** 0..1 */
  winRate?: number
  games?: number
  /** 0..1 */
  share?: number
  /** variation du score sur ~24 h */
  delta?: number
  /** a changé de tier sur 24 h */
  shift?: boolean
}
export interface PmTier {
  /** libellé d'origine (« Tier 1 », « Sleepers »…) */
  label: string
  key: PmTierKey | null
  decks: PmDeck[]
}
export interface PmTierList {
  /** moment de la lecture */
  fetchedAt: string
  /** « Updated … » affiché par PocketMads */
  updated?: string
  /** période (ex. « 7d ») tirée des liens */
  range?: string
  tiers: PmTier[]
}

/** Ce que rend le script lu dans la page (`extract.ts`). */
export interface PmRaw {
  v: number
  url?: string
  updated?: string
  tiers: { label: string; sub?: string; count?: string; open?: boolean; decks: { name: string; href: string; stats: Record<string, string>; delta?: string; shift?: boolean }[] }[]
}
