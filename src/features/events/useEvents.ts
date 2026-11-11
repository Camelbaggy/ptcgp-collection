import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BASE, db } from '../../lib/db'
import { releaseEvents, type GameEvent, type Release } from '../../lib/events/parse'
import { mergeRelated, type ImportedEvent } from '../../lib/events/pokemonZone'

const DAY = 86400000
/** Les évènements terminés depuis plus de 30 jours ne sont plus affichés (ils restent en base). */
export const PRUNE_DAYS = 30

/**
 * Évènements affichés : imports Pokémon-Zone (base locale) + dates de sortie des extensions (public/data/releases.json).
 * Une sortie de releases.json est ignorée si une extension importée sort à ±1 jour.
 */
export function mergeEvents(imported: ImportedEvent[], releases: GameEvent[], now: number): GameEvent[] {
  const cutoff = now - PRUNE_DAYS * DAY
  // Rows saved before parts were merged (shop / missions / gold offers) are merged here too.
  imported = mergeRelated(imported)
  const exp = imported.filter((e) => e.type === 'expansion')
  const rel = releases.filter((r) => !exp.some((e) => Math.abs(Date.parse(e.start) - Date.parse(r.start)) <= DAY))
  return [...imported, ...rel].filter((e) => Date.parse(e.end) >= cutoff)
}

export function useEvents(): { events: GameEvent[]; importedCount: number; loading: boolean } {
  const imported = useLiveQuery(() => db.importedEvents.toArray(), [])
  const [releases, setReleases] = useState<GameEvent[] | null>(null)
  useEffect(() => {
    let off = false
    ;(async () => {
      try {
        const r = await fetch(`${BASE}data/releases.json`)
        const t = r.ok ? await r.text() : ''
        const j = t.trim().startsWith('[') ? (JSON.parse(t) as Release[]) : []
        if (!off) setReleases(releaseEvents(j, new Date(Date.now() - PRUNE_DAYS * DAY)))
      } catch { if (!off) setReleases([]) }
    })()
    return () => { off = true }
  }, [])
  const [loadedAt] = useState(() => Date.now())
  const events = useMemo(
    () => (imported && releases ? mergeEvents(imported, releases, loadedAt) : []),
    [imported, releases, loadedAt],
  )
  return { events, importedCount: imported?.length ?? 0, loading: !imported || !releases }
}

/** Heure courante, rafraîchie chaque minute. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])
  return now
}
