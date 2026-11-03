import type { Rarity } from '../types'

/** Rarity codes used by the public dataset (flibustier/pokemon-tcg-pocket-database) -> our Rarity. */
export const PUBLIC_RARITY_MAP: Record<string, Rarity> = {
  C: 'D1', // Common: 1 diamond
  U: 'D2', // Uncommon: 2 diamonds
  R: 'D3', // Rare: 3 diamonds
  RR: 'D4', // Double Rare (ex): 4 diamonds
  AR: 'E1', // Art Rare: 1 star
  SR: 'E2', // Super Rare: 2 stars
  SAR: 'E2', // Special Art Rare: 2 stars
  IM: 'E3', // Immersive Rare: 3 stars
  S: 'S1', // Shiny: 1 shiny star
  SSR: 'S2', // Shiny Super Rare: 2 shiny stars
  UR: 'C1', // Crown Rare
  AN: 'P', // Anniversary / special promo-like cards (SP1 Mew), no regular rarity
}

export function mapPublicRarity(code: string | undefined): Rarity {
  if (!code) return 'P'
  return PUBLIC_RARITY_MAP[code.trim().toUpperCase()] ?? 'P'
}

const DIAMONDS = '◊♦◇◆🔹🔸🔷🔶'
const STARS = '☆★⭐✩✪'
const SHINY = '✦✧'
const CROWNS = '♛♕👑'

const RARITY_WORDS: [RegExp, Rarity][] = [
  [/^(crown( rare)?|couronne|ur)$/i, 'C1'],
  [/^(shiny super rare|ssr)$/i, 'S2'],
  [/^(shiny( rare)?|chromatique|s)$/i, 'S1'],
  [/^(immersive( rare)?|im)$/i, 'E3'],
  [/^(special art rare|sar|super rare|sr)$/i, 'E2'],
  [/^(art rare|ar|illustration rare)$/i, 'E1'],
  [/^(double rare|rr|ex)$/i, 'D4'],
  [/^(rare|r)$/i, 'D3'],
  [/^(uncommon|peu commune|u)$/i, 'D2'],
  [/^(common|commune|c)$/i, 'D1'],
  [/^(promo|p)$/i, 'P'],
]

/**
 * Parse a rarity token as pasted from community sites: "◊◊◊", "☆☆", "👑", "3 diamonds",
 * "2 stars", "crown", "SAR", "D3", "E1"... Returns null when it is not a rarity.
 */
export function parseRarityToken(raw: string): Rarity | null {
  const t = raw.trim()
  if (!t) return null
  if (/^(D[1-4]|E[1-3]|S[1-2]|C1|P)$/i.test(t)) return t.toUpperCase() as Rarity
  const chars = [...t.replace(/[\s\-_,.]/g, '')]
  if (chars.length) {
    const all = (set: string) => chars.every((c) => [...set].includes(c))
    if (all(DIAMONDS)) return chars.length >= 1 && chars.length <= 4 ? (`D${chars.length}` as Rarity) : null
    if (all(STARS)) return chars.length <= 3 ? (`E${chars.length}` as Rarity) : null
    if (all(SHINY)) return chars.length <= 2 ? (`S${chars.length}` as Rarity) : null
    if (all(CROWNS)) return 'C1'
  }
  const m = /^(\d)\s*[- ]?\s*(diamonds?|losanges?|stars?|[ée]toiles?)$/i.exec(t)
  if (m) {
    const n = Number(m[1])
    if (/^(d|l)/i.test(m[2])) return n >= 1 && n <= 4 ? (`D${n}` as Rarity) : null
    return n >= 1 && n <= 3 ? (`E${n}` as Rarity) : null
  }
  for (const [re, r] of RARITY_WORDS) if (re.test(t)) return r
  return null
}

/** Finds a rarity run of symbols at the end (or anywhere) of a text; returns rarity and the text without it. */
export function extractRarity(text: string): { rarity: Rarity | null; rest: string } {
  const sym = `[${DIAMONDS}${STARS}${SHINY}${CROWNS}]`
  const re = new RegExp(`(?:^|[\\s(\\[,;|\\-])((?:${sym}\\s?)+)(?=$|[\\s)\\],;|])`, 'u')
  const m = re.exec(text)
  if (m) {
    const r = parseRarityToken(m[1])
    if (r) return { rarity: r, rest: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).trim() }
  }
  // trailing or bracketed words / codes
  const w = /(?:^|[\s(\[,;|\-]+)(\d\s?(?:diamonds?|losanges?|stars?|[ée]toiles?)|crown(?: rare)?|couronne|shiny(?: super rare)?|chromatique|immersive(?: rare)?|special art rare|super rare|art rare|double rare|uncommon|common|SAR|SSR|IM|UR|SR|AR|RR|D[1-4]|E[1-3]|S[12]|C1)[)\]]?\s*$/i.exec(text)
  if (w) {
    const r = parseRarityToken(w[1])
    if (r) return { rarity: r, rest: text.slice(0, w.index).trim() }
  }
  return { rarity: null, rest: text.trim() }
}
