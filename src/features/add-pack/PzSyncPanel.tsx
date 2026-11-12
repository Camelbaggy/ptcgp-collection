import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { SetLogo } from '../../components/Brand'
import { isNative } from '../../lib/native/holoNative'
import { pzSyncSupported } from '../../lib/pzSync/host'
import { cancelPzSync, startPzSync, usePzSync } from '../../lib/pzSync/store'
import { pzSetCode } from '../../lib/importers/pzCollection'
import { setLabel, usePersisted } from '../../lib/useData'
import type { CardSet } from '../../lib/types'
import { profilePrefName } from '../../lib/profiles'

/** L'appli Android sait-elle ouvrir Pokémon-Zone ? (null : on ne sait pas encore ; false sur le web) */
export function usePzSyncSupported(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(isNative ? null : false)
  useEffect(() => { if (isNative) void pzSyncSupported().then(setSupported) }, [])
  return supported
}

const knownCodes = (sets: CardSet[]) => sets.map((s) => pzSetCode(s.id))

function SyncStatus() {
  const s = usePzSync()
  return (
    <>
      {s.status === 'running' && (
        <p className="small"><Icon name="sync" />{s.label}{' '}<button className="btn ghost small" onClick={cancelPzSync}>Annuler</button></p>
      )}
      {s.status === 'error' && <p className="vimp-error"><Icon name="warn" />{s.error}</p>}
    </>
  )
}

const HOW = 'Une fenêtre Pokémon-Zone s\'ouvre sur ton profil. S\'il y a une vérification de sécurité ou une connexion, fais-la : la synchro continue ensuite toute seule, en arrière-plan.'

/** Synchro intégrée (appli Android) d'une seule extension : la page de cette extension seulement. */
export function PzSyncOne({ player, set, sets }: { player: string; set: CardSet; sets: CardSet[] }) {
  const s = usePzSync()
  const running = s.status === 'running'
  return (
    <div className="pzy">
      <p className="small">{HOW}</p>
      <div className="pzy-btns">
        <button className="btn primary" disabled={running} onClick={() => void startPzSync(player, 'sets', knownCodes(sets), { sets: [pzSetCode(set.id)] })}>
          <Icon name="sync" />Synchroniser {set.name}
        </button>
      </div>
      <SyncStatus />
    </div>
  )
}

/** Synchro intégrée (appli Android) de plusieurs extensions, à cocher, et des pages du profil. */
export function PzSyncMass({ player, sets, regular, special }: { player: string; sets: CardSet[]; regular: CardSet[]; special: CardSet[] }) {
  const s = usePzSync()
  const running = s.status === 'running'
  // on retient les extensions décochées : une nouvelle extension est cochée d'office
  const [off, setOff] = usePersisted<string[]>(profilePrefName('pz.massOff'), [])
  const [profile, setProfile] = usePersisted('pz.massProfile', true)
  const offSet = new Set(off)
  const all = [...[...regular].reverse(), ...special]
  const chosen = all.filter((x) => !offSet.has(x.id))
  const toggle = (id: string, on: boolean) => setOff(on ? off.filter((x) => x !== id) : [...off, id])
  const go = () => void startPzSync(player, 'sets', knownCodes(sets), { sets: chosen.map((x) => pzSetCode(x.id)), withProfile: profile })
  const n = chosen.length
  return (
    <div className="pzy">
      <p className="small">{HOW}</p>
      <div className="pzm-tools row">
        <span className="grow small"><b>{n}</b> extension{n > 1 ? 's' : ''} sur {all.length}</span>
        <button className="btn ghost small" disabled={running || n === all.length} onClick={() => setOff([])}><Icon name="check" />Tout cocher</button>
        <button className="btn ghost small" disabled={running || n === 0} onClick={() => setOff(all.map((x) => x.id))}><Icon name="close" />Tout décocher</button>
      </div>
      <div className="pzm-list" role="group" aria-label="Extensions à synchroniser">
        {all.map((x) => (
          <label key={x.id} className={'pzm-item' + (offSet.has(x.id) ? '' : ' on')}>
            <input type="checkbox" checked={!offSet.has(x.id)} disabled={running} onChange={(e) => toggle(x.id, e.target.checked)} />
            <SetLogo setId={x.id} name={x.name} />
            <span className="pzm-name">{setLabel(x)}</span>
          </label>
        ))}
      </div>
      <label className="check pzm-profile">
        <input type="checkbox" checked={profile} disabled={running} onChange={(e) => setProfile(e.target.checked)} />
        <span>Aussi le profil : accueil, stats, collections à thème et souhaits</span>
      </label>
      <div className="pzy-btns">
        <button className="btn primary" disabled={running || (!n && !profile)} onClick={go}>
          <Icon name="sync" />{n ? `Synchroniser ${n} extension${n > 1 ? 's' : ''}` : 'Synchroniser le profil'}
        </button>
      </div>
      <SyncStatus />
    </div>
  )
}
