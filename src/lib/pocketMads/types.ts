/**
 * Tier list PocketMads (https://app.pocketmads.com/tier-list), lue dans la page affichée par un
 * vrai navigateur (fenêtre intégrée de l'appli Android ou favori sur PC). Jamais via leur API.
 */
export interface PmDeck {
  /** nom affiché par PocketMads (anglais) */
  name: string
  /** identifiant d'archétype tiré du lien `/meta-game/<id>` (identique à Limitless), si présent */
  id?: string
  /** score MADS 0–100, si affiché */
  score?: number
  /** taux de victoire 0..1, si affiché */
  winRate?: number
  /** part de la méta 0..1, si affichée */
  share?: number
}
export interface PmTier {
  /** libellé d'origine (« Tier 1 », « Sleepers »…) */
  label: string
  /** clé normalisée : '0'…'3' ou 'S' (sleepers) ; null si inconnue */
  key: '0' | '1' | '2' | '3' | 'S' | null
  decks: PmDeck[]
}
export interface PmTierList {
  fetchedAt: string
  /** période affichée par PocketMads (ex. « 7d »), si lisible */
  range?: string
  tiers: PmTier[]
}
