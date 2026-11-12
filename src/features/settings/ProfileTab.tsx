import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { Fold } from '../../components/Fold'
import { Icon } from '../../components/Icon'
import { ProfileAvatar } from '../../components/ProfileAvatar'
import { MAIN_PROFILE_ID, MAX_NAME, activeProfile, listProfiles, updateProfile } from '../../lib/profiles'
import { usePzSnapshot } from '../../lib/pzProfile/store'
import { ColorPicker, Household } from '../profiles/Profiles'
import { IconPicker } from '../profiles/IconPicker'
import { cardsLabel, useProfileSummaries } from '../profiles/useProfileSummaries'
import '../profiles/profiles.css'

const ProfileSheet = lazy(() => import('../profiles/ProfileSheet'))

const COLOR_FR: Record<string, string> = {
  violet: 'violet', pink: 'rose', teal: 'turquoise', orange: 'orange', blue: 'bleu', green: 'vert', yellow: 'jaune', red: 'rouge',
}

/**
 * Réglages › Profil : le joueur actif (appui sur l'avatar = choisir l'icône du jeu), « Nom et couleur »,
 * « Joueurs du foyer » (autres profils, ajout, récupération Drive). Remplace les anciennes pages
 * « Profil » (devenue Stats › À vie) et « Profils du foyer » (`#/profils` redirige ici).
 */
export default function ProfileTab({ adding }: { adding?: boolean }) {
  const [rev, setRev] = useState(0)
  const me = activeProfile()
  const profiles = listProfiles()
  const counts = useProfileSummaries(profiles, rev)
  const game = usePzSnapshot('home')?.data
  const [picking, setPicking] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [name, setName] = useState(me.name)
  const [color, setColor] = useState(me.color)
  // l'avatar du menu et de l'accueil est lu au chargement : on recharge après un changement
  const save = (patch: { name?: string; color?: string; icon?: string }) => { updateProfile(me.id, patch); location.reload() }
  const others = profiles.length - 1

  return (
    <>
      <section className="me-hero">
        <button type="button" className="me-av" onClick={() => setPicking(true)} aria-label={me.icon ? 'Changer d’icône' : 'Choisir une icône du jeu'}>
          <ProfileAvatar p={me} size="xl" />
          <span className="me-pen" aria-hidden="true"><Icon name="edit" /></span>
        </button>
        <span className="grow">
          <b className="me-name">{me.name}</b>
          <small>{me.id === MAIN_PROFILE_ID ? 'principal · ' : ''}{cardsLabel(counts.get(me.id))}</small>
          {game?.name && <small>Dans le jeu : {game.name}{game.level != null ? ` · niveau ${game.level}` : ''} · <Link to="/stats?onglet=vie">voir le compte</Link></small>}
        </span>
      </section>
      <div className="me-actions">
        <button type="button" className="btn" onClick={() => setPicking(true)}><Icon name="user" />{me.icon ? 'Changer d’icône' : 'Choisir une icône'}</button>
        {others > 0 && <button type="button" className="btn" onClick={() => setSwitching(true)}><Icon name="swap" />Changer de joueur</button>}
      </div>

      <Fold id="identite" icon="edit" color="var(--pink)" title="Nom et couleur" summary={`${me.name} · ${COLOR_FR[me.color] ?? me.color}`}>
        <label className="muted" htmlFor="me-name">Prénom ou pseudo</label>
        <input id="me-name" className="pf-input" value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} />
        <p className="muted">{me.icon ? 'Couleur du contour' : 'Couleur'}</p>
        <ColorPicker value={color} onChange={setColor} />
        <div className="pf-btns" style={{ marginTop: 12 }}>
          <button type="button" className="btn primary" disabled={!name.trim() || (name === me.name && color === me.color)} onClick={() => save({ name, color })}><Icon name="check" />Enregistrer</button>
        </div>
      </Fold>
      <Fold id="foyer" icon="user" color="var(--blue)" title="Joueurs du foyer"
        summary={others > 0 ? `${profiles.length} profils sur cet appareil` : 'Une collection par membre du foyer'}>
        <div className="me-foyer"><Household adding={adding} onChanged={() => setRev((r) => r + 1)} /></div>
      </Fold>

      {picking && <IconPicker value={me.icon} name={me.name} color={me.color} onPick={(icon) => { if ((icon ?? '') !== (me.icon ?? '')) save({ icon: icon ?? '' }) }} onClose={() => setPicking(false)} />}
      {switching && <Suspense fallback={null}><ProfileSheet onClose={() => setSwitching(false)} /></Suspense>}
    </>
  )
}
