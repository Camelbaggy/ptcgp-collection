import { useEffect, useMemo, useState } from 'react'
import { BASE } from '../../lib/db'
import { ASSET_BASE } from '../../lib/native/platform'
import { useCards, useOwned } from '../../lib/useData'
import { buildDexRows, summarize } from '../../lib/pokedex/aggregate'
import type { DexEntry } from '../../lib/pokedex/types'

let cache: Promise<DexEntry[]> | null = null
function loadEntries(): Promise<DexEntry[]> {
  cache ??= fetch(`${BASE}data/pokedex.json`)
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() as Promise<DexEntry[]> })
    .catch((e) => { cache = null; throw e })
  return cache
}

// ?v=2 : sprites rognés de leurs marges transparentes (2026-11-12) ; le cache CacheFirst garderait sinon les anciens.
export const spriteUrl = (formId: number) => `${ASSET_BASE}sprites/${formId}.png?v=2`

export function usePokedex() {
  const [entries, setEntries] = useState<DexEntry[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { loadEntries().then(setEntries, (e) => setError(String(e?.message ?? e))) }, [])
  const cards = useCards()
  const owned = useOwned()
  const data = useMemo(() => {
    if (!entries) return null
    const { rows, unmatched } = buildDexRows(entries, cards, owned)
    return { rows, unmatched, summary: summarize(rows), gens: [...new Set(entries.map((e) => e.gen))].sort((a, b) => a - b) }
  }, [entries, cards, owned])
  return { data, error, owned, cards }
}
