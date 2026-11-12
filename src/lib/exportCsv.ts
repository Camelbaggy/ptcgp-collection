import type { Booster, Card, CardSet, Wishlist } from './types'
import { RARITY_LABEL } from './useData'

export type CsvScope = 'all' | 'owned' | 'missing' | 'doubles'
/** `\t` : tableau collable directement dans Google Sheets / Excel. */
export type CsvSep = ';' | ',' | '\t'

export const CSV_SCOPES: { id: CsvScope; label: string }[] = [
  { id: 'all', label: 'Toutes les cartes' },
  { id: 'owned', label: 'Possédées' },
  { id: 'missing', label: 'Manquantes' },
  { id: 'doubles', label: 'Doublons (2+)' },
]

export const CSV_HEADER = ['Identifiant', 'Extension', 'Numéro', 'Nom', 'Nom anglais', 'Rareté', 'Code rareté', 'Finition', 'Type', 'Boosters', 'Quantité', 'Souhait (priorité)']

/** Échappe un champ : guillemets si séparateur, guillemet ou saut de ligne ; neutralise les formules (=, +, -, @) pour un tableur. */
export function csvField(v: string | number, sep: CsvSep): string {
  let s = String(v)
  if (sep === '\t') s = s.replace(/\t/g, ' ')
  if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`
  return /["\n\r]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s
}

export function inScope(scope: CsvScope, qty: number): boolean {
  return scope === 'all' || (scope === 'owned' && qty >= 1) || (scope === 'missing' && qty === 0) || (scope === 'doubles' && qty >= 2)
}

export interface CsvInput { cards: Card[]; sets: CardSet[]; boosters: Booster[]; owned: Map<string, number>; wishlist: Wishlist[] }

/** Lignes (sans BOM), fin de ligne CRLF. Les cartes suivent l'ordre reçu (déjà trié par extension et numéro). */
export function buildCsv({ cards, sets, boosters, owned, wishlist }: CsvInput, scope: CsvScope = 'all', sep: CsvSep = ';'): { csv: string; rows: number } {
  const setName = new Map(sets.map((s) => [s.id, s.name]))
  const boosterName = new Map(boosters.map((b) => [b.id, b.name]))
  const prio = new Map(wishlist.map((w) => [w.cardId, w.priority]))
  const lines = [CSV_HEADER.map((h) => csvField(h, sep)).join(sep)]
  let rows = 0
  for (const c of cards) {
    const qty = owned.get(c.id) ?? 0
    if (!inScope(scope, qty)) continue
    const fields: (string | number)[] = [
      c.id, setName.get(c.setId) ?? c.setId, c.number, c.name, c.nameEn ?? '', RARITY_LABEL[c.rarity] ?? c.rarity, c.rarity, c.finish ?? '', c.type ?? '',
      c.boosterIds.map((b) => boosterName.get(b) ?? b).join(' / '), qty, prio.get(c.id) ?? '',
    ]
    lines.push(fields.map((f) => csvField(f, sep)).join(sep))
    rows++
  }
  return { csv: lines.join('\r\n') + '\r\n', rows }
}
