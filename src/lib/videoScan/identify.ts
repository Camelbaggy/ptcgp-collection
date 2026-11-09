import type { Card } from '../types'
import { fingerprint, fpDistance, type Box } from './fingerprint.ts'
import type { RGBAImage } from './image'
import { boxVariants } from './screenshot.ts'

export interface ShotCandidate { card: Card; dist: number }

/** Cartes et leurs empreintes de référence (null = pas d'image de référence). */
export interface RefSet { cards: Card[]; refs: (Float32Array | null)[] }

/** Léger avantage à l'extension choisie, à ressemblance presque égale. */
export const PREF_BONUS = 0.03

/**
 * Meilleures correspondances de chaque carte repérée : toutes les cartes connues sont comparées
 * (`preferred` d'abord, puis `wide` hors doublons), avec un avantage à `preferred`.
 */
export function rankBoxes(img: RGBAImage, boxes: Box[], preferred: RefSet, wide: RefSet, keep = 4): ShotCandidate[][] {
  const prefIds = new Set(preferred.cards.map((c) => c.id))
  const wideCards: Card[] = [], wideRefs: (Float32Array | null)[] = []
  wide.cards.forEach((c, j) => { if (!prefIds.has(c.id)) { wideCards.push(c); wideRefs.push(wide.refs[j]) } })
  const rank = (cards: Card[], refs: (Float32Array | null)[], fps: Float32Array[]) =>
    cards.flatMap((card, j) => (refs[j] ? [{ card, dist: Math.min(...fps.map((f) => fpDistance(f, refs[j]!))) }] : []))
  return boxes.map((b) => {
    const fps = boxVariants(b).map((v) => fingerprint(img, v))
    const merged = [...rank(preferred.cards, preferred.refs, fps), ...rank(wideCards, wideRefs, fps)]
    return merged
      .sort((a, b2) => (a.dist - (prefIds.has(a.card.id) ? PREF_BONUS : 0)) - (b2.dist - (prefIds.has(b2.card.id) ? PREF_BONUS : 0)))
      .slice(0, keep)
  })
}
