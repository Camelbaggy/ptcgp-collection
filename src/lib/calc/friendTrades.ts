import type { Card, Rarity } from '../types'
import type { OwnedMap } from './probability'
import { RARITY_ORDER, TRADE_RULES, type TradeRules } from './rules'
import { tradeOffers } from './offers'

/**
 * Échanges entre amis, sans serveur (lot F1, 2026-11-12).
 * Chacun produit un « code d'échange » : ses doubles échangeables (règles de `offers.ts`)
 * et ses cartes manquantes dans les raretés échangeables. Le code d'un ami, comparé à
 * sa propre collection, donne les échanges possibles, toujours à rareté égale.
 *
 * Format texte (avant compression) : `H1|<pseudo>|<AAAA-MM-JJ>|<doubles>|<manquantes>`,
 * chaque liste étant `A1:1~4.7.9;A2:3` (extension, puis numéros ou plages `début~fin`).
 * Le texte est compressé (deflate brut) puis encodé en base64url.
 */

export const FRIEND_CODE_VERSION = 'H1'
/** Taille maximale d'un code décompressé accepté (garde-fou contre un code piégé). */
const MAX_TEXT = 200_000

export interface FriendCode {
  name: string
  /** Date du code, `AAAA-MM-JJ`. */
  date: string
  offers: string[]
  missing: string[]
}

export class FriendCodeError extends Error {}

const splitId = (id: string): [string, number] | null => {
  const i = id.lastIndexOf('-', id.length - 2)
  // Les numéros négatifs (SP1 : « SP1--1 ») gardent leur signe.
  const j = id[i - 1] === '-' ? i - 1 : i
  if (j <= 0) return null
  const n = Number(id.slice(j + 1))
  return Number.isInteger(n) ? [id.slice(0, j), n] : null
}

/** Liste d'ids → `A1:1~4.7;A2:3` (ordre stable, doublons retirés). */
export function packIds(ids: string[]): string {
  const bySet = new Map<string, Set<number>>()
  for (const id of ids) {
    const p = splitId(id)
    if (!p) continue
    if (!bySet.has(p[0])) bySet.set(p[0], new Set())
    bySet.get(p[0])!.add(p[1])
  }
  const parts: string[] = []
  for (const [set, nums] of [...bySet].sort((a, b) => a[0].localeCompare(b[0]))) {
    const s = [...nums].sort((a, b) => a - b)
    const out: string[] = []
    for (let i = 0; i < s.length; i++) {
      let j = i
      while (j + 1 < s.length && s[j + 1] === s[j]! + 1 && s[i]! >= 0) j++
      out.push(j > i + 1 ? `${s[i]}~${s[j]}` : String(s[i]))
      if (j === i + 1) out.push(String(s[j]))
      i = j
    }
    parts.push(`${set}:${out.join('.')}`)
  }
  return parts.join(';')
}

/** Inverse de `packIds`. Lève FriendCodeError si la liste est mal formée. */
export function unpackIds(text: string): string[] {
  if (!text) return []
  const ids: string[] = []
  for (const part of text.split(';')) {
    const k = part.indexOf(':')
    const set = part.slice(0, k)
    if (k <= 0 || !/^[A-Za-z0-9-]{1,12}$/.test(set)) throw new FriendCodeError('Code illisible')
    for (const tok of part.slice(k + 1).split('.')) {
      const m = /^(-?\d+)(?:~(\d+))?$/.exec(tok)
      if (!m) throw new FriendCodeError('Code illisible')
      const a = Number(m[1])
      const b = m[2] === undefined ? a : Number(m[2])
      if (b < a || b - a > 2000) throw new FriendCodeError('Code illisible')
      for (let n = a; n <= b; n++) ids.push(`${set}-${n}`)
    }
  }
  return ids
}

const clean = (s: string) => s.replace(/[|\n\r]/g, ' ').trim().slice(0, 40)

export function friendCodeText(c: FriendCode): string {
  return [FRIEND_CODE_VERSION, clean(c.name), c.date, packIds(c.offers), packIds(c.missing)].join('|')
}

export function parseFriendCodeText(text: string): FriendCode {
  const p = text.split('|')
  if (p[0] !== FRIEND_CODE_VERSION || p.length !== 5) throw new FriendCodeError('Ce n’est pas un code d’échange Holothèque (ou il vient d’une version plus récente)')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p[2]!)) throw new FriendCodeError('Code illisible')
  return { name: p[1]!, date: p[2]!, offers: unpackIds(p[3]!), missing: unpackIds(p[4]!) }
}

