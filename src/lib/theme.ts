export type Theme = 'auto' | 'light' | 'dark'

export function getTheme(): Theme {
  try { return (localStorage.getItem('ptcgp:theme') as Theme) || 'auto' } catch { return 'auto' }
}

export function applyTheme(t: Theme) {
  try { localStorage.setItem('ptcgp:theme', t) } catch { /* ignore */ }
  if (t === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
}
