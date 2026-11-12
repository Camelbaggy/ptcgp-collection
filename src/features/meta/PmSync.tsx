import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { isNative } from '../../lib/native/holoNative'
import { pzSyncSupported } from '../../lib/pzSync/host'
import { cancelPmSync, startPmSync, usePmSync } from '../../lib/pocketMads/auto'
import { PM_TIER_URL } from '../../lib/pocketMads/sync'

/** Vrai/faux quand on sait si l'appli Android sait lire PocketMads, null en attendant (ou sur le web). */
export function usePmSupported(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null)
  useEffect(() => { if (isNative) void pzSyncSupported().then(setSupported) }, [])
  return supported
}

/** Action de l'icône « actualiser » de l'en-tête : lecture directe (Android) ou feuille du favori (web). */
export function pmRefresh(supported: boolean | null, openWeb: () => void): () => void {
  if (!isNative) return openWeb
  return () => { if (supported) void startPmSync(false) }
}

/** Mode d'emploi de la lecture PocketMads hors appli (feuille d'aide). */
export const PM_WEB_HELP = [
  { title: 'Lire la tier list PocketMads', text: 'Ouvre la tier list PocketMads, puis lance ton favori « Holothèque » (le même que pour Pokémon-Zone). Il ouvre Tier 3 et Sleepers, lit tout et revient ici.' },
  { title: 'Sur l’appli Android', text: 'Un bouton fait tout seul cette lecture. Elle est aussi actualisée à l’ouverture de l’appli, au plus toutes les 6 h.' },
]

/**
 * Lecture de la tier list PocketMads : depuis l'appli Android, une fenêtre cachée ouvre la page et
 * la lit (icône de l'en-tête, et automatiquement à l'ouverture au plus toutes les 6 h) ; ailleurs, le favori
 * Holothèque (le même que pour Pokémon-Zone) se lance sur la page. Ici : seulement l'état de la lecture
 * en cours (Android) et la feuille du favori (web).
 */
export function PmSync({ supported, webOpen, onWebClose }: { supported: boolean | null; webOpen: boolean; onWebClose: () => void }) {
  const st = usePmSync()
  if (isNative) {
    return (
      <>
        {supported === false && <p className="card meta-msg">Cette version de l'appli ne sait pas encore lire PocketMads : installe la dernière version.</p>}
        {st.running && <p className="card meta-msg pms-run"><Icon name="sync" />{st.auto ? 'Actualisation automatique · ' : ''}{st.label} <button className="btn ghost small" onClick={cancelPmSync}>Annuler</button></p>}
        {st.error && <p className="card meta-msg vimp-error"><Icon name="warn" />{st.error}</p>}
      </>
    )
  }
  if (!webOpen) return null
  return (
    <Sheet title="Lire PocketMads" onClose={onWebClose}>
      <div className="pms-btns">
        <a className="btn primary" href={PM_TIER_URL} target="_blank" rel="noopener"><Icon name="ext" />Ouvrir PocketMads</a>
        <a className="btn" href="#/ajout?onglet=pz"><Icon name="help" />Créer le favori</a>
      </div>
    </Sheet>
  )
}
