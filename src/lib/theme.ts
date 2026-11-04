/** 'dark' est le thème par défaut ; 'auto' suit le réglage du système ; 'light' = clair. */
export type Theme = 'auto' | 'light' | 'dark'

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem('ptcgp:theme')
    return t === 'light' || t === 'auto' || t === 'dark' ? t : 'dark'
  } catch { return 'dark' }
}

export function applyTheme(t: Theme) {
  try { localStorage.setItem('ptcgp:theme', t) } catch { /* ignore */ }
  document.documentElement.setAttribute('data-theme', t)
}
