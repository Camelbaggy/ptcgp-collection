import { useState } from 'react'
import { applyCorrections, onUndoError, undoLast } from '../../lib/db'
import type { useToast } from '../../components/Toast'
import { changedRows, cleanQty, reviewValue, toCorrections, type QtyEdits, type QtyRow } from '../../lib/correctionReview'

/** État et enregistrement communs aux écrans de revue d'import (affichage : `CorrectionReview.tsx`). */

type Toast = ReturnType<typeof useToast>

/** Saisies à la main d'un écran de revue. */
export function useCorrectionEdits() {
  const [edits, setEdits] = useState<QtyEdits>({})
  return {
    edits,
    setEdits,
    edit: (cardId: string, raw: string) => setEdits((p) => ({ ...p, [cardId]: cleanQty(raw) })),
    reset: () => setEdits({}),
    valueOf: (row: QtyRow) => reviewValue(row, edits),
    changed: <T extends QtyRow>(rows: readonly T[]) => changedRows(rows, edits),
    corrections: (rows: readonly QtyRow[]) => toCorrections(rows, edits),
  }
}
export type CorrectionEdits = ReturnType<typeof useCorrectionEdits>

/** Action « Annuler » du toast après un enregistrement. */
export const undoAction = (toast: Toast) => ({ label: 'Annuler', run: () => void undoLast().catch(onUndoError(toast)) })

/** Enregistre une correction et l'annonce (avec « Annuler ») ; « Rien à changer » si aucune quantité ne bouge. */
export async function saveCorrections(
  changes: { cardId: string; to: number }[],
  toast: Toast,
  message: (n: number) => string = (n) => `${n} carte(s) mise(s) à jour`,
) {
  const n = changes.length
  const ev = await applyCorrections(changes)
  toast(ev ? message(n) : 'Rien à changer', ev ? undoAction(toast) : undefined)
  return ev
}

