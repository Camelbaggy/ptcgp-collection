import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { isNative } from '../../lib/native/holoNative'
import { pzSyncSupported } from '../../lib/pzSync/host'
import { cancelPmSync, startPmSync, usePmSync } from '../../lib/pocketMads/auto'
import { PM_TIER_URL } from '../../lib/pocketMads/sync'

/**
 * Lecture de la tier list PocketMads : depuis l'appli Android, une fenêtre cachée ouvre la page et
 * la lit (bouton, et automatiquement à l'ouverture au plus toutes les 6 h) ; ailleurs, le favori
 * Holothèque (le même que pour Pokémon-Zone) se lance sur la page.
 */
export function PmSync({ has }: { has: boolean }) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const st = usePmSync()
  useEffect(() => { if (isNative) void pzSyncSupported().then(setSupported) }, [])

  if (isNative) {
    return (
      <div className="card pms">
        {supported === false ? (
          <p className="muted small">Cette version de l'appli ne sait pas encore lire PocketMads : installe la dernière version.</p>
        ) : (
          <>
            <button className="btn primary" disabled={st.running || supported === null} onClick={() => void startPmSync(false)}>
              <Icon name="sync" />{has ? 'Actualiser la tier list' : 'Lire la tier list PocketMads'}
            </button>
            {st.running && <p className="small"><Icon name="sync" />{st.auto ? 'Actualisation automatique · ' : ''}{st.label} <button className="btn ghost small" onClick={cancelPmSync}>Annuler</button></p>}
            {st.error && <p className="vimp-error"><Icon name="warn" />{st.error}</p>}
            {!st.running && !st.error && <p className="muted small">Actualisée toute seule à l'ouverture de l'appli, au plus toutes les 6 h.</p>}
          </>
        )}
      </div>
    )
  }
  return (
    <details className="card pms" open={!has}>
      <summary><Icon name="sync" />{has ? 'Actualiser la tier list' : 'Lire la tier list PocketMads'}</summary>
      <ol className="small">
        <li>Ouvre la tier list PocketMads (bouton ci-dessous).</li>
        <li>Lance ton favori « Holothèque » (le même que pour Pokémon-Zone). Il ouvre Tier 3 et Sleepers, lit tout et revient ici.</li>
      </ol>
      <div className="pms-btns">
        <a className="btn primary" href={PM_TIER_URL} target="_blank" rel="noopener"><Icon name="ext" />Ouvrir PocketMads</a>
        <a className="btn" href="#/ajout?onglet=pz"><Icon name="help" />Créer le favori</a>
      </div>
      <p className="muted small">Sur l'appli Android, un bouton fait tout seul cette lecture.</p>
    </details>
  )
}
