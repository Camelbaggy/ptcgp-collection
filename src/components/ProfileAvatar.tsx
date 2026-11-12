import { useState, type CSSProperties } from 'react'
import { initialOf, profileCssColor, type Profile } from '../lib/profiles'
import { useIconSrc } from '../lib/profileIcons/store'

/** Pastille ronde du profil : son icône du jeu si elle en a une (contour à sa couleur), sinon l'initiale dans sa couleur. */
export function ProfileAvatar({ p, size = 'm' }: { p: Pick<Profile, 'name' | 'color' | 'icon'>; size?: 's' | 'm' | 'l' | 'xl' }) {
  const src = useIconSrc(p.icon)
  const [broken, setBroken] = useState<string | null>(null)
  const style = { '--c': profileCssColor(p.color) } as CSSProperties
  if (src && broken !== src) {
    return (
      <span className={`pf-av pf-av-${size} pf-av-img`} style={style} aria-hidden="true">
        <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={() => setBroken(src)} />
      </span>
    )
  }
  return <span className={`pf-av pf-av-${size}`} style={style} aria-hidden="true">{initialOf(p.name)}</span>
}
