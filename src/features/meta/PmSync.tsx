import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { isNative } from '../../lib/native/holoNative'
import { nativePzHost, pzSyncSupported } from '../../lib/pzSync/host'
import { PzCancelled } from '../../lib/pzSync/run'
import { savePmTierList } from '../../lib/pocketMads/store'
import { PM_TIER_URL, runPmSync } from '../../lib/pocketMads/sync'

/**
 * Lecture de la tier list PocketMads : depuis l'appli Android, une fenêtre cachée ouvre la page et
 * la lit ; ailleurs, le favori Holothèque (le même que pour Pokémon-Zone) se lance sur la page.
 */
export function PmSync({ has }: { has: boolean }) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [state, setState] = useState<{ run: boolean; label: string; error: string }>({ run: false, label: '', error: '' })
  const cancel = useRef<(() => void) | null>(null)
  useEffect(() => { if (isNative) void pzSyncSupported().then(setSupported) }, [])

  const go = async () => {
    const host = nativePzHost()
    const handlers = new Set<(a: 'continue' | 'cancel') => void>()
    cancel.current = () => handlers.forEach((h) => h('cancel'))
    setState({ run: true, label: 'Ouverture de PocketMads…', error: '' })
    try {
      const t = await runPmSync({ ...host, onUi(cb) { handlers.add(cb); const off = host.onUi(cb); return () => { handlers.delete(cb); off() } } }, {
        onProgress: (label) => setState((s) => ({ ...s, label })),
      })
      await savePmTierList(t)
      setState({ run: false, label: '', error: '' })
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      setState({
        run: false, label: '',
        error: e instanceof PzCancelled ? '' : /non autoris/i.test(m) ? 'Cette version de l\'appli ne sait pas encore ouvrir PocketMads : installe la dernière version.' : m,
      })
    } finally {
      cancel.current = null
    }
  }

  if (isNative) {
    return (
      <div className="card pms">
        {supported === false ? (
          <p className="muted small">Cette version de l'appli ne sait pas encore lire PocketMads : installe la dernière version.</p>
        ) : (
          <>
            <button className="btn primary" disabled={state.run || supported === null} onClick={() => void go()}>
              <Icon name="sync" />{has ? 'Actualiser la tier list' : 'Lire la tier list PocketMads'}
            </button>
            {state.run && <p className="small"><Icon name="sync" />{state.label} <button className="btn ghost small" onClick={() => cancel.current?.()}>Annuler</button></p>}
            {state.error && <p className="vimp-error"><Icon name="warn" />{state.error}</p>}
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
