import type { Card } from '../types'
import { PZ_RARITY } from '../importers/pzCollection'

/**
 * Carte correspondant à une image Pokémon-Zone (`cPK_20_022620_01_MEGABANGIRASex_SAR`) :
 * même entité du jeu et même rareté. Les « Super Rare » (SR) et « Special Art Rare » (SAR)
 * partagent notre rareté E2 : la SR est la plus petite, la SAR la plus grande (vérifié sur C1).
 */
export function resolvePzImage(image: string, cards: Card[]): Card | null {
  const m = /\bc(PK|TR)_\d+_(\d+)_\d+_[^"/]*?_([A-Z]+)(?:\.[0-9a-f]{6,})?(?:\.(?:webp|png|jpe?g))?$/.exec(image.split('/').pop() ?? '')
  if (!m) return null
  const [, kind, ent, code] = m
  const rarity = PZ_RARITY[code]
  let cands = cards.filter((c) => c.entityKind === kind && c.entityId === Number(ent) && (!rarity || c.rarity === rarity))
  if (cands.length > 1) {
    const notPromo = cands.filter((c) => c.rarity !== 'P')
    if (notPromo.length) cands = notPromo
  }
  if (cands.length > 1 && (code === 'SR' || code === 'SAR')) {
    const sorted = [...cands].sort((a, b) => a.number - b.number)
    return code === 'SR' ? sorted[0] : sorted[sorted.length - 1]
  }
  return cands.length === 1 ? cands[0] : null
}
