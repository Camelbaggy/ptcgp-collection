import { lazy, Suspense, useState } from 'react'
import { Icon } from './Icon'
import { ProfileAvatar } from './ProfileAvatar'
import { activeProfile } from '../lib/profiles'

const ProfileSheet = lazy(() => import('../features/profiles/ProfileSheet'))

/** Bouton du profil actif (accueil sur mobile, barre latérale sur ordinateur) ; ouvre « Qui joue ? ». */
export function ProfileSwitcher({ variant }: { variant: 'chip' | 'side' }) {
  const [open, setOpen] = useState(false)
  const p = activeProfile()
  return (
    <>
      {variant === 'chip' ? (
        <button type="button" className="pf-chip" onClick={() => setOpen(true)} aria-label={`Profil : ${p.name}. Changer de profil`}>
          <ProfileAvatar p={p} size="s" /><span className="pf-chip-name">{p.name}</span><Icon name="down" />
        </button>
      ) : (
        <button type="button" className="ni pf-side" onClick={() => setOpen(true)} aria-label={`Profil : ${p.name}. Changer de profil`}>
          <ProfileAvatar p={p} size="s" />
          <span className="grow">{p.name}<small>Changer de profil</small></span><Icon name="down" />
        </button>
      )}
      {open && <Suspense fallback={null}><ProfileSheet onClose={() => setOpen(false)} /></Suspense>}
    </>
  )
}
