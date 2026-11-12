import { Icon } from '../../components/Icon'
import { Fold } from '../../components/Fold'
import { isConfigured } from '../../lib/sync/gis'
import { connect, disconnect, syncNow } from '../../lib/sync/engine'
import { statusLabel, useSyncState } from './useSync'
import './sync.css'

/** Panneau « Synchronisation Google Drive » pour les Réglages. */
export default function SyncPanel() {
  const s = useSyncState()
  const busy = s.phase === 'syncing'
  return (
    <Fold id="sync" icon="cloud" color="var(--blue)" title="Synchronisation Google Drive" className="sync-panel"
      summary={isConfigured() ? <span role="status">{statusLabel(s)}</span> : 'Non configurée sur ce site'}>
      {!isConfigured() ? (
        <p className="muted">La synchro n'est pas configurée sur ce site (identifiant Google manquant).</p>
      ) : (
        <>
          {s.enabled && s.email && <p className="muted">Compte : {s.email}</p>}
          {s.enabled && s.phase === 'error' && s.error && <p className="sync-err">{s.error}</p>}
          <p className="muted">
            Tes données sont stockées dans un dossier privé de ton propre Drive, visible par cette application uniquement.
          </p>
          <div className="sync-row">
            {!s.enabled ? (
              <button className="btn primary" disabled={busy} onClick={() => void connect()}><Icon name="cloud" />Se connecter à Google Drive</button>
            ) : (
              <>
                {s.phase === 'reauth'
                  ? <button className="btn primary" onClick={() => void connect()}><Icon name="sync" />Se reconnecter</button>
                  : <button className="btn" disabled={busy} onClick={() => void syncNow({ interactive: true })}><Icon name="sync" />Synchroniser maintenant</button>}
                <button className="btn" onClick={() => disconnect()}><Icon name="cloudoff" />Se déconnecter</button>
              </>
            )}
          </div>
        </>
      )}
    </Fold>
  )
}
