// Pure computation of the "Méta" tier list from Limitless tournament data (no I/O, unit-tested).
// Used by scripts/fetch-meta.mjs (Node runs the .ts directly) and by the app for the types.
// Method (modelled on PocketMads' "MADs") documented in docs/meta.md.

export interface LlCard { count: number; set: string; number: string; name: string }
export interface LlStanding {
  name?: string
  player?: string // Limitless username, the key used by pairings
  placing?: number | null
  drop?: number | null
  record?: { wins: number; losses: number; ties: number } | null
  deck?: { id?: string | null; name?: string; icons?: string[] } | null
  decklist?: { pokemon?: LlCard[]; trainer?: LlCard[] } | null
}
/** One line of GET /tournaments/{id}/pairings. winner: username, 0 = tie, -1 = bye / no result / double loss. */
export interface LlPairing { round?: number; phase?: number; winner: string | number; player1?: string; player2?: string }
export interface LlTournament { id: string; date: string; players: number; name?: string; format?: string | null }
export interface LlDetails { format?: string | null; name?: string; bannedCards?: unknown[] | null }

export const WINDOWS = { '3d': 3, '7d': 7, '14d': 14 } as const
export type WindowKey = keyof typeof WINDOWS
/** 0..3 = numbered tiers, 'S' = sleeper ("Outsiders prometteurs"). */
export type Tier = 0 | 1 | 2 | 3 | 'S'

export interface MetaCard { cardId: string; count: number; inclusion: number }
export interface DeckStats {
  share: number // 0..1, entries / entries with a known deck
  players: number // entries
  wins: number // decided matches won
  losses: number
  games: number // decided matches (wins + losses)
  winRate: number // 0..1, wins / games
  posGames: number // decided matches against decks with >= POS_MIN_SHARE
  posWinRate: number // 0..1
  score: number // 0..100
  tier: Tier | null // null = not shown (too few matches and not a sleeper)
  delta?: number // score change since the previous published file (~24 h)
  /** Decided matches against the most played archetypes of the window (popularity order, mirror excluded). */
  matchups?: Matchup[]
}
export interface Matchup { op: string; wins: number; games: number } // op = opponent archetype name (MetaDeck.name)
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
export interface MetaWindow { days: number; since: string; tournaments: number; players: number; matches: number }
export interface MetaFile {
  generatedAt: string
  source: 'Limitless'
  version?: number
  windows: Record<WindowKey, MetaWindow>
  decks: MetaDeck[]
}
export interface TournamentData { tournament: LlTournament; standings: LlStanding[]; pairings?: LlPairing[] | null }
export interface CardRef { id: string; nameEn?: string; name: string }

const DAY = 86400000

// ---------- Score (fitted on the PocketMads snapshot of 2026-11-04, see docs/meta.md) ----------

export const POS_MIN_SHARE = 0.03 // opponents counted by Positioning
export const MIN_GAMES = 100 // numbered tiers
export const SLEEPER_MIN_SCORE = 55
export const SLEEPER_MIN_WINS = 10
export const SCORE_PARAMS = {
  base: 40, // score of an average deck with no popularity
  popPerPt: 1.5, popCapPct: 10, // +1.5 per share point, share capped at 10 %
  perfPerPt: 1.7, perfPrior: 2, // per point of shrunk win rate above 50 %; prior = 2 virtual 50 % matches
  posPerPt: 1.4, posPrior: 25, // same for the win rate against >= 3 % decks, 25 virtual matches
}
export const TIER_MIN = { t0: 80, t0Gap: 8, t1: 67, t2: 50 }
export const MATCHUP_TOP = 20 // opponents listed per deck

/** Win rate pulled towards 50 % by `prior` virtual draws-like matches (Bayesian shrinkage). */
export const shrunkRate = (wins: number, games: number, prior: number) => (wins + prior / 2) / (games + prior)

export function deckScore(p: { share: number; wins: number; games: number; posWins: number; posGames: number }): number {
  const c = SCORE_PARAMS
  const pop = Math.min(p.share * 100, c.popCapPct)
  const perf = (shrunkRate(p.wins, p.games, c.perfPrior) - 0.5) * 100
  const pos = (shrunkRate(p.posWins, p.posGames, c.posPrior) - 0.5) * 100
  return Math.min(100, Math.max(0, c.base + c.popPerPt * pop + c.perfPerPt * perf + c.posPerPt * pos))
}

