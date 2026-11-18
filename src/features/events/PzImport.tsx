import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { db, saveImportedEvents } from '../../lib/db'
import { EVENTS_SYNC_KEY, cancelEventsSync, useEventsSync } from '../../lib/events/autoSync'
import { mergeImports, parsePokemonZoneSchedule, type ImportedEvent } from '../../lib/events/pokemonZone'
import { isNative } from '../../lib/native/holoNative'
import { pzSyncSupported } from '../../lib/pzSync/host'
import { agoFr } from './format'

interface Preview { events: ImportedEvent[]; fresh: number; files: number; errors: string[] }

/** Import manuel : fichiers .html des pages Schedule enregistrés par l'utilisateur (PC, navigateur). */
export function FileImport({ primary }: { primary: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)

  async function onFiles(list: FileList | null) {
    if (!list?.length) return
    setBusy(true)
    try {
      const [cards, sets, existing] = await Promise.all([db.cards.toCollection().primaryKeys(), db.sets.toCollection().primaryKeys(), db.importedEvents.toCollection().primaryKeys()])
      const opts = { cardIds: new Set(cards as string[]), setIds: sets as string[] }
      const lists: ImportedEvent[][] = []
      const errors: string[] = []
      for (const f of Array.from(list)) {
        try {
          const evs = parsePokemonZoneSchedule(await f.text(), opts)
          if (evs.length) lists.push(evs); else errors.push(`${f.name} : aucun évènement reconnu`)
        } catch { errors.push(`${f.name} : lecture impossible`) }
      }
      const events = mergeImports(lists)
      const known = new Set(existing as string[])
      setPreview({ events, fresh: events.filter((e) => !known.has(e.id)).length, files: list.length, errors })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function confirm() {
    if (!preview) return
    setBusy(true)
    try {
      await saveImportedEvents(preview.events)
      toast(`${preview.events.length} évènements enregistrés (${preview.fresh} nouveaux).`)
      setPreview(null)
    } finally { setBusy(false) }
  }

  return (
    <>
      <div className="ev-import-bar">
        <input ref={input} type="file" accept=".html,.htm,text/html" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
        <button className={'btn' + (primary ? ' primary' : '')} disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" />{busy ? 'Lecture…' : 'Import .html Pokémon-Zone'}</button>
      </div>
      {preview && (
        <div className="ev-import-body" role="status">
          <p><b>{preview.events.length} évènements, dont {preview.fresh} nouveaux</b> ({preview.files} fichier{preview.files > 1 ? 's' : ''}).</p>
          {preview.errors.map((m) => <p key={m} className="ev-miss"><small>{m}</small></p>)}
          <div className="ev-import-actions">
            <button className="btn big" disabled={busy || !preview.events.length} onClick={() => void confirm()}>Enregistrer</button>
            <button className="btn" onClick={() => setPreview(null)}>Annuler</button>
          </div>
        </div>
      )}
    </>
  )
}

/** État de la synchro Pokémon-Zone (appli Android) : `canSync` vrai si l'appli sait lire la page. */
export function useEventsSyncUi() {
  const st = useEventsSync()
  const [supported, setSupported] = useState<boolean | null>(isNative ? null : false)
  useEffect(() => { if (isNative) void pzSyncSupported().then(setSupported) }, [])
  const syncedAt = useLiveQuery(async () => (await db.meta.get(EVENTS_SYNC_KEY))?.value as string | undefined, [])
  return { st, supported, canSync: isNative && supported === true, syncedAt }
}

/** Ligne d'état à droite du titre « En cours » : « à jour · il y a 6 min », « Synchronisation… » (Annuler). */
export function SyncStatus({ ui }: { ui: ReturnType<typeof useEventsSyncUi> }) {
  const { st, syncedAt } = ui
  if (st.running) {
    return <span className="ev-sync" role="status">{st.auto ? 'Actualisation… ' : 'Synchronisation… '}<button type="button" className="ev-sync-cancel" onClick={cancelEventsSync}>Annuler</button></span>
  }
  if (!isNative || st.error || !syncedAt) return null
  return <span className="ev-sync" role="status"><Icon name="check" />à jour · {agoFr(syncedAt)}</span>
}

/** Erreur de la dernière synchro, seulement quand il y en a une. */
export function SyncError({ ui }: { ui: ReturnType<typeof useEventsSyncUi> }) {
  if (!ui.st.error || ui.st.running) return null
  return <p className="vimp-error"><Icon name="warn" />{ui.st.error}</p>
}

/** Contenu d'aide sur la synchro et l'import manuel (feuille « ? » de l'écran). */
export function SyncHelp({ ui }: { ui: ReturnType<typeof useEventsSyncUi> }) {
  return (
    <>
      <p>
        {ui.canSync
          ? 'Les évènements sont actualisés tout seuls à l’ouverture de l’appli, au plus une fois par heure. Le bouton de synchronisation de l’en-tête force une lecture de Pokémon-Zone.'
          : isNative
            ? 'Cette version de l’appli ne sait pas encore lire Pokémon-Zone : installe la dernière version pour la synchro automatique.'
            : 'Sur l’appli Android, les évènements se synchronisent tout seuls depuis Pokémon-Zone.'}
      </p>
      <p>Import manuel : sur pokemon-zone.com/schedule et /schedule/upcoming, fais Ctrl+S (page web complète ou HTML seulement), puis importe les fichiers .html ici. Les dossiers _files ne sont pas nécessaires.</p>
      <FileImport primary={false} />
    </>
  )
}
