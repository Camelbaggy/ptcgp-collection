import { useState } from 'react'
import { emblemUrl, logoUrl } from '../lib/assets'

// URLs that failed once (file not fetched yet): do not retry for every tile during the session.
const broken = new Set<string>()

/** Logo d'extension ; sans fichier, affiche `fallback` (texte) ou rien. */
export function SetLogo({ setId, name, small, fallback }: { setId: string; name?: string; small?: boolean; fallback?: React.ReactNode }) {
  const url = logoUrl(setId)
  const [, rerender] = useState(0)
  if (broken.has(url)) return <>{fallback ?? null}</>
  return (
    <img className={'set-logo' + (small ? ' sm' : '')} src={url} alt={name ?? setId} loading="lazy" decoding="async"
      onError={() => { broken.add(url); rerender((n) => n + 1) }} />
  )
}

/** Emblème de booster (icône) ; sans fichier, n'affiche rien (le texte reste à côté). */
export function BoosterEmblem({ boosterId, small }: { boosterId: string; small?: boolean }) {
  const url = emblemUrl(boosterId)
  const [, rerender] = useState(0)
  if (broken.has(url)) return null
  return (
    <img className={'emblem' + (small ? ' sm' : '')} src={url} alt="" aria-hidden="true" loading="lazy" decoding="async"
      onError={() => { broken.add(url); rerender((n) => n + 1) }} />
  )
}
