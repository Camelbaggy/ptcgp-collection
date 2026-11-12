import { expectedPacks, packHitProbability } from '../calc/probability'
import type { Card, PackSlotRates } from '../types'
import type { MetaCard } from './compute'

/** Une carte se joue sous toutes ses impressions : on compte par nom anglais (sinon français). */
export const cardKey = (c: Card): string => c.nameEn ?? c.name

export interface MissingCard {
  card: Card // une impression de la carte (celle de la liste Limitless)
  need: number // exemplaires manquants
  /** Faux si aucune impression ne sort d'un booster (carte de mission, promo…). */
  obtainable: boolean
}
export interface BoosterPick { boosterId: string; p: number; packs: number; covers: number }
export interface DeckBuild {
  missing: number // nombre d'exemplaires manquants
  cards: MissingCard[]
  /** Booster qui maximise la chance de sortir au moins une carte manquante (absent si aucun taux connu). */
  booster?: BoosterPick
}
export const MAX_NEAR = 3

/** Quantités possédées par nom de carte, toutes impressions confondues. */
export function ownedByName(cards: Card[], owned: Map<string, number>): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of cards) {
    const q = owned.get(c.id) ?? 0
    if (q) m.set(cardKey(c), (m.get(cardKey(c)) ?? 0) + q)
  }
  return m
}

export interface BuildContext {
  cardById: Map<string, Card>
  byName: Map<string, number>
  printings: Map<string, Card[]>
  boosterCards: Map<string, Card[]>
  ratesByBooster: Map<string, PackSlotRates[]>
}
export function buildContext(cards: Card[], owned: Map<string, number>, rates: PackSlotRates[]): BuildContext {
  const printings = new Map<string, Card[]>()
  const boosterCards = new Map<string, Card[]>()
  for (const c of cards) {
    const k = cardKey(c)
    printings.set(k, [...(printings.get(k) ?? []), c])
    for (const b of c.boosterIds) boosterCards.set(b, [...(boosterCards.get(b) ?? []), c])
  }
  const ratesByBooster = new Map<string, PackSlotRates[]>()
  for (const r of rates) ratesByBooster.set(r.boosterId, [...(ratesByBooster.get(r.boosterId) ?? []), r])
  return { cardById: new Map(cards.map((c) => [c.id, c])), byName: ownedByName(cards, owned), printings, boosterCards, ratesByBooster }
}

/** Ce qu'il manque pour monter la liste type d'un deck, et le booster à ouvrir en priorité. */
export function deckBuild(consensus: MetaCard[], ctx: BuildContext): DeckBuild {
  const cards: MissingCard[] = []
  for (const mc of consensus) {
    const card = ctx.cardById.get(mc.cardId)
    if (!card) continue
    const need = mc.count - (ctx.byName.get(cardKey(card)) ?? 0)
    if (need <= 0) continue
    const obtainable = (ctx.printings.get(cardKey(card)) ?? [card]).some((p) => p.boosterIds.length > 0)
    cards.push({ card, need, obtainable })
  }
  const missing = cards.reduce((n, c) => n + c.need, 0)
  const wanted = new Set(cards.filter((c) => c.obtainable).map((c) => cardKey(c.card)))
  const candidates = new Set<string>()
  for (const k of wanted) for (const p of ctx.printings.get(k) ?? []) for (const b of p.boosterIds) candidates.add(b)
  let booster: BoosterPick | undefined
  for (const boosterId of candidates) {
    const r = ctx.ratesByBooster.get(boosterId)
    const bc = ctx.boosterCards.get(boosterId)
    if (!r || !bc) continue
    const p = packHitProbability(r, bc, (c) => wanted.has(cardKey(c)))
    if (p <= 0) continue
    if (!booster || p > booster.p) {
      booster = { boosterId, p, packs: expectedPacks(p), covers: [...wanted].filter((k) => bc.some((c) => cardKey(c) === k)).length }
    }
  }
  return { missing, cards, booster }
}
