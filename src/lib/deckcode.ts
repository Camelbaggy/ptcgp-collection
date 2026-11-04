import type { Card } from './types'

/**
 * Pokémon TCG Pocket in-game deck QR code (community-documented format, see docs/meta.md):
 * Base64 of  u8 trainerCount, trainerCount x u24be (trainer entity + 10 000 000),
 *            u8 pokemonCount, pokemonCount x u24be pokémon entity,
 *            u8 energyCount,  energyCount x u8 energy type.
 * Every copy is a separate entry. Pure, no I/O.
 */

export const TRAINER_OFFSET = 10_000_000

/** In-game energy type codes (Dragon 10 and Colorless 11 are never emitted). */
export const ENERGY_CODE: Record<string, number> = {
  Plante: 1, Feu: 2, Eau: 3, Électrique: 4, Psy: 5, Combat: 6, Obscurité: 7, Métal: 8,
}
export const ENERGY_NAME: Record<number, string> = Object.fromEntries(Object.entries(ENERGY_CODE).map(([k, v]) => [v, k]))

export interface DeckCodeCard { cardId: string; count: number }
export interface DeckCodeInput { cards: DeckCodeCard[]; energies: number[] }
export interface DeckCodeEntry { kind: 'PK' | 'TR'; entityId: number; count: number }
export interface DecodedDeckCode { entries: DeckCodeEntry[]; energies: number[] }

export class DeckCodeError extends Error {}

const u24 = (n: number) => [(n >>> 16) & 255, (n >>> 8) & 255, n & 255]

/** Encode a deck. Throws DeckCodeError when a card is unknown or has no entity id. */
export function encodeDeckCode(deck: DeckCodeInput, cards: Pick<Card, 'id' | 'entityId' | 'entityKind'>[]): string {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const pk: number[] = []
  const tr: number[] = []
  for (const { cardId, count } of deck.cards) {
    const c = byId.get(cardId)
    if (!c || c.entityId === undefined || !c.entityKind) throw new DeckCodeError(`Carte sans identifiant : ${cardId}`)
    for (let i = 0; i < count; i++) (c.entityKind === 'TR' ? tr : pk).push(c.entityKind === 'TR' ? c.entityId + TRAINER_OFFSET : c.entityId)
  }
  if (tr.length > 255 || pk.length > 255 || deck.energies.length > 255) throw new DeckCodeError('Deck trop grand')
  const bytes = [tr.length, ...tr.flatMap(u24), pk.length, ...pk.flatMap(u24), deck.energies.length, ...deck.energies]
  return btoa(String.fromCharCode(...bytes))
}

/** Decode a deck code into grouped entries (same entity merged, first-seen order) and energy types. */
export function decodeDeckCode(b64: string): DecodedDeckCode {
  let raw: string
  try { raw = atob(b64.trim()) } catch { throw new DeckCodeError('Base64 invalide') }
  const b = Array.from(raw, (ch) => ch.charCodeAt(0))
  let p = 0
  const need = (n: number) => { if (p + n > b.length) throw new DeckCodeError('Code tronqué') }
  const ids = (): number[] => {
    need(1)
    const n = b[p++]!
    need(n * 3)
    const out: number[] = []
    for (let i = 0; i < n; i++, p += 3) out.push((b[p]! << 16) | (b[p + 1]! << 8) | b[p + 2]!)
    return out
  }
  const trainers = ids()
  const pokemon = ids()
  need(1)
  const ne = b[p++]!
  need(ne)
  const energies = b.slice(p, p + ne)
  const entries: DeckCodeEntry[] = []
  const add = (kind: 'PK' | 'TR', entityId: number) => {
    const e = entries.find((x) => x.kind === kind && x.entityId === entityId)
    if (e) e.count++
    else entries.push({ kind, entityId, count: 1 })
  }
  for (const t of trainers) add('TR', t - TRAINER_OFFSET)
  for (const m of pokemon) add('PK', m)
  return { entries, energies }
}

/**
 * Energy types of a deck, from the Pokémon types (French labels): ex Pokémon weigh double, each copy counts.
 * Types holding at least 30 % of the weight, 3 at most, most represented first; Colorless/Dragon are ignored
 * (never emitted). Falls back to the single most common type.
 */
export function deckEnergies(deck: DeckCodeCard[], cards: Pick<Card, 'id' | 'name' | 'nameEn' | 'type'>[]): number[] {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const w = new Map<number, number>()
  for (const { cardId, count } of deck) {
    const c = byId.get(cardId)
    if (!c?.type) continue
    const weight = count * (/ ex$/i.test(c.nameEn ?? c.name) ? 2 : 1)
    // "Eau Obscurité" style dual labels count for each of their types
    for (const code of new Set(c.type.split(' ').map((t) => ENERGY_CODE[t]).filter((x): x is number => !!x)))
      w.set(code, (w.get(code) ?? 0) + weight)
  }
  const sorted = [...w.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  if (!sorted.length) return []
  const total = sorted.reduce((n, [, x]) => n + x, 0)
  const kept = sorted.filter(([, x]) => x / total >= 0.3).slice(0, 3)
  return (kept.length ? kept : sorted.slice(0, 1)).map(([code]) => code)
}
