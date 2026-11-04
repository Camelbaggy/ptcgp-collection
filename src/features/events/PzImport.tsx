import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { db, saveImportedEvents } from '../../lib/db'
import { mergeImports, parsePokemonZoneSchedule, type ImportedEvent } from '../../lib/events/pokemonZone'

interface Preview { events: ImportedEvent[]; fresh: number; files: number; errors: string[] }

/** Bouton « Import .html Pokemon-Zone » : ouvre le sélecteur de fichiers, aperçu, confirmation. */
export default function PzImport() {
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
    <section className="ev-import card">
      <div className="ev-import-bar">
        <input ref={input} type="file" accept=".html,.htm,text/html" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
        <button className="btn primary" disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" />{busy ? 'Lecture…' : 'Import .html Pokemon-Zone'}</button>
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
    </section>
  )
}
