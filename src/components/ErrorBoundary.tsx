import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { downloadBackup } from '../lib/backupFile'

function Fallback({ error }: { error: Error }) {
  const [msg, setMsg] = useState('')
  const exportIt = async () => {
    try { await downloadBackup(); setMsg('Sauvegarde téléchargée.') } catch (e) { setMsg('Export impossible : ' + (e as Error).message) }
  }
  return (
    <div className="page" role="alert" data-section="red">
      <h1>Oups, un écran a planté</h1>
      <p className="rh-empty">Tes données ne sont pas perdues : elles restent sur cet appareil. Recharge l’appli, et si le problème revient, exporte une sauvegarde avant de continuer.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}>
        <button className="btn primary" onClick={() => location.reload()}>Recharger</button>
        <button className="btn" onClick={exportIt}>Exporter une sauvegarde</button>
        <a className="btn ghost" href="#/">Retour à l’accueil</a>
      </div>
      {msg && <p>{msg}</p>}
      <details><summary>Détail technique</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{error.message}</pre></details>
    </div>
  )
}

interface Props { children: ReactNode }
class Boundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('ErrorBoundary', error, info.componentStack) }
  render() { return this.state.error ? <Fallback error={this.state.error} /> : this.props.children }
}

/** Barrière d'erreur ; se réinitialise quand on change de page. */
export function ErrorBoundary({ children }: Props) {
  const { pathname } = useLocation()
  return <Boundary key={pathname}>{children}</Boundary>
}
