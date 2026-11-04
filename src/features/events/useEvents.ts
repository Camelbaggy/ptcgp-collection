import { useEffect, useState } from 'react'
import { BASE } from '../../lib/db'
import type { GameEvent } from '../../lib/events/parse'

/** Charge public/data/events.json (généré au déploiement, précaché par la PWA). `null` = indisponible. */
export function useEvents(): { events: GameEvent[] | null; loading: boolean } {
  const [events, setEvents] = useState<GameEvent[] | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let off = false
    ;(async () => {
      try {
        const r = await fetch(`${BASE}data/events.json`)
        const t = r.ok ? await r.text() : ''
        const j = t.trim().startsWith('[') ? (JSON.parse(t) as GameEvent[]) : null
        if (!off) setEvents(j)
      } catch { if (!off) setEvents(null) }
      if (!off) setLoading(false)
    })()
    return () => { off = true }
  }, [])
  return { events, loading }
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