const toB64url = (b: Uint8Array) => {
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64url = (s: string) => {
  const raw = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, t: CompressionStream | DecompressionStream, max = Infinity): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(t).getReader()
  const chunks: Uint8Array[] = []
  let n = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    n += value.length
    if (n > max) { void reader.cancel(); throw new FriendCodeError('Code trop volumineux') }
    chunks.push(value)
  }
  const out = new Uint8Array(n)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.length }
  return out
}

/** Code d'échange compact (base64url), à mettre dans un lien ou un QR. */
export async function encodeFriendCode(c: FriendCode): Promise<string> {
  const z = await pipe(new TextEncoder().encode(friendCodeText(c)), new CompressionStream('deflate-raw'))
  return toB64url(z)
}

/** Accepte un code brut ou un lien qui le contient (`…code=XXXX`). */
export function extractFriendCode(input: string): string {
  const s = input.trim()
  const m = /[?&]code=([A-Za-z0-9_-]+)/.exec(s)
  return m ? m[1]! : s.replace(/\s+/g, '')
}

export async function decodeFriendCode(input: string): Promise<FriendCode> {
  const code = extractFriendCode(input)
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) throw new FriendCodeError('Code vide ou mal copié')
  let bytes: Uint8Array
  try { bytes = await pipe(fromB64url(code), new DecompressionStream('deflate-raw'), MAX_TEXT) }
  catch (e) { if (e instanceof FriendCodeError) throw e; throw new FriendCodeError('Code incomplet ou mal copié') }
  return parseFriendCodeText(new TextDecoder().decode(bytes))
}

/** Cartes manquantes (0 exemplaire) dans les raretés échangeables. */
export function missingTradable(cards: Card[], owned: OwnedMap, rules: TradeRules = TRADE_RULES): Card[] {
  return cards.filter((c) => rules.tradableRarities.includes(c.rarity) && (owned.get(c.id) ?? 0) < 1)
}

/** Mon code d'échange : doubles (mes règles) + manquantes. */
export function myFriendCode(cards: Card[], owned: OwnedMap, name: string, date: string, rules: TradeRules = TRADE_RULES): FriendCode {
  return {
    name, date,
    offers: tradeOffers(cards, owned, rules).map((o) => o.card.id),
    missing: missingTradable(cards, owned, rules).map((c) => c.id),
  }
}

export interface RarityMatch {
  rarity: Rarity
  /** Cartes que l'ami peut me donner (ses doubles que je n'ai pas). */
  receive: Card[]
  /** Cartes que je peux donner (mes doubles qu'il n'a pas). */
  give: Card[]
  /** Nombre d'échanges possibles : min(receive, give). */
  count: number
}

const byId = (a: Card, b: Card) => a.id.localeCompare(b.id, 'fr', { numeric: true })

/**
 * Échanges possibles avec un ami, par rareté (de la plus rare à la plus commune).
 * Les ids inconnus (extension plus récente chez l'ami) sont ignorés. Ma propre collection
 * fait foi pour mes manques : une carte obtenue depuis le code de l'ami n'est plus proposée.
 */
export function matchFriend(cards: Card[], owned: OwnedMap, friend: FriendCode, rules: TradeRules = TRADE_RULES): RarityMatch[] {
  const index = new Map(cards.map((c) => [c.id, c]))
  const mine = new Set(tradeOffers(cards, owned, rules).map((o) => o.card.id))
  const theirMissing = new Set(friend.missing)
  const per = new Map<Rarity, RarityMatch>()
  const slot = (r: Rarity) => {
    if (!per.has(r)) per.set(r, { rarity: r, receive: [], give: [], count: 0 })
    return per.get(r)!
  }
  for (const id of new Set(friend.offers)) {
    const c = index.get(id)
    if (c && rules.tradableRarities.includes(c.rarity) && (owned.get(id) ?? 0) < 1) slot(c.rarity).receive.push(c)
  }
  for (const id of mine) {
    const c = index.get(id)!
    if (theirMissing.has(id)) slot(c.rarity).give.push(c)
  }
  return [...per.values()]
    .map((m) => ({ ...m, receive: m.receive.sort(byId), give: m.give.sort(byId), count: Math.min(m.receive.length, m.give.length) }))
    .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))
}
