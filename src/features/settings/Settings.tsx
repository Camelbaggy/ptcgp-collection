import { useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState, PageHeader, SectionHead } from '../../components/PageHeader'
import { exportBackup, importBackup, resetUserData, undoLast } from '../../lib/db'
import { useToast } from '../../components/Toast'
import { applyTheme, getTheme, type Theme } from '../../lib/theme'
import { EventBadge } from '../../components/EventBadge'
import { useCards, useHistory } from '../../lib/useData'
import type { HistoryEvent } from '../../lib/types'
import { isRevealEnabled, setRevealEnabled } from '../../lib/reveal'
import SyncPanel from '../sync/SyncPanel'
import UpdateCheck from './UpdateCheck'

const describe = (e: HistoryEvent) =>
  e.kind === 'pack' ? `Booster ${e.boosterId} (${e.cardIds.length} cartes)`
  : e.kind === 'share' ? `Partage ${e.direction === 'given' ? 'donné' : 'reçu'} : ${e.cardId}`
  : e.kind === 'correction' ? `Mise à jour : ${e.changes.length} carte(s)`
  : `Échange : ${e.given} → ${e.received}`

export default function Settings() {
  const toast = useToast()
  const file = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<Theme>(getTheme())
  const [reveal, setReveal] = useState(isRevealEnabled())
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
    <div className="page" data-section="grey">
      <PageHeader icon="gear" title="Réglages" sub="Thème, synchronisation et sauvegardes" />
      <section className="card">
        <SectionHead icon="palette" title="Thème" />
        <div className="seg">
          {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} onClick={() => { setTheme(t); applyTheme(t) }}>
              {t === 'auto' ? 'Auto' : t === 'light' ? 'Clair' : 'Sombre'}
            </button>
          ))}
        </div>
      </section>
      <section className="card">
        <SectionHead icon="sparkle" title="Animation" />
        <label className="row check-row">
          <input type="checkbox" checked={reveal}
            onChange={(e) => { setReveal(e.target.checked); setRevealEnabled(e.target.checked) }} />
          <span>Animation des nouvelles cartes</span>
        </label>
        <p className="muted">Quand une carte que vous ne possédiez pas est ajoutée, la liste de l’extension s’ouvre et la carte s’illumine.</p>
      </section>
      <SyncPanel />
      <section className="card">
        <SectionHead icon="sync" title="Version" />
        <p className="muted">Version {__APP_BUILD__} du {new Date(__APP_BUILD_DATE__).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
        <UpdateCheck />
      </section>
      <section className="card">
        <SectionHead icon="download" title="Sauvegarde" />
        <div className="row">
          <button className="btn big" onClick={doExport}><Icon name="download" />Exporter (JSON)</button>
          <button className="btn big" onClick={() => file.current?.click()}><Icon name="upload" />Importer</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </section>
      <section className="card">
        <SectionHead icon="history" title="Historique récent" />
        <button className="btn" disabled={!history.length} onClick={async () => { const e = await undoLast(); if (e) toast('Dernier évènement annulé') }}>
          <Icon name="undo" />Annuler le dernier évènement
        </button>
        {!history.length && <EmptyState icon="history" title="Rien pour l'instant" text="Tes ajouts, partages et échanges apparaîtront ici." />}
        <ul className="list">
          {history.map((e) => <li key={e.id} className="list-item hist"><span className="mono">{e.date.slice(0, 16).replace('T', ' ')}</span><EventBadge e={e} setOf={(id) => cardSet.get(id)} /><span className="grow">{describe(e)}</span></li>)}
        </ul>
      </section>
      <section className="card danger-zone">
        <SectionHead icon="warn" title="Zone dangereuse" />
        <button className="btn danger" onClick={async () => { if (confirm('Effacer inventaire, souhaits et historique ?')) { await resetUserData(); toast('Données effacées') } }}>
          <Icon name="trash" />Effacer mes données
        </button>
      </section>
    </div>
  )
}
