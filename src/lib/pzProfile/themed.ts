import type { Card } from '../types'
import { resolvePzImage } from './resolve'
import type { PzThemed, PzThemedCard, PzThemedCollection } from './types'

/** Carte d'une collection à thème, rapprochée de notre collection actuelle. */
export interface LiveThemedCard {
  /** Clé de dédoublonnage : id de notre carte, sinon nom d'image Pokémon-Zone. */
  key: string
  name: string
  /** Notre carte (null si l'image n'a pas pu être rapprochée). */
  card: Card | null
  /** Possédée aujourd'hui dans l'appli (≥ 1 exemplaire) ; sans correspondance, l'état de la page. */
  owned: boolean
  /** État donné par la page Pokémon-Zone à l'import. */
  ownedAtImport: boolean
}

export type LiveStatus = 'done' | 'doneSince' | 'todo'

export interface LiveCollection {
  index: number
  src: PzThemedCollection
  /** `done` : terminée à l'import ; `doneSince` : terminée depuis grâce à l'appli ; `todo` : à terminer. */
  status: LiveStatus
  cards: LiveThemedCard[]
  /** Cartes encore manquantes aujourd'hui. */
  missingNow: number
}

export interface LiveSection {
  setCode: string | null
  name: string
  total: number
  completedAtImport: number
  completedNow: number
}

export interface LiveThemed {
  collections: LiveCollection[]
  sections: LiveSection[]
  total: number
  completedAtImport: number
  completedNow: number
  doneSince: number
  incomplete: number
  /** Cartes distinctes manquantes dans les collections encore incomplètes. */
  cardsToFind: Card[]
  /** Idem, y compris celles sans correspondance (comptées une fois). */
  cardsToFindCount: number
}

/** Carte désignée par un lien `/cards/<slug>/<n>/` : `<slug>` = code d'extension (insensible à la casse). */
export function resolvePzHref(href: string | undefined, cards: Card[]): Card | null {
  if (!href) return null
  const m = /\/cards\/([^/]+)\/(-?\d+)\/?/.exec(href)
  if (!m) return null
  const id = `${m[1]}-${Number(m[2])}`.toLowerCase()
  return cards.find((c) => c.id.toLowerCase() === id) ?? null
}

export function resolveThemedCard(pc: PzThemedCard, cards: Card[]): Card | null {
  return resolvePzHref(pc.href, cards) ?? resolvePzImage(pc.image, cards)
}

export function computeLiveThemed(data: PzThemed, cards: Card[], owned: Map<string, number>): LiveThemed {
  const collections: LiveCollection[] = data.collections.map((src, index) => {
    const lc: LiveThemedCard[] = src.cards.map((pc) => {
      const card = resolveThemedCard(pc, cards)
      return {
        key: card ? card.id : 'img:' + pc.image,
        name: card?.name ?? pc.name,
        card,
        owned: card ? (owned.get(card.id) ?? 0) >= 1 || pc.owned : pc.owned,
        ownedAtImport: pc.owned,
      }
    })
    const missingNow = lc.filter((c) => !c.owned).length
    const status: LiveStatus = src.completed ? 'done' : lc.length > 0 && missingNow === 0 ? 'doneSince' : 'todo'
    return { index, src, status, cards: lc, missingNow }
  })

  const sections: LiveSection[] = data.sections.map((s) => {
    const since = collections.filter((c) => c.status === 'doneSince' && c.src.setCode === s.setCode).length
    return { ...s, completedAtImport: s.completed, completedNow: Math.min(s.total, s.completed + since) }
  })

  const missing = new Map<string, LiveThemedCard>()
  for (const c of collections) {
    if (c.status !== 'todo') continue
    for (const lc of c.cards) if (!lc.owned && !missing.has(lc.key)) missing.set(lc.key, lc)
  }
  const doneSince = collections.filter((c) => c.status === 'doneSince').length
  return {
    collections,
    sections,
    total: data.total,
    completedAtImport: data.completed,
    completedNow: Math.min(data.total, data.completed + doneSince),
    doneSince,
    incomplete: collections.filter((c) => c.status === 'todo').length,
    cardsToFind: [...missing.values()].flatMap((m) => (m.card ? [m.card] : [])),
    cardsToFindCount: missing.size,
  }
}
