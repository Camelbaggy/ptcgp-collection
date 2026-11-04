import { isConfigured } from '../../lib/sync/gis'
import { connect, disconnect, syncNow } from '../../lib/sync/engine'
import { statusLabel, useSyncState } from './useSync'
import './sync.css'

/** Panneau « Synchronisation Google Drive » pour les Réglages. */
export default function SyncPanel() {
  const s = useSyncState()
  const busy = s.phase === 'syncing'
  return (
    <section className="sync-panel">
      <h3>Synchronisation Google Drive</h3>
      {!isConfigured() ? (
        <p className="muted">La synchro n'est pas configurée sur ce site (identifiant Google manquant).</p>
      ) : (
        <>
          <p className="sync-status" role="status">{statusLabel(s)}</p>
          {s.enabled && s.email && <p className="muted">Compte : {s.email}</p>}
          {s.enabled && s.phase === 'error' && s.error && <p className="sync-err">{s.error}</p>}
          <p className="muted">
            Vos données sont stockées dans un dossier privé de votre propre Drive, visible par cette application uniquement.
          </p>
          <div className="sync-row">
            {!s.enabled ? (
              <button className="btn primary" disabled={busy} onClick={() => void connect()}>Se connecter à Google Drive</button>
            ) : (
              <>
                {s.phase === 'reauth'
                  ? <button className="btn primary" onClick={() => void connect()}>Se reconnecter</button>
                  : <button className="btn" disabled={busy} onClick={() => void syncNow({ interactive: true })}>Synchroniser maintenant</button>}
                <button className="btn" onClick={() => disconnect()}>Se déconnecter</button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
