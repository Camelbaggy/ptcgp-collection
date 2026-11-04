import type { Card } from '../types'
import { cardId, entityFromImage, toSetId, type PublicCard } from './publicSource'

/**
 * Fill Card.entityId / entityKind from the community dataset (set + number -> asset filename). Pure.
 * Returns new card objects (unchanged ones keep their reference) and the number of cards that gained an id.
 */
export function addEntityIds(cards: Card[], pub: PublicCard[]): { cards: Card[]; added: number } {
  const byId = new Map<string, PublicCard>()
  for (const p of pub) byId.set(cardId(toSetId(p.set), p.number), p)
  let added = 0
  const out = cards.map((c) => {
    if (c.entityId !== undefined) return c
    const e = entityFromImage(byId.get(c.id)?.image)
    if (!e) return c
    added++
    return { ...c, ...e }
  })
  return { cards: out, added }
}
