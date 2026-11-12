import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { SectionHead } from '../../components/PageHeader'
import { Fold } from '../../components/Fold'
import { HoloNative, isNative } from '../../lib/native/holoNative'

const isAndroidBrowser = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

/** Réglages : aide à la migration (appli) ou lien vers l'appli Android (navigateur Android). */
export function NativeNotice() {
  if (isNative) {
    return (
      <section className="card">
        <SectionHead icon="cloud" title="Tu viens de Brave ?" />
        <p className="muted">Les données de l'appli sont séparées de celles du navigateur. Dans l’onglet Données, connecte Google Drive ou importe ta sauvegarde JSON, pour retrouver ta collection.</p>
        <Link className="btn" to="/aide?s=android">Voir le pas à pas</Link>
      </section>
    )
  }
  if (isAndroidBrowser) {
    return (
      <p className="muted">
        Une appli Android est disponible : <a href="https://github.com/Camelbaggy/ptcgp-collection/releases/latest" target="_blank" rel="noopener noreferrer">télécharger la dernière version</a>.
      </p>
    )
  }
  return null
}

/** Réglages (appli seulement) : journal natif pour le diagnostic. */
export function AppLog() {
  const [lines, setLines] = useState<string[] | null>(null)
  const [msg, setMsg] = useState('')
  if (!isNative) return null

  const load = async () => {
    setMsg('')
    try { setLines((await HoloNative.getLog()).lines) } catch (e) { setMsg((e as Error).message || 'Journal illisible') }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText((lines ?? []).join('\n')); setMsg('Copié dans le presse-papiers') } catch { setMsg('Copie impossible') }
  }
  const clear = async () => {
    try { await HoloNative.clearLog(); setLines([]); setMsg('Journal effacé') } catch (e) { setMsg((e as Error).message || 'Échec') }
  }
  return (
    <Fold id="log" icon="bulb" title="Journal de l’appli" summary="Pour comprendre un souci de capture ou de connexion">
      <p className="muted">Copie-le et envoie-le pour expliquer un problème.</p>
      <div className="row">
        <button className="btn" onClick={() => { void load() }}><Icon name="sync" />Afficher le journal</button>
        {lines && lines.length > 0 && <button className="btn" onClick={() => { void copy() }}><Icon name="download" />Copier</button>}
        {lines && lines.length > 0 && <button className="btn" onClick={() => { void clear() }}><Icon name="trash" />Effacer</button>}
      </div>
      {lines && <pre className="app-log" tabIndex={0}>{lines.length ? lines.join('\n') : 'Journal vide.'}</pre>}
      {msg && <p className="muted" role="status">{msg}</p>}
    </Fold>
  )
}
