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

/** Logo d'extension de largeur fixe (alignement en colonne) ; sans fichier, repli sur le texte. */
export function SetBadge({ setId, name, text, className }: { setId: string; name?: string; text?: React.ReactNode; className?: string }) {
  const label = text ?? setId
  return (
    <span className={'set-badge' + (className ? ' ' + className : '')}>
      <SetLogo setId={setId} name={name} small fallback={<span className="set-badge-txt">{label}</span>} />
    </span>
  )
}

/**
 * Booster = logo de l'extension + emblème + texte (ex. « C1 · Mewtwo »).
 * `text` remplace le libellé ; `logo={false}` masque le logo (quand l'extension est déjà affichée à côté).
 */
export function BoosterBadge({ boosterId, setId, name, text, logo = true, stacked, estimated, children }: {
  boosterId: string; setId?: string; name?: string; text?: React.ReactNode; logo?: boolean; stacked?: boolean; estimated?: boolean; children?: React.ReactNode
}) {
  const sid = setId ?? boosterId.split('-')[0]
  const label = text ?? (name ? `${sid} · ${name}` : boosterId)
  return (
    <span className={'booster-badge' + (stacked ? ' stacked' : '')}>
      {logo && <SetBadge setId={sid} text={sid} />}
      <span className="with-icon"><BoosterEmblem boosterId={boosterId} small /><span className="bb-txt">{label}</span></span>
      {estimated && <span className="est-tag" title="Taux estimés — à vérifier">taux estimés</span>}
      {children}
    </span>
  )
}
