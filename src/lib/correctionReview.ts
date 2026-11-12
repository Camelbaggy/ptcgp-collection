/**
 * Logique commune des écrans de revue d'import (vidéo, lecture d'écran, Pokémon-Zone, saisie en masse) :
 * une ligne par carte avec la quantité actuelle, la quantité lue et une éventuelle saisie à la main.
 */

/** Une carte en revue : quantité dans l'appli (`cur`) et quantité lue par l'import (`read`, null = illisible). */
export interface QtyRow {
  cardId: string
  cur: number
  read: number | null
}

/** Saisies à la main, par id de carte (texte brut du champ ; vide = pas de saisie). */
export type QtyEdits = Record<string, string>

/** Nettoie la saisie d'une quantité : chiffres seulement, 4 au plus. */
export function cleanQty(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4)
}

/** Quantité retenue : la saisie si elle existe, sinon la lecture, sinon la quantité actuelle. */
export function reviewValue(row: QtyRow, edits: QtyEdits): number {
  const e = edits[row.cardId]
  if (e !== undefined && e !== '') return Number(e)
  return row.read ?? row.cur
}

/** Lignes dont la quantité retenue diffère de la quantité actuelle. */
export function changedRows<T extends QtyRow>(rows: readonly T[], edits: QtyEdits): T[] {
  return rows.filter((r) => reviewValue(r, edits) !== r.cur)
}

/** Corrections à enregistrer pour ces lignes. */
export function toCorrections(rows: readonly QtyRow[], edits: QtyEdits): { cardId: string; to: number }[] {
  return rows.map((r) => ({ cardId: r.cardId, to: reviewValue(r, edits) }))
}

/** « 3 modifiées », « 1 modifiée ». */
export function modifiedLabel(n: number): string {
  return `${n} modifiée${n > 1 ? 's' : ''}`
}
