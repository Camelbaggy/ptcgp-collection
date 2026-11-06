/**
 * Données du profil Pokémon-Zone (pages enregistrées par l'utilisateur ou relevées par le
 * favori « Envoyer vers Holothèque »). Contrat commun aux parseurs (`parse*.ts`), au stockage
 * et aux écrans. Aucune donnée ne vient du compte Nintendo : uniquement ce que la page affiche.
 */
import type { Rarity } from '../types'

/** Classement affiché sous un compteur : « #128 of 5 602 · top 2% ». */
export interface PzRank { rank: number; of: number; topPct: number }

/** Compteur à vie (« Packs opened », « Versus wins »…). `key` = libellé anglais en kebab-case. */
export interface PzCounter {
  key: string
  label: string
  value: number
  /** Valeur affichée arrondie (« 115K ») : `value` n'est qu'approchée. */
  approx?: boolean
  rank?: PzRank
  /** Détail affiché sous la valeur (« 1 620 / 2 959 »). */
  detail?: string
}

/** Objet du jeu repéré par son icône : `.../ItemIcons/<group>/<id>.webp`, ou une carte. */
export interface PzItem {
  /** Nom du fichier sans extension ni empreinte (`SHOPTICKET`, `PACK_CHARGER_100030`, `cPK_20_022330_02_MEGAMEWTWOXex_IM`). */
  id: string
  /** Dossier de l'icône (`Currency`, `RewardTicket`, `PackPowerCharger`, …) ; `Card` pour une carte. */
  group: string
  amount: number
  approx?: boolean
}

export interface PzRarityProgress { code: string; rarity?: Rarity; owned: number; total: number }

export interface PzHome {
  name: string
  level: number | null
  friendId: string | null
  /** Date de la dernière synchronisation avec le jeu (AAAA-MM-JJ). */
  syncedAt: string | null
  rarityProgress: PzRarityProgress[]
  currencies: PzItem[]
  tickets: PzItem[]
  hourglasses: PzItem[]
  /** Points booster par extension (code du jeu : `A1`, `B4b`, `C1`…). */
  packPoints: { setCode: string; points: number }[]
  trophies: { id: string; label: string; locked: boolean }[]
}

export interface PzBar { label: string; value: number; secondary?: string; unique?: number; cards?: number }

export interface PzStats {
  /** « as of 06/11/2026 » (AAAA-MM-JJ). */
  asOf: string | null
  counters: PzCounter[]
  battles: PzCounter[]
  /** Boosters ouverts par extension (code depuis le lien `/sets/<code>/`). */
  packsBySet: { setCode: string; name: string; packs: number; cards: number; unique: number }[]
  /** Boosters ouverts par pack (icône `PACK_ICON_…`). */
  packsByPack: { packIcon: string; name: string; packs: number }[]
  byRarity: (PzBar & { code: string; rarity?: Rarity })[]
  byType: PzBar[]
  trainers: PzBar[]
  special: PzBar[]
}

export interface PzThemedCard {
  /** Lien `/cards/<slug>/<n>/` quand la page le donne. */
  href?: string
  /** Nom du fichier image de la carte (sans dossier). */
  image: string
  name: string
  owned: boolean
}

export interface PzThemedCollection {
  title: string
  /** Code de l'extension de la section (logo `LOGO_expansion_<code>_…`). */
  setCode: string | null
  completed: boolean
  /** Cartes manquantes (« 1 card missing »), 0 si terminée. */
  missing: number
  /** Nombre affiché « N Cards ». */
  cardCount: number | null
  secret: boolean
  rewards: PzItem[]
  /** Cartes demandées : seulement pour les collections incomplètes (la page masque les autres). */
  cards: PzThemedCard[]
}

export interface PzThemed {
  completed: number
  total: number
  missingCards: number
  sections: { setCode: string | null; name: string; completed: number; total: number }[]
  collections: PzThemedCollection[]
}

export interface PzWishlist {
  /** Noms de fichier des images des cartes, dans l'ordre de la page. */
  images: string[]
}

export type PzPageKind = 'home' | 'stats' | 'themed' | 'wishlist' | 'set'