/** Tier of a deck given its score and decided matches; `topGap` = score lead over the best other deck (Tier 0 needs a clear lead). */
export function tierOf(score: number, games: number, wins: number, gap = Infinity): Tier | null {
  if (games >= MIN_GAMES) {
    if (score >= TIER_MIN.t0 && gap >= TIER_MIN.t0Gap) return 0
    if (score >= TIER_MIN.t1) return 1
    if (score >= TIER_MIN.t2) return 2
    return 3
  }
  return score >= SLEEPER_MIN_SCORE && wins >= SLEEPER_MIN_WINS ? 'S' : null
}

// ---------- Window statistics ----------

const usable = (s: LlStanding) => !!s.deck?.id && s.deck.id !== 'other'
const archetype = (s: LlStanding) => s.deck!.name || s.deck!.id!
const userOf = (s: LlStanding) => (s.player ?? s.name ?? '').toLowerCase()

interface Acc { entries: number; wins: number; games: number }
export interface WindowResult { window: MetaWindow; stats: Map<string, DeckStats>; popular: string[] } // keyed by archetype name

export function windowStats(data: TournamentData[], now: number, days: number): WindowResult {
  const since = now - days * DAY
  const inWin = data.filter((d) => { const t = Date.parse(d.tournament.date); return t >= since && t <= now })
  const acc = new Map<string, Acc>()
  const vs = new Map<string, Map<string, [number, number]>>() // deck -> opponent -> [wins, decided]
  let total = 0, matches = 0
  for (const { standings, pairings } of inWin) {
    const deckOf = new Map<string, string>()
    for (const s of standings) {
      if (!usable(s)) continue
      const k = archetype(s)
      total++
      deckOf.set(userOf(s), k)
      acc.set(k, acc.get(k) ?? { entries: 0, wins: 0, games: 0 })
      acc.get(k)!.entries++
    }
    for (const m of pairings ?? []) {
      // Valid decided matches only: two known decks, different archetypes, one winner (no bye, tie, double loss, unknown opponent).
      if (!m.player1 || !m.player2 || typeof m.winner !== 'string') continue
      const a = deckOf.get(m.player1.toLowerCase()), b = deckOf.get(m.player2.toLowerCase())
      if (!a || !b || a === b) continue
      const w = m.winner.toLowerCase()
      const winner = w === m.player1.toLowerCase() ? a : w === m.player2.toLowerCase() ? b : null
      if (!winner) continue
      const loser = winner === a ? b : a
      const x = acc.get(winner)!, y = acc.get(loser)!
      x.wins++; x.games++; y.games++
      const bump = (me: string, op: string, won: boolean) => {
        const row = vs.get(me) ?? new Map<string, [number, number]>()
        const c = row.get(op) ?? [0, 0]
        if (won) c[0]++
        c[1]++
        row.set(op, c); vs.set(me, row)
      }
      bump(winner, loser, true); bump(loser, winner, false)
      matches++
    }
  }
  const big = new Set([...acc].filter(([, a]) => total && a.entries / total >= POS_MIN_SHARE).map(([k]) => k))
  const popular = [...acc].sort((x, y) => y[1].entries - x[1].entries || x[0].localeCompare(y[0])).map(([k]) => k).slice(0, MATCHUP_TOP + 1)
  const stats = new Map<string, DeckStats>()
  for (const [k, a] of acc) {
    let pw = 0, pn = 0
    for (const [op, [w, n]] of vs.get(k) ?? []) if (big.has(op)) { pw += w; pn += n }
    const share = total ? a.entries / total : 0
    const score = deckScore({ share, wins: a.wins, games: a.games, posWins: pw, posGames: pn })
    stats.set(k, {
      share, players: a.entries, wins: a.wins, losses: a.games - a.wins, games: a.games,
      winRate: a.games ? a.wins / a.games : 0, posGames: pn, posWinRate: pn ? pw / pn : 0, score, tier: null,
      matchups: popular.filter((op) => op !== k).slice(0, MATCHUP_TOP).map((op) => { const c = vs.get(k)?.get(op) ?? [0, 0]; return { op, wins: c[0], games: c[1] } }),
    })
  }
  // Tiers (Tier 0 needs a clear lead over the next deck among numbered-tier candidates).
  const ranked = [...stats.values()].filter((s) => s.games >= MIN_GAMES).sort((x, y) => y.score - x.score)
  for (const s of stats.values()) {
    const other = ranked.find((r) => r !== s)
    s.tier = tierOf(s.score, s.games, s.wins, other ? s.score - other.score : Infinity)
  }
  return { window: { days, since: new Date(since).toISOString(), tournaments: inWin.length, players: total, matches }, stats, popular }
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

export function computeMeta(data: TournamentData[], cards: CardRef[], now: number, prev?: MetaFile | null): MetaFile {
  const fr = frenchNames(cards)
  const windows = {} as Record<WindowKey, MetaWindow>
  const perWin = {} as Record<WindowKey, Map<string, DeckStats>>
  const popular = new Set<string>() // matchup opponents: listed as decks too, for their names and icons
  for (const k of Object.keys(WINDOWS) as WindowKey[]) {
    const r = windowStats(data, now, WINDOWS[k])
    windows[k] = r.window
    perWin[k] = r.stats
    for (const n of r.popular) popular.add(n)
  }
  const widest = now - WINDOWS['14d'] * DAY
  const pool = data.filter((d) => Date.parse(d.tournament.date) >= widest).flatMap((d) => d.standings.filter(usable))
  const names = new Set<string>()
  for (const m of Object.values(perWin)) for (const [k, s] of m) if (s.tier !== null) names.add(k)
  for (const n of popular) names.add(n)

  const prevScore = new Map<string, number>() // previous file: archetype name -> score per window
  for (const d of prev?.decks ?? []) for (const w of Object.keys(WINDOWS) as WindowKey[]) { const s = d.stats[w]; if (s) prevScore.set(w + '|' + d.name, s.score) }

  const decks: MetaDeck[] = []
  for (const name of names) {
    const mine = pool.filter((s) => archetype(s) === name)
    const c = consensusList(mine)
    const counts = new Map<string, number>()
    for (const s of mine) counts.set(s.deck!.id!, (counts.get(s.deck!.id!) ?? 0) + 1)
    const id = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0] // most played variant
    const known = new Set([...c.names.values()].map(norm))
    const { nameFr, segments } = deckNameFr(name, known, fr)
    const iconCardIds = segments
      .map((s) => c.pokemonIds.get(norm(s)))
      .filter((x): x is string => !!x)
      .filter((x, i, a) => a.indexOf(x) === i)
      .slice(0, 3)
    const stats: Partial<Record<WindowKey, DeckStats>> = {}
    for (const k of Object.keys(WINDOWS) as WindowKey[]) {
      const s = perWin[k].get(name)
      if (!s) continue
      const p = prevScore.get(k + '|' + name)
      stats[k] = p === undefined ? s : { ...s, delta: Math.round((s.score - p) * 10) / 10 }
    }
    decks.push({
      id, name, nameFr,
      icons: mine.find((s) => s.deck!.id === id)?.deck?.icons ?? [],
      iconCardIds: iconCardIds.length ? iconCardIds : c.consensus.filter((x) => c.pokemonIds.has(norm(c.names.get(x.cardId) ?? ''))).slice(0, 2).map((x) => x.cardId),
      lists: c.lists,
      consensus: c.consensus,
      flex: c.flex,
      stats,
    })
  }
  const ref: WindowKey = '7d'
  decks.sort((a, b) => (b.stats[ref]?.score ?? -1) - (a.stats[ref]?.score ?? -1) || (b.stats['14d']?.score ?? -1) - (a.stats['14d']?.score ?? -1))
  return { generatedAt: new Date(now).toISOString(), source: 'Limitless', version: 2, windows, decks }
}

const CUSTOM_NAME = /\b(custom|banned?|no[- ]ex)\b/i

/** Tournaments worth fetching: standard format (no CUSTOM, no "custom/banned" in the name), finished (started long enough ago). No minimum field size. */
export function selectTournaments(list: LlTournament[], now: number, opts: { days?: number; minAgeHours?: number; cap?: number } = {}): LlTournament[] {
  const { days = 14, minAgeHours = 8, cap = 200 } = opts
  return list
    .filter((t) => { const d = Date.parse(t.date); return d >= now - days * DAY && d <= now - minAgeHours * 3600000 })
    .filter((t) => !/^custom$/i.test(t.format ?? '') && !CUSTOM_NAME.test(t.name ?? ''))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, cap)
}

/** Details check after selection: a tournament with banned cards or a non-standard format plays custom rules. */
export const isStandardRules = (d: LlDetails | null | undefined): boolean =>
  !d || (!/^custom$/i.test(d.format ?? '') && !(d.bannedCards && d.bannedCards.length))
