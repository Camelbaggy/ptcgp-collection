import type { Card } from '../types'

/**
 * Corrections of French card names that TCGdex or the community dataset get wrong.
 * Applied by `mergePublicData` (so `scripts/update-sets.mjs` keeps them on every run) and checked by
 * `src/lib/data.test.ts`.
 */

/** Card id -> right French name (the source puts another Pokémon's name on the card). */
export const NAME_FIX_BY_ID: Record<string, string> = {
  'B2-210': 'Babimanta', // Mantyke, was "Amonita"
  'B2-211': 'Amonita', // Omanyte, was "Amonistar"
  'B2-212': 'Amonistar', // Omastar, was "Babimanta"
  'P-A-81': 'Ultra-Necrozma', // was "Bulbizarre"
}

/** Spelling variants (same Pokémon, English name given) -> official French spelling. */
export const NAME_FIX_BY_SPELLING: Record<string, { nameEn: string; fixes: Record<string, string> }> = {
  electabuzz: { nameEn: 'Electabuzz', fixes: { 'Électriquetek': 'Élektek' } },
  electivire: { nameEn: 'Electivire', fixes: { 'Électriqueable': 'Élekable' } },
  pineco: { nameEn: 'Pineco', fixes: { 'Pomdepic': 'Pomdepik' } },
  feebas: { nameEn: 'Feebas', fixes: { 'Barloche': 'Barpau' } }, // Barloche = Barboach
  chienpao: { nameEn: 'Chien-Pao', fixes: { 'Baoijan': 'Baojian' } },
  exeggcute: { nameEn: 'Exeggcute', fixes: { 'Noeunoeuf': 'Nœunœuf' } },
  lillie: { nameEn: 'Lillie', fixes: { 'Lillie': 'Lilie' } },
  fennekin: { nameEn: 'Fennekin', fixes: { 'Feunec': 'Feunnec' } },
}

/** Returns the corrected name of a card, or its current name when nothing applies. */
export function fixedName(c: Pick<Card, 'id' | 'name' | 'nameEn'>): string {
  const byId = NAME_FIX_BY_ID[c.id]
  if (byId) return byId
  for (const s of Object.values(NAME_FIX_BY_SPELLING)) {
    if (s.nameEn === c.nameEn && s.fixes[c.name]) return s.fixes[c.name]
  }
  return c.name
}

/** Applies the corrections; `fixed` lists the ids whose name changed. */
export function applyNameFixes<T extends Pick<Card, 'id' | 'name' | 'nameEn'>>(cards: T[]): { cards: T[]; fixed: string[] } {
  const fixed: string[] = []
  const out = cards.map((c) => {
    const name = fixedName(c)
    if (name === c.name) return c
    fixed.push(c.id)
    return { ...c, name }
  })
  return { cards: out, fixed }
}
