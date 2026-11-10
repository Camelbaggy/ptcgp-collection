import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { cancelPzSync, dismissPzSync, usePzSync } from '../lib/pzSync/store'

/** Barre fixe de la synchro Pokémon-Zone (appli Android) : progression, résultat à vérifier, erreur. */
export function PzSyncBar() {
  const s = usePzSync()
  if (s.status === 'idle') return null
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0
  return (
    <div className="pzs-bar" role="status" aria-live="polite">
      <span className="tile-ic"><Icon name={s.status === 'error' ? 'warn' : s.status === 'done' ? 'check' : 'sync'} /></span>
      <div className="pzs-main">
        {s.status === 'running' && (
          <>
            <div className="pzs-label">Synchro Pokémon-Zone · {s.label}</div>
            <div className="pzs-track" aria-hidden><div className="pzs-fill" style={{ width: `${s.total ? Math.max(3, pct) : 3}%` }} /></div>
            <div className="pzs-sub">Laisse l'appli ouverte, l'écran reste allumé.</div>
          </>
        )}
        {s.status === 'done' && <div className="pzs-label">Synchro terminée : vérifie les changements.</div>}
        {s.status === 'error' && <div className="pzs-label">Synchro interrompue : {s.error}</div>}
      </div>
      {s.status === 'running' && <button className="btn small ghost" onClick={cancelPzSync}>Annuler</button>}
      {s.status === 'done' && <Link className="btn small primary" to="/ajout?onglet=pz">Voir</Link>}
      {s.status !== 'running' && <button className="btn small ghost" aria-label="Fermer" onClick={dismissPzSync}><Icon name="close" /></button>}
    </div>
  )
}
