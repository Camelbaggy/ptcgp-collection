import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { db, saveImportedEvents } from '../../lib/db'
import { EVENTS_SYNC_KEY, cancelEventsSync, startEventsSync, useEventsSync } from '../../lib/events/autoSync'
import { mergeImports, parsePokemonZoneSchedule, type ImportedEvent } from '../../lib/events/pokemonZone'
import { isNative } from '../../lib/native/holoNative'
import { pzSyncSupported } from '../../lib/pzSync/host'
import { agoFr } from './format'

interface Preview { events: ImportedEvent[]; fresh: number; files: number; errors: string[] }

/** Import manuel : fichiers .html des pages Schedule enregistrés par l'utilisateur (PC, navigateur). */
function FileImport({ primary }: { primary: boolean }) {
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
        <button className={'btn' + (primary ? ' primary' : '')} disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" />{busy ? 'Lecture…' : 'Import .html Pokemon-Zone'}</button>
        <details className="ev-help">
          <summary aria-label="Aide sur l’import"><Icon name="help" /></summary>
          <p className="muted"><small>Sur pokemon-zone.com/schedule et /schedule/upcoming, faites Ctrl+S (page web complète ou HTML seulement), puis importez les fichiers .html ici. Les dossiers _files ne sont pas nécessaires.</small></p>
        </details>
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

/**
 * Haut de l'écran Évènements. Appli Android : synchro avec Pokémon-Zone (automatique à l'ouverture + bouton).
 * Navigateur : import des pages .html enregistrées.
 */
export default function PzImport() {
  const st = useEventsSync()
  const [supported, setSupported] = useState<boolean | null>(isNative ? null : false)
  useEffect(() => { if (isNative) void pzSyncSupported().then(setSupported) }, [])
  const syncedAt = useLiveQuery(async () => (await db.meta.get(EVENTS_SYNC_KEY))?.value as string | undefined, [])

  if (!isNative || supported === false) {
    return (
      <section className="ev-import card">
        <FileImport primary />
        {isNative
          ? <p className="muted small">Cette version de l'appli ne sait pas encore lire Pokémon-Zone : installe la dernière version pour la synchro automatique.</p>
          : <p className="muted small">Sur l'appli Android, les évènements se synchronisent tout seuls depuis Pokémon-Zone.</p>}
      </section>
    )
  }
  return (
    <section className="ev-import card">
      <div className="ev-import-bar">
        <button className="btn primary" disabled={st.running || supported === null} onClick={() => void startEventsSync(false)}>
          <Icon name="sync" />{st.running ? 'Synchronisation…' : 'Synchroniser avec Pokémon-Zone'}
        </button>
      </div>
      {st.running && <p className="small"><Icon name="sync" />{st.auto ? 'Actualisation automatique · ' : ''}{st.label} <button className="btn ghost small" onClick={cancelEventsSync}>Annuler</button></p>}
      {st.error && <p className="vimp-error"><Icon name="warn" />{st.error}</p>}
      {!st.running && st.result && <p className="small"><Icon name="check" />{st.result}</p>}
      {!st.running && !st.error && (
        <p className="muted small">
          {syncedAt ? <>Dernière synchro {agoFr(syncedAt)}. </> : null}
          Actualisés tout seuls à l'ouverture de l'appli, au plus une fois par heure.
        </p>
      )}
      <details className="ev-manual">
        <summary className="muted small">Import manuel (.html)</summary>
        <FileImport primary={false} />
      </details>
    </section>
  )
}
