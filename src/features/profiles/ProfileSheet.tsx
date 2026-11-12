import { Link } from 'react-router-dom'
import { Sheet } from '../../components/Sheet'
import { Icon } from '../../components/Icon'
import { ProfileAvatar } from '../../components/ProfileAvatar'
import { MAIN_PROFILE_ID, activeProfileId, listProfiles } from '../../lib/profiles'
import { switchProfile } from '../../lib/profileOps'
import { cardsLabel, useProfileSummaries } from './useProfileSummaries'
import './profiles.css'

/** Feuille « Qui joue ? » : un appui sur un profil recharge l'appli sur sa collection. */
export default function ProfileSheet({ onClose }: { onClose: () => void }) {
  const profiles = listProfiles()
  const counts = useProfileSummaries(profiles)
  const cur = activeProfileId()
  return (
    <Sheet title="Qui joue ?" onClose={onClose}>
      <div className="pf-list" role="list">
        {profiles.map((p) => (
          <button key={p.id} type="button" role="listitem" className={'pf-row' + (p.id === cur ? ' on' : '')} aria-current={p.id === cur ? 'true' : undefined}
            onClick={() => { if (p.id === cur) onClose(); else switchProfile(p.id) }}>
            <ProfileAvatar p={p} />
            <span className="grow"><b>{p.name}{p.id === MAIN_PROFILE_ID && <span className="pf-tag">principal</span>}</b><small>{cardsLabel(counts.get(p.id))}</small></span>
            {p.id === cur ? <span className="pf-on"><Icon name="check" />Actif</span> : <Icon name="chev" />}
          </button>
        ))}
      </div>
      <div className="pf-actions">
        <Link className="btn big" to="/profil?onglet=foyer&ajout=1" onClick={onClose}><Icon name="plus" />Ajouter un profil</Link>
        <Link className="btn big" to="/profil" onClick={onClose}><Icon name="edit" />Mon profil</Link>
      </div>
      <p className="muted pf-note">Chaque profil a sa propre collection, ses souhaits, son historique et sa synchro. Les profils restent sur cet appareil.</p>
    </Sheet>
  )
}
