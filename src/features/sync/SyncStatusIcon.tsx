import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../../components/Icon'
import { statusLabel, useSyncState } from './useSync'
import './sync.css'

const ICON: Record<string, IconName> = { idle: 'cloud', syncing: 'sync', offline: 'cloudoff', error: 'alert', reauth: 'alert' }

/**
 * Petite icône d'état de la synchro, masquée si la synchro n'est pas activée.
 * Toujours dans un en-tête : rendue par `PageHeader` (à droite des actions) et, sur l'accueil,
 * à côté de la puce de profil. Plus jamais flottante (elle recouvrait les boutons d'en-tête).
 */
export default function SyncStatusIcon() {
  const s = useSyncState()
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t) }, [])
  if (!s.enabled) return null
  return (
    <Link to="/reglages?ouvrir=sync" className={`sync-ico sync-${s.phase}`} title={statusLabel(s)} aria-label={statusLabel(s)}>
      <span aria-hidden><Icon name={ICON[s.phase] ?? 'cloud'} /></span>
    </Link>
  )
}
