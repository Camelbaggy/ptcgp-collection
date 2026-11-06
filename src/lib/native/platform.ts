import { isNative } from './holoNative'

/** Site publié (GitHub Pages) : source des images et des mises à jour de l'appli Android. */
export const REMOTE_BASE = 'https://camelbaggy.github.io/ptcgp-collection/'

/**
 * Préfixe des images lourdes (cartes, boosters, sprites, objets, évènements).
 * Web : le site lui-même ; appli Android : ces images ne sont pas dans l'APK, on les lit sur le site publié.
 * Logos, emblèmes et données JSON restent locaux (`BASE`).
 */
export const ASSET_BASE: string = isNative ? REMOTE_BASE : import.meta.env.BASE_URL

/** `https://camelbaggy.github.io/ptcgp-collection/#/ajout?…` → `#/ajout?…` (null si ce n'est pas un lien du site). */
export function hashFromDeepLink(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(REMOTE_BASE.replace(/\/$/, ''))) return null
  const i = url.indexOf('#')
  return i >= 0 && url.slice(i).length > 1 ? url.slice(i) : '#/'
}

