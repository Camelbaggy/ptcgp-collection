import { useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { ProfileAvatar } from '../../components/ProfileAvatar'
import { useToast } from '../../components/Toast'
import {
  MAIN_PROFILE_ID, MAX_NAME, MAX_PROFILES, PROFILE_COLORS, activeProfileId, listProfiles, profileCssColor, updateProfile, type Profile,
} from '../../lib/profiles'
import { createProfile, deleteProfile, switchProfile } from '../../lib/profileOps'
import { useSyncState } from '../sync/useSync'
import { cardsLabel, useProfileSummaries } from './useProfileSummaries'
import { IconPicker } from './IconPicker'
import './profiles.css'

const COLOR_FR: Record<string, string> = {
  violet: 'Violet', pink: 'Rose', teal: 'Turquoise', orange: 'Orange', blue: 'Bleu', green: 'Vert', yellow: 'Jaune', red: 'Rouge',
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="pf-colors" role="radiogroup" aria-label="Couleur">
      {PROFILE_COLORS.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={COLOR_FR[c]} className={'pf-color' + (value === c ? ' on' : '')}
          style={{ '--c': profileCssColor(c) } as CSSProperties} onClick={() => onChange(c)} />
      ))}
    </div>
  )
}

/** Image de profil : icône du jeu (feuille « Choisis ton icône ») ou initiale. */
function PicturePicker({ icon, name, color, onChange }: { icon: string | undefined; name: string; color: string; onChange: (icon: string | undefined) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pf-pic">
      <ProfileAvatar p={{ name: name || '?', color, icon }} size="l" />
      <button type="button" className="btn" onClick={() => setOpen(true)}><Icon name="user" />{icon ? 'Changer d’icône' : 'Choisir une icône du jeu'}</button>
      {icon && <button type="button" className="btn ghost" onClick={() => onChange(undefined)}>Revenir à l’initiale</button>}
      {open && <IconPicker value={icon} name={name || '?'} color={color} onPick={onChange} onClose={() => setOpen(false)} />}
    </div>
  )
}

function ProfileCard({ p, count, onChanged }: { p: Profile; count: number | undefined; onChanged: () => void }) {
  const toast = useToast()
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(p.name)
  const [color, setColor] = useState(p.color)
  const [icon, setIcon] = useState(p.icon)
  const active = p.id === activeProfileId()
  const save = () => {
    updateProfile(p.id, { name, color, icon: icon ?? '' }); setEdit(false); onChanged()
    if (active) location.reload() // l'avatar du menu et de l'accueil est lu au chargement
  }
  const remove = async () => {
    if (!confirm(`Supprimer le profil « ${p.name} » et toute sa collection sur cet appareil ?\nSon fichier de synchro Google Drive, s’il existe, est conservé.`)) return
    try { await deleteProfile(p.id); toast(`Profil « ${p.name} » supprimé`); onChanged() } catch (e) { toast((e as Error).message) }
  }
  return (
    <section className="card pf-card">
      <div className="pf-head">
        <ProfileAvatar p={edit ? { name: name || p.name, color, icon } : p} size="l" />
        <span className="grow">
          <b>{p.name}</b>{p.id === MAIN_PROFILE_ID && <span className="pf-tag" style={{ marginLeft: 8 }}>principal</span>}
          <small className="muted" style={{ display: 'block' }}>{cardsLabel(count)}</small>
        </span>
        {active ? <span className="pf-on"><Icon name="check" />Actif</span> : <button type="button" className="btn primary" onClick={() => switchProfile(p.id)}>Passer dessus</button>}
      </div>
      {edit ? (
        <>
          <label className="muted" htmlFor={`pf-n-${p.id}`}>Nom</label>
          <input id={`pf-n-${p.id}`} className="pf-input" value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} />
          <span className="muted">Image de profil</span>
          <PicturePicker icon={icon} name={name} color={color} onChange={setIcon} />
          <span className="muted">{icon ? 'Couleur du contour' : 'Couleur'}</span>
          <ColorPicker value={color} onChange={setColor} />
          <div className="pf-btns">
            <button type="button" className="btn primary" onClick={save} disabled={!name.trim()}><Icon name="check" />Enregistrer</button>
            <button type="button" className="btn" onClick={() => { setEdit(false); setName(p.name); setColor(p.color); setIcon(p.icon) }}>Annuler</button>
          </div>
        </>
      ) : (
        <div className="pf-btns">
          <button type="button" className="btn" onClick={() => setEdit(true)}><Icon name="edit" />Modifier</button>
          {p.id !== MAIN_PROFILE_ID && !active && <button type="button" className="btn danger" onClick={() => void remove()}><Icon name="trash" />Supprimer</button>}
        </div>
      )}
    </section>
  )
}

