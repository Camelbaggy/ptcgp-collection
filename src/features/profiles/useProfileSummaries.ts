import { useEffect, useState } from 'react'
import { profileSummary } from '../../lib/profileOps'
import type { Profile } from '../../lib/profiles'

/** Nombre de cartes possédées par profil (lu dans chaque base, sans changer de profil). */
export function useProfileSummaries(profiles: Profile[], refresh = 0): Map<string, number> {
  const [m, setM] = useState<Map<string, number>>(new Map())
  const ids = profiles.map((p) => p.id).join(',')
  useEffect(() => {
    const ctl = new AbortController()
    void Promise.all(ids.split(',').map(async (id) => [id, (await profileSummary(id).catch(() => ({ owned: 0 }))).owned] as const))
      .then((r) => { if (!ctl.signal.aborted) setM(new Map(r)) })
    return () => ctl.abort()
  }, [ids, refresh])
  return m
}

export const cardsLabel = (n: number | undefined) => n === undefined ? '…' : `${n.toLocaleString('fr-FR')} carte${n > 1 ? 's' : ''}`
