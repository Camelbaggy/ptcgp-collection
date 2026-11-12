import { normalize } from './useData'
import type { Card } from './types'

/** Rang de correspondance d'une carte pour une recherche (plus petit = meilleur), -1 si aucune. */
export function searchRank(c: Card, q: string): number {
  const n = normalize(q.trim()).replace(/\s+/g, ' ')
  if (!n) return -1
  const id = c.id.toLowerCase()
  const compact = n.replace(/[\s_]+/g, '-')
  if (id === compact || id === n) return 0
  if (/^\d+$/.test(n)) {
    if (String(c.number) === n) return 1
    return String(c.number).startsWith(n) ? 5 : -1
  }
  if (/-/.test(compact) && id.startsWith(compact)) return 2
  const names = [normalize(c.name), normalize(c.nameEn ?? '')]
  if (names.some((x) => x === n)) return 1
  if (names.some((x) => x.startsWith(n))) return 3
  if (names.some((x) => x.split(/[\s\-']+/).some((w) => w.startsWith(n)))) return 4
  if (names.some((x) => x.includes(n))) return 6
  if (id.includes(compact) && compact.length >= 2) return 7
  return -1
}

/** Cartes correspondant à la recherche, meilleures d'abord puis extension et numéro. */
export function searchCards(cards: Card[], q: string, limit = 40): { results: Card[]; total: number } {
  if (!q.trim()) return { results: [], total: 0 }
  const hits: { c: Card; r: number }[] = []
  for (const c of cards) {
    const r = searchRank(c, q)
    if (r >= 0) hits.push({ c, r })
  }
  hits.sort((a, b) => a.r - b.r || a.c.setId.localeCompare(b.c.setId) || a.c.number - b.c.number)
  return { results: hits.slice(0, limit).map((h) => h.c), total: hits.length }
}
