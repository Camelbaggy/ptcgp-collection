import { PREF_PREFIX, lsGet, lsSet } from './storage'
/** 'dark' est le thème par défaut ; 'auto' suit le réglage du système ; 'light' = clair. */
export type Theme = 'auto' | 'light' | 'dark'

export function getTheme(): Theme {
  const t = lsGet(PREF_PREFIX + 'theme')
  return t === 'light' || t === 'auto' || t === 'dark' ? t : 'dark'
}

export function applyTheme(t: Theme) {
  lsSet(PREF_PREFIX + 'theme', t)
  document.documentElement.setAttribute('data-theme', t)
}
