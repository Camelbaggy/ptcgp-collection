import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, type IconName } from '../../components/Icon'
import { Fold } from '../../components/Fold'
import { PageHeader } from '../../components/PageHeader'
import { validateBackup } from '../../lib/backupValidate'
import { downloadBackup } from '../../lib/backupFile'
import { importBackup, resetUserData } from '../../lib/db'
import { useToast } from '../../components/Toast'
import { applyTheme, getTheme, type Theme } from '../../lib/theme'
import { isRevealEnabled, setRevealEnabled } from '../../lib/reveal'
import { usePersisted } from '../../lib/useData'
import SyncPanel from '../sync/SyncPanel'
import ConsistencyCheck from '../sync/ConsistencyCheck'
import AutoBackup from './AutoBackup'
import ExportCsv from './ExportCsv'
import OfflineImages from './OfflineImages'
import UpdateCheck from './UpdateCheck'
import { AppLog, NativeNotice } from './NativeCards'
import { isNative } from '../../lib/native/holoNative'
import { activeProfile, hasSeveralProfiles } from '../../lib/profiles'
import ProfileTab from './ProfileTab'

// appli Android seulement : le plugin de notifications n'est jamais chargé sur le web
const NotificationsCard = lazy(() => import('./NotificationsCard'))

/** Onglets des Réglages. `?onglet=<id>` ouvre un onglet, `?ouvrir=<encart>` déplie un encart (voir Fold). */
export type SettingsTab = 'profil' | 'affichage' | 'donnees' | 'appli'
const TABS: { id: SettingsTab; label: string; icon: IconName }[] = [
  { id: 'profil', label: 'Profil', icon: 'user' },
  { id: 'affichage', label: 'Affichage', icon: 'palette' },
  { id: 'donnees', label: 'Données', icon: 'cloud' },
  { id: 'appli', label: 'Appli', icon: 'gear' },
]
/** Onglet qui contient chaque encart, pour les liens `?ouvrir=` sans `onglet`. */
const TAB_OF: Record<string, SettingsTab> = {
  identite: 'profil', foyer: 'profil',
  theme: 'affichage', animation: 'affichage', notif: 'affichage', images: 'affichage',
  sync: 'donnees', consistency: 'donnees', backup: 'donnees', autobackup: 'donnees', csv: 'donnees',
  version: 'appli', log: 'appli', danger: 'appli',
}
const THEME_LABEL: Record<Theme, string> = { auto: 'Auto', light: 'Clair', dark: 'Sombre' }

export default function Settings() {
  const toast = useToast()
  const file = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<Theme>(getTheme())
  const [reveal, setReveal] = useState(isRevealEnabled())
  const [params, setParams] = useSearchParams()
  const [saved, setSaved] = usePersisted<SettingsTab>('reglages.onglet', 'donnees')
  const asked = params.get('onglet') ?? TAB_OF[params.get('ouvrir') ?? '']
  const tab: SettingsTab = TABS.some((t) => t.id === asked) ? asked as SettingsTab : TABS.some((t) => t.id === saved) ? saved : 'donnees'
  const go = (t: SettingsTab) => {
    setSaved(t)
    setParams((p) => { const n = new URLSearchParams(p); n.set('onglet', t); n.delete('ouvrir'); n.delete('ajout'); return n }, { replace: true })
  }

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

  const panels: Record<SettingsTab, ReactNode> = {
    profil: <ProfileTab adding={params.get('ajout') === '1'} />,
    affichage: <>
      <Fold id="theme" icon="palette" color="var(--violet)" title="Thème" summary={THEME_LABEL[theme]}>
        <div className="seg">
          {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} onClick={() => { setTheme(t); applyTheme(t) }}>{THEME_LABEL[t]}</button>
          ))}
        </div>
      </Fold>
      <Fold id="animation" icon="sparkle" color="var(--yellow)" title="Animation des nouvelles cartes" summary={reveal ? 'Activée' : 'Désactivée'}>
        <label className="row check-row">
          <input type="checkbox" checked={reveal}
            onChange={(e) => { setReveal(e.target.checked); setRevealEnabled(e.target.checked) }} />
          <span>Animation des nouvelles cartes</span>
        </label>
        <p className="muted">Quand une carte que tu ne possédais pas est ajoutée, la liste de l’extension s’ouvre et la carte s’illumine.</p>
      </Fold>
      {isNative && <Suspense fallback={null}><NotificationsCard /></Suspense>}
      {!isNative && <OfflineImages />}
    </>,
    donnees: <>
      <SyncPanel />
      <ConsistencyCheck />
      <Fold id="backup" icon="download" color="var(--green)" title="Sauvegarde JSON" summary="Exporter ou restaurer toutes tes données">
        {hasSeveralProfiles() && <p className="muted">Profil « {activeProfile().name} » : l’export et l’import ne concernent que ce profil.</p>}
        <div className="row">
          <button className="btn big" onClick={() => void doExport()}><Icon name="download" />Exporter (JSON)</button>
          <button className="btn big" onClick={() => file.current?.click()}><Icon name="upload" />Importer</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </Fold>
      <AutoBackup />
      <ExportCsv />
    </>,
    appli: <>
      <Fold id="version" icon="sync" title="Version et mise à jour" summary={`Version ${__APP_VERSION__} · build ${__APP_BUILD__}`}>
        <p className="muted">Build du {new Date(__APP_BUILD_DATE__).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
        <UpdateCheck />
      </Fold>
      <AppLog />
      <Fold id="danger" icon="warn" color="var(--danger)" title="Zone dangereuse" summary="Effacer mes données" className="danger-zone">
        <button className="btn danger" onClick={async () => { if (confirm(hasSeveralProfiles() ? `Effacer inventaire, souhaits et historique du profil « ${activeProfile().name} » ?` : 'Effacer inventaire, souhaits et historique ?')) { await resetUserData(); toast('Données effacées') } }}>
          <Icon name="trash" />Effacer mes données
        </button>
      </Fold>
    </>,
  }

  return (
    <div className="page" data-section="grey">
      <PageHeader icon="gear" title="Réglages" help={[
        { text: 'Ton profil, l’affichage, la synchro et les sauvegardes.' },
        { title: 'Encarts', text: 'Chaque réglage est un encart : touche son titre pour le déplier ou le replier.' },
        { title: 'Tu viens de Brave ?', text: 'Les données de l’appli sont séparées de celles du navigateur. Dans l’onglet Données, connecte Google Drive ou importe ta sauvegarde JSON, pour retrouver ta collection.' },
      ]} />
      <NativeNotice />
      <div className="seg set-tabs" role="tablist" aria-label="Catégorie de réglages">
        {TABS.map((t) => (
          <button key={t.id} id={`set-tab-${t.id}`} role="tab" aria-selected={tab === t.id} aria-controls={`set-panel-${t.id}`}
            className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}><Icon name={t.icon} />{t.label}</button>
        ))}
      </div>
      {/* Tous les panneaux restent montés (hidden) : le champ d'import et les effets des encarts restent actifs. */}
      {TABS.map((t) => (
        <div key={t.id} id={`set-panel-${t.id}`} role="tabpanel" aria-labelledby={`set-tab-${t.id}`} className="set-panel" hidden={tab !== t.id} data-content-start={tab === t.id ? '' : undefined}>
          {panels[t.id]}
        </div>
      ))}
    </div>
  )
}
