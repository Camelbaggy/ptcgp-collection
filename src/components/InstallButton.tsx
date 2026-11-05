import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { canInstall, isInstalled, isIos, onInstallChange, promptInstall } from '../lib/install'

const subscribe = (cb: () => void) => onInstallChange(cb)
const snap = () => (canInstall() ? 1 : 0) + (isInstalled() ? 2 : 0)

/** Bouton « Installer l'appli » : invite native si disponible, lien vers l'aide sur iPhone, sinon rien. */
export function InstallButton({ className = 'btn' }: { className?: string }) {
  const s = useSyncExternalStore(subscribe, snap, () => 0)
  if (s & 2) return null
  if (s & 1) {
    return <button type="button" className={className} onClick={() => { void promptInstall() }}><Icon name="download" />Installer l'appli</button>
  }
  if (isIos()) return <Link to="/aide" className={className}><Icon name="download" />Installer l'appli</Link>
  return null
}
