import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { isNative } from '../../lib/native/holoNative'
import { pzSyncSupported } from '../../lib/pzSync/host'
import { cancelPzSync, startPzSync, usePzSync } from '../../lib/pzSync/store'
import type { PzSyncMode } from '../../lib/pzSync/run'

/**
 * Synchro Pokémon-Zone intégrée (appli Android) : une fenêtre Pokémon-Zone s'ouvre, l'utilisateur
 * règle une éventuelle vérification ou connexion, puis tout continue hors de vue pendant que la
 * barre de progression reste affichée. Sur le web, ce panneau n'apparaît pas (voir le favori).
 */
export default function PzSyncPanel({ player, knownSets }: { player: string; knownSets: string[] }) {
  const s = usePzSync()
  const [supported, setSupported] = useState<boolean | null>(null)
  useEffect(() => { if (isNative) void pzSyncSupported().then(setSupported) }, [])
  if (!isNative) return null
  const running = s.status === 'running'
  const go = (mode: PzSyncMode) => void startPzSync(player, mode, knownSets)
  return (
    <div className="pzy">
      <h4><Icon name="sync" />Synchroniser depuis l'appli</h4>
      {supported === false ? (
        <p className="muted small">Cette version de l'appli ne sait pas encore ouvrir Pokémon-Zone. Installe la dernière version, ou utilise le favori ci-dessous.</p>
      ) : (
        <>
          <p className="small">Une fenêtre Pokémon-Zone s'ouvre sur ton profil. S'il y a une vérification de sécurité ou une connexion, fais-la : la synchro démarre ensuite toute seule, en arrière-plan.</p>
          <div className="pzy-btns">
            <button className="btn primary" disabled={running || supported === null} onClick={() => go('all')}>
              <Icon name="sync" />Tout synchroniser
            </button>
            <button className="btn" disabled={running || supported === null} onClick={() => go('quick')}>
              <Icon name="bolt" />Mise à jour rapide
            </button>
          </div>
          <p className="muted small">« Tout » : toutes les extensions, l'accueil, les stats, les collections à thème et les souhaits (quelques minutes, pour la première fois ou après une nouvelle extension). « Rapide » : accueil et souhaits.</p>
          {running && (
            <p className="small"><Icon name="sync" />{s.label}{' '}<button className="btn ghost small" onClick={cancelPzSync}>Annuler</button></p>
          )}
          {s.status === 'error' && <p className="vimp-error"><Icon name="warn" />{s.error}</p>}
        </>
      )}
    </div>
  )
}
