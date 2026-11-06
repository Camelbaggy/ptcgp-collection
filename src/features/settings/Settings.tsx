import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { exportBackup, importBackup, resetUserData } from '../../lib/db'
import { useToast } from '../../components/Toast'
import { applyTheme, getTheme, type Theme } from '../../lib/theme'
import { isRevealEnabled, setRevealEnabled } from '../../lib/reveal'
import SyncPanel from '../sync/SyncPanel'
import OfflineImages from './OfflineImages'
import UpdateCheck from './UpdateCheck'
import { AppLog, NativeNotice } from './NativeCards'
import { isNative } from '../../lib/native/holoNative'

export default function Settings() {
  const toast = useToast()
  const file = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<Theme>(getTheme())
  const [reveal, setReveal] = useState(isRevealEnabled())

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
      <NativeNotice />
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
      {!isNative && <OfflineImages />}
      <section className="card">
        <SectionHead icon="sync" title="Version" />
        <p className="muted">Version {__APP_VERSION__} · build {__APP_BUILD__} du {new Date(__APP_BUILD_DATE__).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
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
      <AppLog />
      <section className="card danger-zone">
        <SectionHead icon="warn" title="Zone dangereuse" />
        <button className="btn danger" onClick={async () => { if (confirm('Effacer inventaire, souhaits et historique ?')) { await resetUserData(); toast('Données effacées') } }}>
          <Icon name="trash" />Effacer mes données
        </button>
      </section>
    </div>
  )
}
