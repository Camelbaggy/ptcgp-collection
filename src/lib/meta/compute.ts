// Pure computation of the "Méta" tier list from Limitless tournament data (no I/O, unit-tested).
// Used by scripts/fetch-meta.mjs (Node runs the .ts directly) and by the app for the types.
// Method documented in docs/meta.md.

export interface LlCard { count: number; set: string; number: string; name: string }
export interface LlStanding {
  name?: string
  placing?: number | null
  drop?: number | null
  record?: { wins: number; losses: number; ties: number } | null
  deck?: { id?: string | null; name?: string; icons?: string[] } | null
  decklist?: { pokemon?: LlCard[]; trainer?: LlCard[] } | null
}
export interface LlTournament { id: string; date: string; players: number; name?: string; format?: string | null }

export const WINDOWS = { '3d': 3, '7d': 7, '14d': 14 } as const
export type WindowKey = keyof typeof WINDOWS
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D'

export interface MetaCard { cardId: string; count: number; inclusion: number }
export interface DeckStats {
  share: number // 0..1
  players: number
  wins: number
  losses: number
  ties: number
  winRate: number // 0..1, wins / (wins + losses + ties) like Limitless: a tie counts as a non-win
  top8: number // players placed 1..8
  topCut: number // players with a placing (top cut)
  score: number
  tier: Tier
}
export interface MetaDeck {
  id: string
  name: string // as published by Limitless (EN)
  nameFr: string
  icons: string[] // Limitless pokémon icon slugs
  iconCardIds: string[]
  lists: number // decklists used for the consensus
  consensus: MetaCard[]
  flex: MetaCard[]
  stats: Partial<Record<WindowKey, DeckStats>>
}
export interface MetaWindow { days: number; since: string; tournaments: number; players: number }
export interface MetaFile {
  generatedAt: string
  source: 'Limitless'
  windows: Record<WindowKey, MetaWindow>
  decks: MetaDeck[]
}
export interface TournamentData { tournament: LlTournament; standings: LlStanding[] }
export interface CardRef { id: string; nameEn?: string; name: string }

export const MIN_SHARE = 0.005
const DAY = 86400000
const Z = 1.28 // Wilson lower bound at ~80 % one-sided confidence

/** Lower bound of the Wilson score interval for a proportion p observed over n games. */
export function wilsonLower(p: number, n: number, z = Z): number {
  if (n <= 0) return 0
  const z2 = z * z
  return (p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n)
}

/**
 * Score = ln(1 + share in %) x (Wilson lower bound of the win rate / 0.5)^4.
 * Popularity grows slowly (log), performance sharply (4th power around 50 %), and the Wilson bound
 * penalises small samples: a popular deck that loses cannot reach the top, a niche deck cannot either.
 */
export function deckScore(winRate: number, games: number, share: number): number {
  return Math.log(1 + share * 100) * Math.pow(wilsonLower(winRate, games) / 0.5, 4)
}

/** Fixed score thresholds (see docs/meta.md). */
export const TIER_MIN: [Tier, number][] = [['S', 2.0], ['A', 1.4], ['B', 0.9], ['C', 0.5]]
export function tierOf(score: number): Tier {
  for (const [t, min] of TIER_MIN) if (score >= min) return t
  return 'D'
}

const usable = (s: LlStanding) => !!s.deck?.id && s.deck.id !== 'other'
const hasRecord = (s: LlStanding) => !!s.record && [s.record.wins, s.record.losses, s.record.ties].every((n) => Number.isFinite(n))

interface Acc { players: number; wins: number; losses: number; ties: number; top8: number; topCut: number }

export function windowStats(data: TournamentData[], now: number, days: number): { window: MetaWindow; stats: Map<string, DeckStats> } {
  const since = now - days * DAY
  const inWin = data.filter((d) => Date.parse(d.tournament.date) >= since)
  const acc = new Map<string, Acc>()
  let total = 0
  for (const { standings } of inWin) {
    for (const s of standings) {
      if (!usable(s)) continue
      total++
      const a = acc.get(s.deck!.id!) ?? { players: 0, wins: 0, losses: 0, ties: 0, top8: 0, topCut: 0 }
      a.players++
      if (hasRecord(s)) { a.wins += s.record!.wins; a.losses += s.record!.losses; a.ties += s.record!.ties }
      if (typeof s.placing === 'number') { a.topCut++; if (s.placing <= 8) a.top8++ }
      acc.set(s.deck!.id!, a)
    }
  }
  const stats = new Map<string, DeckStats>()
  for (const [id, a] of acc) {
    const share = total ? a.players / total : 0
    if (share < MIN_SHARE) continue
    const games = a.wins + a.losses + a.ties
    const winRate = games ? a.wins / games : 0
    const score = deckScore(winRate, games, share)
    stats.set(id, { share, players: a.players, wins: a.wins, losses: a.losses, ties: a.ties, winRate, top8: a.top8, topCut: a.topCut, score, tier: tierOf(score) })
  }
  return { window: { days, since: new Date(since).toISOString(), tournaments: inWin.length, players: total }, stats }
}

