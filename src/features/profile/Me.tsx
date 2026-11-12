import { lazy, Suspense, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { ProfileAvatar } from '../../components/ProfileAvatar'
import { MAIN_PROFILE_ID, MAX_NAME, activeProfile, listProfiles, updateProfile } from '../../lib/profiles'
import { usePzSnapshot } from '../../lib/pzProfile/store'
import { usePersisted } from '../../lib/useData'
import { ColorPicker, Household } from '../profiles/Profiles'
import { IconPicker } from '../profiles/IconPicker'
import { cardsLabel, useProfileSummaries } from '../profiles/useProfileSummaries'
import { GameAccount } from './Profile'
import '../profiles/profiles.css'
import './profile.css'

const ProfileSheet = lazy(() => import('../profiles/ProfileSheet'))

export type MeTab = 'jeu' | 'foyer'

/**
 * « Mon profil » (`#/profil`) : le joueur actif (icône d'un appui sur l'avatar, nom, couleur),
 * puis deux onglets, « Compte de jeu » (instantané Pokémon-Zone) et « Foyer » (les autres profils).
 * Remplace les anciennes pages « Profil » et « Profils du foyer » (`#/profils` redirige ici).
 */
export default function Me() {
  const [params, setParams] = useSearchParams()
  const [saved, setSaved] = usePersisted<MeTab>('profil.onglet', 'jeu')
  const asked = params.get('onglet')
  const tab: MeTab = asked === 'jeu' || asked === 'foyer' ? asked : params.get('ajout') === '1' ? 'foyer' : saved
  const go = (t: MeTab) => {
    setSaved(t)
    setParams((p) => { const n = new URLSearchParams(p); n.set('onglet', t); n.delete('ajout'); return n }, { replace: true })
  }
  const [rev, setRev] = useState(0)
  const me = activeProfile()
  const profiles = listProfiles()
  const counts = useProfileSummaries(profiles, rev)
  const home = usePzSnapshot('home')
  const game = home?.data
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [name, setName] = useState(me.name)
  const [color, setColor] = useState(me.color)
  // l'avatar du menu et de l'accueil est lu au chargement : on recharge après un changement
  const save = (patch: { name?: string; color?: string; icon?: string }) => { updateProfile(me.id, patch); location.reload() }

  return (
    <div className="page" data-section="blue">
      <section className="me-hero">
        <button type="button" className="me-av" onClick={() => setPicking(true)} aria-label={me.icon ? 'Changer d’icône' : 'Choisir une icône du jeu'}>
          <ProfileAvatar p={me} size="xl" />
          <span className="me-pen" aria-hidden="true"><Icon name="edit" /></span>
        </button>
        <span className="grow">
          <h1>{me.name}</h1>
          <small>{me.id === MAIN_PROFILE_ID ? 'principal · ' : ''}{cardsLabel(counts.get(me.id))}</small>
          {game?.name && <small>Dans le jeu : {game.name}{game.level != null ? ` · niveau ${game.level}` : ''}</small>}
        </span>
      </section>
      <div className="me-actions">
        <button type="button" className="btn" onClick={() => setPicking(true)}><Icon name="user" />{me.icon ? 'Changer d’icône' : 'Choisir une icône'}</button>
        <button type="button" className="btn" onClick={() => { setName(me.name); setColor(me.color); setEditing((e) => !e) }} aria-expanded={editing}><Icon name="edit" />Nom et couleur</button>
        <button type="button" className="btn" onClick={() => setSwitching(true)}><Icon name="swap" />Changer de joueur</button>
      </div>
      {editing && (
        <section className="card pf-card">
          <label className="muted" htmlFor="me-name">Prénom ou pseudo</label>
          <input id="me-name" className="pf-input" value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} />
          <span className="muted">{me.icon ? 'Couleur du contour' : 'Couleur'}</span>
          <ColorPicker value={color} onChange={setColor} />
          <div className="pf-btns">
            <button type="button" className="btn primary" disabled={!name.trim()} onClick={() => save({ name, color })}><Icon name="check" />Enregistrer</button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </section>
      )}

      <div className="seg me-tabs" role="tablist" aria-label="Partie du profil">
        <button type="button" role="tab" id="me-tab-jeu" aria-controls="me-panel-jeu" aria-selected={tab === 'jeu'} className={tab === 'jeu' ? 'on' : ''} onClick={() => go('jeu')}>
          <Icon name="trophy" />Compte de jeu
        </button>
        <button type="button" role="tab" id="me-tab-foyer" aria-controls="me-panel-foyer" aria-selected={tab === 'foyer'} className={tab === 'foyer' ? 'on' : ''} onClick={() => go('foyer')}>
          <Icon name="user" />Foyer{profiles.length > 1 ? ` · ${profiles.length}` : ''}
        </button>
      </div>
      <div role="tabpanel" id={`me-panel-${tab}`} aria-labelledby={`me-tab-${tab}`} className="me-panel">
        {tab === 'jeu' ? <GameAccount /> : <Household adding={params.get('ajout') === '1'} onChanged={() => setRev((r) => r + 1)} />}
      </div>

      {picking && <IconPicker value={me.icon} name={me.name} color={me.color} onPick={(icon) => { if ((icon ?? '') !== (me.icon ?? '')) save({ icon: icon ?? '' }) }} onClose={() => setPicking(false)} />}
      {switching && <Suspense fallback={null}><ProfileSheet onClose={() => setSwitching(false)} /></Suspense>}
    </div>
  )
}
