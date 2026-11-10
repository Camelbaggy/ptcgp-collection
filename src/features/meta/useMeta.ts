import { useEffect, useState } from 'react'
import { BASE } from '../../lib/db'
import type { MetaFile, Tier, WindowKey } from '../../lib/meta/compute'

export const WINDOW_LABEL: Record<WindowKey, string> = { '3d': '3 j', '7d': '7 j', '14d': '14 j' }
export const TIERS: Tier[] = [0, 1, 2, 3, 'S']
export const TIER_LABEL: Record<string, string> = { '0': 'Tier 0', '1': 'Tier 1', '2': 'Tier 2', '3': 'Tier 3', S: 'Sleepers' }
export const TIER_SUB: Record<string, string> = { '0': 'Incontournable', '1': 'Meilleurs choix', '2': 'Choix solides', '3': 'Decks établis', S: 'Prometteurs, peu joués' }

let cache: Promise<MetaFile | null> | null = null
function load(): Promise<MetaFile | null> {
  cache ??= fetch(`${BASE}data/meta.json`)
    .then(async (r) => {
      const t = r.ok ? await r.text() : ''
      return t.trim().startsWith('{') ? (JSON.parse(t) as MetaFile) : null
    })
    .catch(() => null)
  return cache
}

/** meta.json (livré avec l'app, donc disponible hors connexion : dernières données précachées). */
export function useMeta(): { meta: MetaFile | null; loading: boolean } {
  const [s, setS] = useState<{ meta: MetaFile | null; loading: boolean }>({ meta: null, loading: true })
  useEffect(() => {
    let off = false
    load().then((meta) => { if (!off) setS({ meta, loading: false }) })
    return () => { off = true }
  }, [])
  return s
}

export const score1 = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
export const delta1 = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
export const pct1 = (x: number) => (x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' %'
export const dateTimeFr = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export const limitlessUrl = (id: string) => `https://play.limitlesstcg.com/decks/${id}?game=POCKET`
export const pocketMadsUrl = (id: string, w: WindowKey) => `https://app.pocketmads.com/meta-game/${id}?range=${w}`
