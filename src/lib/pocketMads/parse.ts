import { tierKey } from './match'
import type { PmDeck, PmRaw, PmTierList } from './types'

const num = (s: string | undefined): number | undefined => {
  if (!s) return undefined
  const m = s.replace(/\s/g, '').replace(',', '.').match(/[-+−]?\d+(?:\.\d+)?/)
  return m ? Number(m[0].replace('−', '-')) : undefined
}
const pct = (s: string | undefined) => { const n = num(s); return n === undefined ? undefined : n / 100 }
const stat = (st: Record<string, string>, ...keys: string[]) => {
  for (const k of Object.keys(st)) if (keys.some((x) => k.toLowerCase().includes(x))) return st[k]
  return undefined
}

/** Interprète le relevé brut de la page ; lève une erreur si aucun deck n'a été trouvé. */
export function parsePmRaw(raw: PmRaw, fetchedAt = new Date().toISOString()): PmTierList {
  if (!raw || !Array.isArray(raw.tiers)) throw new Error('Tier list PocketMads illisible.')
  let range: string | undefined
  const tiers = raw.tiers.map((t) => ({
    label: t.label,
    key: tierKey(t.label),
    decks: (t.decks ?? []).filter((d) => d.name).map((d): PmDeck => {
      let id: string | undefined
      try {
        const u = new URL(d.href, 'https://app.pocketmads.com/')
        id = u.pathname.match(/\/meta-game\/([^/]+)/)?.[1]
        range ??= u.searchParams.get('range') ?? undefined
      } catch { /* lien illisible */ }
      const st = d.stats ?? {}
      const games = num(stat(st, 'game', 'match'))
      // la variation peut porter un signe ▼ (baisse) sans « - »
      let delta = num(d.delta)
      if (delta !== undefined && /▼/.test(d.delta ?? '') && delta > 0) delta = -delta
      if (/stable/i.test(d.delta ?? '')) delta = 0
      return {
        name: d.name.trim(),
        id: id ? decodeURIComponent(id) : undefined,
        score: num(stat(st, 'score')),
        winRate: pct(stat(st, 'win')),
        games: games === undefined ? undefined : Math.round(games),
        share: pct(stat(st, 'share')),
        delta,
        shift: !!d.shift,
      }
    }),
  }))
  const n = tiers.reduce((a, t) => a + t.decks.length, 0)
  if (!n) throw new Error('Aucun deck trouvé dans la tier list PocketMads.')
  return { fetchedAt, updated: raw.updated || undefined, range, tiers }
}
