import type { CSSProperties } from 'react'
import { initialOf, profileCssColor, type Profile } from '../lib/profiles'

/** Pastille ronde à l'initiale du profil, dans sa couleur. */
export function ProfileAvatar({ p, size = 'm' }: { p: Pick<Profile, 'name' | 'color'>; size?: 's' | 'm' | 'l' }) {
  return <span className={`pf-av pf-av-${size}`} style={{ '--c': profileCssColor(p.color) } as CSSProperties} aria-hidden="true">{initialOf(p.name)}</span>
}
