/**
 * Contrat de la lecture du « Résumé ouverture » de plusieurs boosters (ouverture de 10 boosters).
 * L'écran du jeu empile des blocs « Booster n° X » (3 + 2 cartes, ou 3 + 3), qu'on fait défiler ;
 * au plus 2 blocs visibles à la fois. Entrée : plusieurs captures dans l'ordre du défilement,
 * ou les images d'une vidéo du défilement. Implémentation : recap.ts (pur) + browser.ts (`recognizeRecap`).
 */
import type { ShotDetection } from './browser'

export interface RecapBooster {
  /** rang dans le récap, 1 = premier booster (numéro lu « Booster n° X » si possible, sinon ordre d'apparition) */
  index: number
  /** vrai si le numéro vient de la lecture de l'en-tête, faux s'il est déduit de l'ordre */
  indexRead: boolean
  /** cartes du booster, dans l'ordre de lecture (ligne par ligne, de gauche à droite) */
  cards: ShotDetection[]
  /** nombre d'exemplaires affiché sur chaque carte (après l'ouverture), null si illisible */
  counts: (number | null)[]
}

export interface RecapResult {
  boosters: RecapBooster[]
  /** messages pour l'utilisateur (booster manquant, bloc coupé ignoré…) */
  warnings: string[]
}

export type RecapProgress = (done: number, total: number) => void

/** Signature attendue de `recognizeRecap` dans browser.ts. */
export type RecognizeRecap = (
  images: (Blob | import('./image').RGBAImage)[],
  preferred: import('../types').Card[],
  all: import('../types').Card[],
  onProgress?: RecapProgress,
) => Promise<RecapResult>
