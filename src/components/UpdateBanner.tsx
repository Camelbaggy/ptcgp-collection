import { useEffect, useState } from 'react'
import { getUpdateState, onUpdateState, reloadToUpdate } from '../lib/pwaUpdate'

/** Bottom banner telling the user a new version is being downloaded / is ready. */
export function UpdateBanner() {
  const [state, setState] = useState(getUpdateState())
  const [hidden, setHidden] = useState(false)
  useEffect(() => onUpdateState((s) => { setState(s); setHidden(false) }), [])
  if (state === 'idle' || hidden) return null
  return (
    <div className="update-banner" role="status">
      {state === 'downloading' ? (
        <span>Téléchargement d’une nouvelle version…</span>
      ) : (
        <>
          <span>Nouvelle version disponible</span>
          <button className="btn small primary" onClick={reloadToUpdate}>Recharger</button>
          <button className="btn small ghost" aria-label="Plus tard" onClick={() => setHidden(true)}>✕</button>
        </>
      )}
    </div>
  )
}