// ---------- Consensus list ----------

const cardKey = (c: LlCard) => `${c.set}-${c.number}`
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

interface NameAgg { name: string; lists: number; counts: Map<number, number>; printings: Map<string, number>; pokemon: boolean }

/** Merges printings by card name (deck rules limit copies per name, whatever the art). */
function aggregate(lists: LlStanding[]): Map<string, NameAgg> {
  const byName = new Map<string, NameAgg>()
  for (const s of lists) {
    const perName = new Map<string, { count: number; printings: Map<string, number>; name: string; pokemon: boolean }>()
    for (const kind of ['pokemon', 'trainer'] as const) {
      for (const c of s.decklist?.[kind] ?? []) {
        const k = norm(c.name)
        const e = perName.get(k) ?? { count: 0, printings: new Map(), name: c.name, pokemon: kind === 'pokemon' }
        e.count += c.count
        e.printings.set(cardKey(c), (e.printings.get(cardKey(c)) ?? 0) + c.count)
        perName.set(k, e)
      }
    }
    for (const [k, e] of perName) {
      const a = byName.get(k) ?? { name: e.name, lists: 0, counts: new Map(), printings: new Map(), pokemon: e.pokemon }
      a.lists++
      a.counts.set(e.count, (a.counts.get(e.count) ?? 0) + 1)
      for (const [p, n] of e.printings) a.printings.set(p, (a.printings.get(p) ?? 0) + n)
      byName.set(k, a)
    }
  }
  return byName
}

const modal = (counts: Map<number, number>): number => {
  let best = 1, bn = -1
  for (const [c, n] of counts) if (n > bn || (n === bn && c < best)) { best = c; bn = n }
  return best
}
const topPrinting = (p: Map<string, number>): string => [...p.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]

export const DECK_SIZE = 20

export interface Consensus { consensus: MetaCard[]; flex: MetaCard[]; names: Map<string, string>; pokemonIds: Map<string, string>; lists: number }

/**
 * Consensus list: cards by decreasing inclusion, each with its modal count (among the lists that play it),
 * added greedily while the 20-card deck has room. Flex: other cards played by 30-70 % of the lists.
 */
export function consensusList(lists: LlStanding[]): Consensus {
  const withList = lists.filter((s) => s.decklist && ((s.decklist.pokemon?.length ?? 0) + (s.decklist.trainer?.length ?? 0)) > 0)
  const n = withList.length
  const agg = aggregate(withList)
  const rows = [...agg.entries()]
    .map(([k, a]) => ({ k, a, inclusion: a.lists / n, count: modal(a.counts), cardId: topPrinting(a.printings) }))
    .sort((x, y) => y.inclusion - x.inclusion || y.count - x.count || x.a.name.localeCompare(y.a.name))
  const consensus: MetaCard[] = []
  const used = new Set<string>()
  let size = 0
  for (const r of rows) {
    if (size >= DECK_SIZE) break
    const count = Math.min(r.count, DECK_SIZE - size)
    consensus.push({ cardId: r.cardId, count, inclusion: round(r.inclusion) })
    used.add(r.k)
    size += count
  }
  const flex = rows
    .filter((r) => !used.has(r.k) && r.inclusion >= 0.3 && r.inclusion <= 0.7)
    .slice(0, 12)
    .map((r) => ({ cardId: r.cardId, count: r.count, inclusion: round(r.inclusion) }))
  const names = new Map<string, string>() // cardId -> English name
  const pokemonIds = new Map<string, string>() // normalised english name -> cardId (pokémon only)
  for (const r of rows) {
    names.set(r.cardId, r.a.name)
    if (r.a.pokemon) pokemonIds.set(r.k, r.cardId)
  }
  return { consensus, flex, names, pokemonIds, lists: n }
}
const round = (x: number) => Math.round(x * 1000) / 1000

