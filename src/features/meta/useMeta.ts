import { useEffect, useState } from 'react'
import { BASE } from '../../lib/db'
import { ASSET_BASE } from '../../lib/native/platform'
import type { MetaFile, Tier, WindowKey } from '../../lib/meta/compute'

export const WINDOW_LABEL: Record<WindowKey, string> = { '3d': '3 j', '7d': '7 j', '14d': '14 j' }
export const TIERS: Tier[] = [0, 1, 2, 3, 'S']
export const TIER_LABEL: Record<string, string> = { '0': 'Tier 0', '1': 'Tier 1', '2': 'Tier 2', '3': 'Tier 3', S: 'Sleepers' }
export const TIER_SUB: Record<string, string> = { '0': 'Incontournable', '1': 'Meilleurs choix', '2': 'Choix solides', '3': 'Decks établis', S: 'Prometteurs, peu joués' }

let cache: Promise<MetaFile | null> | null = null
const get = (url: string, ms: number): Promise<MetaFile | null> => {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  return fetch(url, { signal: ctl.signal, cache: 'no-cache' })
    .then(async (r) => {
      const x = r.ok ? await r.text() : ''
      return x.trim().startsWith('{') ? (JSON.parse(x) as MetaFile) : null
    })
    .catch(() => null)
    .finally(() => clearTimeout(t))
}
function load(): Promise<MetaFile | null> {
  // D'abord le site publié (données Limitless actualisées plusieurs fois par jour, sans mise à jour
  // de l'appli ; sur le web le service worker le sert « réseau d'abord »), sinon la copie locale.
  cache ??= get(`${ASSET_BASE}data/meta.json`, 10_000)
    .then((m) => m ?? get(`${BASE}data/meta.json`, 15_000))
  return cache
}

/** meta.json : version publiée la plus récente, ou copie livrée avec l'app hors connexion. */
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
