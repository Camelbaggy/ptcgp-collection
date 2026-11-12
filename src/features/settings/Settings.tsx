import { lazy, Suspense, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { validateBackup } from '../../lib/backupValidate'
import { downloadBackup } from '../../lib/backupFile'
import { importBackup, resetUserData } from '../../lib/db'
import { useToast } from '../../components/Toast'
import { applyTheme, getTheme, type Theme } from '../../lib/theme'
import { isRevealEnabled, setRevealEnabled } from '../../lib/reveal'
import SyncPanel from '../sync/SyncPanel'
import ConsistencyCheck from '../sync/ConsistencyCheck'
import AutoBackup from './AutoBackup'
import ExportCsv from './ExportCsv'
import OfflineImages from './OfflineImages'
import UpdateCheck from './UpdateCheck'
import { AppLog, NativeNotice } from './NativeCards'
import { isNative } from '../../lib/native/holoNative'
import { activeProfile, hasSeveralProfiles } from '../../lib/profiles'

// appli Android seulement : le plugin de notifications n'est jamais chargé sur le web
const NotificationsCard = lazy(() => import('./NotificationsCard'))

export default function Settings() {
  const toast = useToast()
  const file = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<Theme>(getTheme())
  const [reveal, setReveal] = useState(isRevealEnabled())

  const doExport = async (prefix = 'ptcgp-sauvegarde') => {
    await downloadBackup(prefix)
  }
  const doImport = async (f: File | undefined) => {
    if (!f) return
    let data: unknown
    try { data = JSON.parse(await f.text()) } catch { toast('Ce fichier n’est pas un JSON lisible. Rien n’a été modifié.'); return }
    try { validateBackup(data) } catch (e) { toast((e as Error).message); return }
    const who = hasSeveralProfiles() ? ` du profil « ${activeProfile().name} »` : ''
    if (!confirm(`Remplacer toutes les données actuelles${who} par cette sauvegarde ?\nUne copie de tes données actuelles sera d’abord téléchargée.`)) return
    try {
      await doExport('ptcgp-avant-import') // copie de secours avant d’écraser
      await importBackup(data)
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
        <p className="muted">Quand une carte que tu ne possédais pas est ajoutée, la liste de l’extension s’ouvre et la carte s’illumine.</p>
      </section>
      {isNative && <Suspense fallback={null}><NotificationsCard /></Suspense>}
      <SyncPanel />
      <ConsistencyCheck />
      {!isNative && <OfflineImages />}
      <section className="card">
        <SectionHead icon="sync" title="Version" />
        <p className="muted">Version {__APP_VERSION__} · build {__APP_BUILD__} du {new Date(__APP_BUILD_DATE__).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
        <UpdateCheck />
      </section>
      <section className="card">
        <SectionHead icon="download" title="Sauvegarde" />
        {hasSeveralProfiles() && <p className="muted">Profil « {activeProfile().name} » : l’export et l’import ne concernent que ce profil.</p>}
        <div className="row">
          <button className="btn big" onClick={() => void doExport()}><Icon name="download" />Exporter (JSON)</button>
          <button className="btn big" onClick={() => file.current?.click()}><Icon name="upload" />Importer</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </section>
      <AutoBackup />
      <ExportCsv />
      <AppLog />
      <section className="card danger-zone">
        <SectionHead icon="warn" title="Zone dangereuse" />
        <button className="btn danger" onClick={async () => { if (confirm(hasSeveralProfiles() ? `Effacer inventaire, souhaits et historique du profil « ${activeProfile().name} » ?` : 'Effacer inventaire, souhaits et historique ?')) { await resetUserData(); toast('Données effacées') } }}>
          <Icon name="trash" />Effacer mes données
        </button>
      </section>
    </div>
  )
}
