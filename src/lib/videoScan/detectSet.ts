import type { Card } from '../types'
import { fpDistance } from './fingerprint'

export interface SetGuess {
  /** extension la plus votée (null si aucune carte reconnue) */
  setId: string | null
  /** part des cartes reconnues qui votent pour elle, 0–1 */
  share: number
  /** nombre de cartes reconnues */
  matched: number
}

/** Au-delà, l'illustration ne ressemble pas assez à une carte connue : pas de vote. */
const VOTE_DIST = 0.25
const SAMPLE = 48

/**
 * Devine l'extension d'un écran « Échange de points Booster » : chaque carte vue (échantillon réparti
 * sur tout le défilement) vote pour l'extension de la carte connue la plus proche.
 */
export function detectSet(tileFps: Float32Array[], cards: Card[], refs: (Float32Array | null)[]): SetGuess {
  if (!tileFps.length) return { setId: null, share: 0, matched: 0 }
  const step = Math.max(1, Math.floor(tileFps.length / SAMPLE))
  const votes = new Map<string, number>()
  let matched = 0
  for (let i = 0; i < tileFps.length; i += step) {
    let best = -1
    let bestD = VOTE_DIST
    for (let j = 0; j < cards.length; j++) {
      const r = refs[j]
      if (!r) continue
      const d = fpDistance(tileFps[i], r)
      if (d < bestD) { bestD = d; best = j }
    }
    if (best >= 0) {
      matched++
      const id = cards[best].setId
      votes.set(id, (votes.get(id) ?? 0) + 1)
    }
  }
  let top: string | null = null
  let n = 0
  for (const [id, v] of votes) if (v > n) { top = id; n = v }
  return { setId: top, share: matched ? n / matched : 0, matched }
}
