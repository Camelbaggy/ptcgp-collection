/**
 * Géométrie de l'écran « Échange de points Booster » du jeu, mesurée sur une capture
 * Android en portrait. Toutes les images sont d'abord ramenées à REF_W px de large :
 * les positions horizontales sont donc fixes, la hauteur dépend du format de l'écran.
 */
export const REF_W = 592

/** Bord gauche du badge d'exemplaires, pour les 3 colonnes. */
export const COL_X = [60, 245, 428] as const
export const BADGE_W = 58
export const BADGE_H = 20

/** Carte affichée, relative au coin haut-gauche du badge (x0, yb). */
export const CARD_DX = 2
export const CARD_DY = -130
export const CARD_W = 106
export const CARD_H = 150

/** Zone qui défile (fractions de la hauteur) : sous l'en-tête, au-dessus du bouton fermer. */
export const BAND_TOP = 0.25
export const BAND_BOTTOM = 0.88
/** Colonnes prises en compte pour mesurer le défilement (évite les flèches à droite). */
export const SHIFT_X0 = 20
export const SHIFT_X1 = 520

/** Couleur ardoise du badge quand la carte est possédée (≈ rgb(80, 93, 118)). */
export function isBadgeSlate(r: number, g: number, b: number): boolean {
  const d = b - r
  return d > 18 && d < 60 && r > 55 && r < 115 && g > 70 && g < 125 && b > 95 && b < 150
}

export function bandRows(height: number): [number, number] {
  return [Math.round(height * BAND_TOP), Math.round(height * BAND_BOTTOM)]
}
