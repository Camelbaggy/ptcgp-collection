import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { checkForUpdate, getUpdateState, onUpdateState, reloadToUpdate, type CheckResult, type UpdateState } from '../../lib/pwaUpdate'

const MESSAGES: Record<Exclude<CheckResult, 'found'>, string> = {
  uptodate: 'Tu as déjà la dernière version.',
  offline: 'Pas de connexion internet : impossible de vérifier pour l’instant.',
  unsupported: 'Ce navigateur ne permet pas la mise à jour automatique. Recharge la page pour obtenir la dernière version.',
  error: 'La vérification a échoué. Réessaie dans un instant.',
}

/** "Rechercher une mise à jour" button with visible feedback: spinner, then up to date / downloading / reload. */
export default function UpdateCheck() {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [sw, setSw] = useState<UpdateState>(getUpdateState())
  useEffect(() => onUpdateState(setSw), [])

  const run = async () => {
    setChecking(true)
    setResult(null)
    setResult(await checkForUpdate())
    setChecking(false)
  }

  if (sw === 'ready') {
    return (
      <div className="update-check">
        <p className="update-msg ok"><Icon name="sparkle" />Nouvelle version disponible.</p>
        <button className="btn primary" onClick={reloadToUpdate}><Icon name="sync" />Recharger maintenant</button>
      </div>
    )
  }
  const downloading = sw === 'downloading'
  return (
    <div className="update-check">
      <button className="btn" onClick={() => { void run() }} disabled={checking || downloading} aria-busy={checking || downloading}>
        <span className={checking || downloading ? 'spin' : undefined}><Icon name="sync" /></span>
        {checking ? 'Recherche en cours…' : downloading ? 'Téléchargement…' : 'Rechercher une mise à jour'}
      </button>
      <p className="update-msg" role="status" aria-live="polite">
        {downloading ? 'Nouvelle version trouvée, téléchargement en cours…'
          : result && result !== 'found' ? MESSAGES[result] : null}
      </p>
    </div>
  )
}
