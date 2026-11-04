import { useMemo, useRef, useState } from 'react'
import { exportBackup, importBackup, resetUserData, undoLast } from '../../lib/db'
import { useToast } from '../../components/Toast'
import { applyTheme, getTheme, type Theme } from '../../lib/theme'
import { EventBadge } from '../../components/EventBadge'
import { useCards, useHistory } from '../../lib/useData'
import type { HistoryEvent } from '../../lib/types'
import SyncPanel from '../sync/SyncPanel'

const describe = (e: HistoryEvent) =>
  e.kind === 'pack' ? `Booster ${e.boosterId} (${e.cardIds.length} cartes)`
  : e.kind === 'share' ? `Partage ${e.direction === 'given' ? 'donné' : 'reçu'} : ${e.cardId}`
  : e.kind === 'correction' ? `Mise à jour : ${e.changes.length} carte(s)`
  : `Échange : ${e.given} → ${e.received}`

export default function Settings() {
  const toast = useToast()
  const file = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<Theme>(getTheme())
  const history = useHistory()
  const cards = useCards()
  const cardSet = useMemo(() => new Map(cards.map((c) => [c.id, c.setId])), [cards])

  const doExport = async () => {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ptcgp-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const doImport = async (f: File | undefined) => {
    if (!f) return
    if (!confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return
    try {
      await importBackup(JSON.parse(await f.text()))
      toast('Sauvegarde restaurée')
    } catch (e) { toast((e as Error).message) }
  }
  return (
    <div className="page">
      <h1>Réglages</h1>
      <section>
        <h3>Thème</h3>
        <div className="seg">
          {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} onClick={() => { setTheme(t); applyTheme(t) }}>
              {t === 'auto' ? 'Auto' : t === 'light' ? 'Clair' : 'Sombre'}
            </button>
          ))}
        </div>
      </section>
      <SyncPanel />
      <section>
        <h3>Version</h3>
        <p className="muted">Version {__APP_BUILD__} du {new Date(__APP_BUILD_DATE__).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
        <button className="btn" onClick={() => { void navigator.serviceWorker?.getRegistration().then((r) => r?.update()) }}>Rechercher une mise à jour</button>
      </section>
      <section>
        <h3>Sauvegarde</h3>
        <div className="row">
          <button className="btn big" onClick={doExport}>Exporter (JSON)</button>
          <button className="btn big" onClick={() => file.current?.click()}>Importer</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </section>
      <section>
        <h3>Historique récent</h3>
        <button className="btn" disabled={!history.length} onClick={async () => { const e = await undoLast(); if (e) toast('Dernier évènement annulé') }}>
          Annuler le dernier évènement
        </button>
        <ul className="list">
          {history.map((e) => <li key={e.id} className="list-item hist"><span className="mono">{e.date.slice(0, 16).replace('T', ' ')}</span><EventBadge e={e} setOf={(id) => cardSet.get(id)} /><span className="grow">{describe(e)}</span></li>)}
        </ul>
      </section>
      <section>
        <h3>Zone dangereuse</h3>
        <button className="btn danger" onClick={async () => { if (confirm('Effacer inventaire, souhaits et historique ?')) { await resetUserData(); toast('Données effacées') } }}>
          Effacer mes données
        </button>
      </section>
    </div>
  )
}