// ---------- Names ----------

/** Dictionary English name (without " ex") -> French name, from the card database. */
export function frenchNames(cards: CardRef[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const c of cards) if (c.nameEn && !m.has(norm(c.nameEn))) m.set(norm(c.nameEn), c.name)
  return m
}

/** Splits a deck name ("Suicune ex Baxcalibur") into card-name segments, longest known name first. */
export function splitDeckName(name: string, known: Set<string>): string[] {
  const w = name.split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < w.length;) {
    let found = 0
    for (let len = Math.min(6, w.length - i); len >= 1; len--) {
      if (known.has(norm(w.slice(i, i + len).join(' ')))) { found = len; break }
    }
    if (!found) found = 1
    out.push(w.slice(i, i + found).join(' '))
    i += found
  }
  return out
}

const frOne = (seg: string, fr: Map<string, string>): string => {
  const ex = /\sex$/i.test(seg)
  const base = seg.replace(/\sex$/i, '')
  const f = fr.get(norm(base))
  return f ? (ex ? `${f}-ex` : f) : seg
}

export function deckNameFr(name: string, knownEn: Set<string>, fr: Map<string, string>): { nameFr: string; segments: string[] } {
  const known = new Set([...knownEn, ...[...fr.keys()].flatMap((k) => [k, k + ' ex'])])
  const segments = splitDeckName(name, known)
  return { nameFr: segments.map((s) => frOne(s, fr)).join(' '), segments }
}

// ---------- Whole file ----------

export function computeMeta(data: TournamentData[], cards: CardRef[], now: number): MetaFile {
  const fr = frenchNames(cards)
  const windows = {} as Record<WindowKey, MetaWindow>
  const perWin = {} as Record<WindowKey, Map<string, DeckStats>>
  for (const k of Object.keys(WINDOWS) as WindowKey[]) {
    const r = windowStats(data, now, WINDOWS[k])
    windows[k] = r.window
    perWin[k] = r.stats
  }
  const widest = now - WINDOWS['14d'] * DAY
  const pool = data.filter((d) => Date.parse(d.tournament.date) >= widest).flatMap((d) => d.standings.filter(usable))
  const ids = new Set<string>()
  for (const m of Object.values(perWin)) for (const id of m.keys()) ids.add(id)

  const decks: MetaDeck[] = []
  for (const id of ids) {
    const mine = pool.filter((s) => s.deck!.id === id)
    const c = consensusList(mine)
    const name = mine[0].deck!.name ?? id
    const known = new Set([...c.names.values()].map(norm))
    const { nameFr, segments } = deckNameFr(name, known, fr)
    const iconCardIds = segments
      .map((s) => c.pokemonIds.get(norm(s)))
      .filter((x): x is string => !!x)
      .filter((x, i, a) => a.indexOf(x) === i)
      .slice(0, 3)
    decks.push({
      id, name, nameFr,
      icons: mine[0].deck!.icons ?? [],
      iconCardIds: iconCardIds.length ? iconCardIds : c.consensus.filter((x) => c.pokemonIds.has(norm(c.names.get(x.cardId) ?? ''))).slice(0, 2).map((x) => x.cardId),
      lists: c.lists,
      consensus: c.consensus,
      flex: c.flex,
      stats: Object.fromEntries((Object.keys(WINDOWS) as WindowKey[]).filter((k) => perWin[k].has(id)).map((k) => [k, perWin[k].get(id)!])),
    })
  }
  const ref: WindowKey = '7d'
  decks.sort((a, b) => (b.stats[ref]?.score ?? -1) - (a.stats[ref]?.score ?? -1) || (b.stats['14d']?.score ?? -1) - (a.stats['14d']?.score ?? -1))
  return { generatedAt: new Date(now).toISOString(), source: 'Limitless', windows, decks }
}

/** Tournaments worth fetching: large enough, finished (started long enough ago), not custom-rules. */
export function selectTournaments(list: LlTournament[], now: number, opts: { days?: number; minPlayers?: number; minAgeHours?: number; cap?: number } = {}): LlTournament[] {
  const { days = 14, minPlayers = 16, minAgeHours = 8, cap = 200 } = opts
  return list
    .filter((t) => t.players >= minPlayers)
    .filter((t) => { const d = Date.parse(t.date); return d >= now - days * DAY && d <= now - minAgeHours * 3600000 })
    .filter((t) => !/^custom$/i.test(t.format ?? ''))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, cap)
}
