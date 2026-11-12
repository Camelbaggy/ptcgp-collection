import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon, type IconName } from '../../components/Icon'
import { statusLabel, useSyncState } from './useSync'
import './sync.css'

const ICON: Record<string, IconName> = { idle: 'cloud', syncing: 'sync', offline: 'cloudoff', error: 'alert', reauth: 'alert' }

/**
 * Petite icône d'état de la synchro ; masquée si la synchro n'est pas activée.
 * `inline` : placée dans l'en-tête de l'accueil, à côté de la puce de profil.
 * Sinon, flottante en haut à droite des autres écrans (absente de l'accueil, qui a la sienne).
 */
export default function SyncStatusIcon({ inline = false }: { inline?: boolean }) {
  const s = useSyncState()
  const { pathname } = useLocation()
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t) }, [])
  if (!s.enabled || (!inline && pathname === '/')) return null
  return (
    <Link to="/reglages?ouvrir=sync" className={`sync-ico sync-${s.phase}${inline ? ' sync-inline' : ' sync-float'}`} title={statusLabel(s)} aria-label={statusLabel(s)}>
      <span aria-hidden><Icon name={ICON[s.phase] ?? 'cloud'} /></span>
    </Link>
  )
}
