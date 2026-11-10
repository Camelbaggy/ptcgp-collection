import type { MetaDeck } from '../meta/compute'
import type { PmTier } from './types'

/** Nom d'archétype réduit à l'essentiel pour comparer PocketMads et Limitless. */
export function normDeckName(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`.]/g, '')
    .replace(/\b(deck|decks)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ')
}

/** Clé de tier depuis un libellé PocketMads. */
export function tierKey(label: string): PmTier['key'] {
  const l = label.toLowerCase()
  if (/sleeper|outsider/.test(l)) return 'S'
  const m = l.match(/tier\s*([0-3])\b/) ?? l.match(/^\s*([0-3])\s*$/)
  if (m) return m[1] as '0' | '1' | '2' | '3'
  if (/^\s*s\s*$/.test(l)) return '0'
  return null
}

/**
 * Relie chaque deck PocketMads à l'archétype Limitless de `meta.json` : par identifiant de lien,
 * puis par nom normalisé (ordre des mots ignoré). null si aucun ne correspond.
 */
export function matchPmDeck(d: { name: string; id?: string }, decks: MetaDeck[]): MetaDeck | null {
  if (d.id) {
    const byId = decks.find((x) => x.id === d.id)
    if (byId) return byId
  }
  const n = normDeckName(d.name)
  return decks.find((x) => normDeckName(x.name) === n) ?? (d.id ? decks.find((x) => normDeckName(x.id) === normDeckName(d.id!)) : undefined) ?? null
}
