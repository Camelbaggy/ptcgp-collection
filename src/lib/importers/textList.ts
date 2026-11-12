import type { Booster, Card, CardSet, Rarity } from '../types'
import { boosterId, cardId } from './publicSource'
import { extractRarity, parseRarityToken } from './rarity'
import type { ImportedSet } from './types'

export interface ParsedLine {
  number: number
  name: string
  rarity: Rarity | null
  /** Booster name from a section header, if any. */
  booster?: string
  line: number
}

export interface ParseOptions {
  /** Known booster names: a line equal to one of them is a section header. */
  boosters?: string[]
}

export interface ParseResult {
  entries: ParsedLine[]
  boosters: string[]
  warnings: string[]
}

const NUM_PREFIX = /^\s*(?:[A-Za-z0-9]{1,6}-)?#?(\d{1,3})(?![\d])\s*(?:\/\s*\d+)?\s*[.):\-–—,]*\s*(.*)$/
const NUM_SUFFIX = /^(.*?)[\s(]+#?(\d{1,3})\s*\/\s*\d+\)?(?:\s+(.*))?$/
const HEADER = /^\s*(?:#{1,4}\s+|(?:booster|pack|deck|paquet)\s*:\s*|\[)(.+?)\]?\s*$/i

/**
 * Tolerant parser for lists pasted from community sites. Accepts lines such as
 *   "1 Bulbasaur ◊"   "#002 Ivysaur ◊◊"   "A1-3 Venusaur ex ◊◊◊◊"   "4. Salamèche (1 star)"
 *   "5<TAB>Pikachu<TAB>☆"   "6, Mew, crown"   "Bulbizarre 001/226 ◊"
 * Section lines ("## Mewtwo", "Booster: Mewtwo") assign the following cards to a booster;
 * a line that is only a rarity ("◊◊◊") sets the default rarity of the following cards.
 * If no line has a number at all, cards are numbered sequentially from 1.
 */
export function parseCardList(text: string, opts: ParseOptions = {}): ParseResult {
  const warnings: string[] = []
  const lines = text.replace(/\r/g, '').split('\n')
  const known = new Set((opts.boosters ?? []).map((b) => b.toLowerCase()))
  const hasNumbers = lines.some((l) => NUM_PREFIX.test(l) && !parseRarityToken(l.trim()))
  const entries: ParsedLine[] = []
  const boosters: string[] = [...(opts.boosters ?? [])]
  let booster: string | undefined
  let sectionRarity: Rarity | null = null
  let seq = 0

  lines.forEach((raw, i) => {
    const lineNo = i + 1
    const t = raw.trim()
    if (!t || /^(\/\/|--)/.test(t)) return

    if (known.has(t.toLowerCase())) {
      booster = boosters.find((b) => b.toLowerCase() === t.toLowerCase())
      return
    }
    const h = HEADER.exec(t)
    if (h && !/^#?\d/.test(t.replace(/^#+\s+/, ''))) {
      const title = h[1].trim()
      const r: Rarity | null = parseRarityToken(title)
      if (r) sectionRarity = r
      else {
        booster = title.replace(/^(booster|pack)\s*:?\s*/i, '')
        if (!boosters.some((b) => b.toLowerCase() === booster!.toLowerCase())) boosters.push(booster)
      }
      return
    }
    const lone = parseRarityToken(t)
    if (lone && !/^[A-Za-z]{1,2}$/.test(t)) {
      sectionRarity = lone
      return
    }

    let number: number | null = null
    let rest = t
    const m = hasNumbers ? NUM_PREFIX.exec(t) : null
    if (m) {
      number = Number(m[1])
      rest = m[2]
    } else if (hasNumbers) {
      const s = NUM_SUFFIX.exec(t)
      if (s) {
        number = Number(s[2])
        rest = `${s[1]} ${s[3] ?? ''}`.trim()
      }
    }
    if (number === null) {
      if (hasNumbers) {
        warnings.push(`Ligne ${lineNo} ignorée (pas de numéro) : « ${t} »`)
        return
      }
      number = ++seq
    }

    // Find the rarity: a separate cell or a trailing/inline symbol run.
    let rarity: Rarity | null = null
    const cells = rest.split(/\t+|\s*[;|]\s*|\s+,\s*|,\s+(?=[^,]*$)/).map((c) => c.trim()).filter(Boolean)
    let nameParts: string[] = []
    if (cells.length > 1) {
      for (const c of cells) {
        const r: Rarity | null = rarity === null ? parseRarityToken(c) : null
        if (r) rarity = r
        else nameParts.push(c)
      }
    } else nameParts = cells
    let name = nameParts[0] ?? ''
    if (rarity === null) {
      const ex = extractRarity(nameParts.join(' ').trim())
      rarity = ex.rarity
      name = ex.rest
    } else name = nameParts.join(' ')
    name = name.replace(/^[\s\-–—.:]+|[\s\-–—,:]+$/g, '').trim()
    if (!name) {
      warnings.push(`Ligne ${lineNo} ignorée (pas de nom) : « ${t} »`)
      return
    }
    seq = number
    entries.push({ number, name, rarity: rarity ?? sectionRarity, booster, line: lineNo })
  })
  return { entries, boosters, warnings }
}

export interface TextImportOptions {
  setId: string
  name: string
  nameEn?: string
  releaseDate?: string
  order: number
  /** Booster names; if omitted, taken from section headers, else one booster named after the set. */
  boosters?: string[]
  /** Rarity for cards where none was found (default 'D1'). */
  defaultRarity?: Rarity
  /** Use `P` for all cards of a promo set. */
  promo?: boolean
}

/** Build a full set from a pasted text list. Pure. */
export function importFromText(text: string, o: TextImportOptions): ImportedSet {
  const parsed = parseCardList(text, { boosters: o.boosters })
  const warnings = [...parsed.warnings]
  const set: CardSet = { id: o.setId, name: o.name, nameEn: o.nameEn, releaseDate: o.releaseDate, order: o.order }
  const names = parsed.boosters.length ? parsed.boosters : [o.name]
  const boosters: Booster[] = names.map((n) => ({ id: boosterId(o.setId, n), setId: o.setId, name: n }))
  const allIds = boosters.map((b) => b.id)
  const seen = new Set<number>()
  const cards: Card[] = []
  for (const e of parsed.entries) {
    if (seen.has(e.number)) {
      warnings.push(`Numéro ${e.number} en double (ligne ${e.line}, « ${e.name} ») : ignoré.`)
      continue
    }
    seen.add(e.number)
    let rarity = o.promo ? 'P' : e.rarity
    if (!rarity) {
      rarity = o.defaultRarity ?? 'D1'
      warnings.push(`Rareté inconnue pour « ${e.name} » (n° ${e.number}) : ${rarity} par défaut.`)
    }
    const id = cardId(o.setId, e.number)
    cards.push({
      id,
      setId: o.setId,
      number: e.number,
      name: e.name,
      rarity: rarity as Rarity,
      boosterIds: e.booster ? [boosterId(o.setId, e.booster)] : allIds,
      image: `cards/${o.setId}/${id}.webp`,
    })
  }
  cards.sort((a, b) => a.number - b.number)
  if (!cards.length) warnings.push('Aucune carte reconnue dans le texte.')
  return { set, boosters, cards, warnings }
}

/** UI entry point: parse pasted text into a set (order 99 = "to be assigned by the caller"). */
export function parseSetText(
  text: string,
  o: { setId: string; name: string } & Partial<Omit<TextImportOptions, 'setId' | 'name'>>,
): ImportedSet {
  if (!o.setId.trim()) throw new Error("Renseigne l'identifiant de l'extension (ex. B3).")
  return importFromText(text, { order: 99, ...o, setId: o.setId.trim(), name: o.name.trim() || o.setId.trim() })
}