function AddProfile({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const used = new Set(listProfiles().map((p) => p.color))
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PROFILE_COLORS.find((c) => !used.has(c)) ?? 'blue')
  const [icon, setIcon] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const create = async (go: boolean) => {
    setBusy(true)
    try {
      const p = await createProfile(name, color)
      if (icon) updateProfile(p.id, { icon })
      if (go) { switchProfile(p.id); return }
      toast(`Profil « ${p.name} » créé`); setName(''); onDone()
    } catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <section className="card pf-card" id="ajout">
      <SectionHead icon="plus" title="Nouveau profil" />
      <label className="muted" htmlFor="pf-new">Prénom ou pseudo</label>
      <input id="pf-new" className="pf-input" value={name} maxLength={MAX_NAME} placeholder="Par exemple Léa" onChange={(e) => setName(e.target.value)} />
      <span className="muted">Image de profil</span>
      <PicturePicker icon={icon} name={name} color={color} onChange={setIcon} />
      <ColorPicker value={color} onChange={setColor} />
      <div className="pf-btns">
        <button type="button" className="btn primary" disabled={!name.trim() || busy} onClick={() => void create(true)}><Icon name="check" />Créer et passer dessus</button>
        <button type="button" className="btn" disabled={!name.trim() || busy} onClick={() => void create(false)}>Créer seulement</button>
      </div>
      <p className="muted">Le nouveau profil démarre avec une collection vide. Les évènements et la tier list sont recopiés depuis ce profil.</p>
    </section>
  )
}

function DriveRecovery({ onDone }: { onDone: () => void }) {
  const sync = useSyncState()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!sync.enabled) return null
  const run = async () => {
    setBusy(true)
    try {
      const { recoverProfilesFromDrive } = await import('../../lib/sync/profiles')
      const added = await recoverProfilesFromDrive()
      toast(added.length ? `Profils retrouvés : ${added.join(', ')}` : 'Aucun autre profil sur ce compte Google')
      onDone()
    } catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <section className="card">
      <SectionHead icon="cloud" title="Sur un autre appareil" />
      <p className="muted">Tu as créé des profils sur un autre appareil avec ce compte Google ({sync.email ?? 'connecté'}) ? Retrouve-les ici, leur collection arrive à la première synchro.</p>
      <button type="button" className="btn big" disabled={busy} onClick={() => void run()}><Icon name="download" />Retrouver les profils sur Google Drive</button>
    </section>
  )
}

export default function Profiles() {
  const [params] = useSearchParams()
  const [rev, setRev] = useState(0)
  const [adding, setAdding] = useState(params.get('ajout') === '1')
  const profiles = listProfiles()
  const counts = useProfileSummaries(profiles, rev)
  const changed = () => setRev((r) => r + 1)
  return (
    <div className="page" data-section="pink">
      <PageHeader icon="user" title="Profils" sub="Une collection par membre du foyer, sur cet appareil" />
      {profiles.map((p) => <ProfileCard key={`${p.id}-${rev}`} p={p} count={counts.get(p.id)} onChanged={changed} />)}
      {adding ? <AddProfile onDone={() => { setAdding(false); changed() }} />
        : profiles.length < MAX_PROFILES && <button type="button" className="btn big" onClick={() => setAdding(true)}><Icon name="plus" />Ajouter un profil</button>}
      <DriveRecovery onDone={changed} />
      <section className="card">
        <SectionHead icon="help" title="Bon à savoir" />
        <ul className="muted">
          <li>Chaque profil a sa propre collection, ses souhaits, son historique, ses stats Pokémon-Zone et sa synchro Google Drive (avec son compte Google ou le tien).</li>
          <li>Le thème et les filtres d’affichage sont communs à tous les profils.</li>
          <li>Pokémon-Zone : connecte-toi au compte Pokémon-Zone du bon joueur avant de lancer une synchro.</li>
          <li>Seuls les membres du foyer qui sont d’accord, avec leur propre compte de jeu.</li>
        </ul>
      </section>
    </div>
  )
}
