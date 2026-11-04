import { useRef, useState } from 'react'
import { db, saveImportedEvents } from '../../lib/db'
import { mergeImports, parsePokemonZoneSchedule, type ImportedEvent } from '../../lib/events/pokemonZone'

interface Preview { events: ImportedEvent[]; fresh: number; files: number; errors: string[] }

/** Bouton « Importer depuis Pokémon-Zone » : choix de fichiers .html, aperçu, confirmation. */
export default function PzImport() {
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function onFiles(list: FileList | null) {
    if (!list?.length) return
    setBusy(true); setDone(null)
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
      setDone(`${preview.events.length} évènements enregistrés (${preview.fresh} nouveaux).`)
      setPreview(null)
    } finally { setBusy(false) }
  }

  return (
    <section className="ev-import">
      <button className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>Importer depuis Pokemon-Zone</button>
      {open && (
        <div className="ev-import-body">
          <p className="muted"><small>Sur pokemon-zone.com/schedule et /schedule/upcoming, faites Ctrl+S (page web complète ou HTML seulement), puis importez les fichiers .html ici. Les dossiers _files ne sont pas nécessaires.</small></p>
          <input ref={input} type="file" accept=".html,.htm,text/html" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
          <button className="btn big" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Lecture…' : 'Choisir les fichiers .html'}</button>
          {preview && (
            <div role="status">
              <p><b>{preview.events.length} évènements, dont {preview.fresh} nouveaux</b> ({preview.files} fichier{preview.files > 1 ? 's' : ''}).</p>
              {preview.errors.map((m) => <p key={m} className="ev-miss"><small>{m}</small></p>)}
              <div className="ev-import-actions">
                <button className="btn big" disabled={busy || !preview.events.length} onClick={() => void confirm()}>Enregistrer</button>
                <button className="btn" onClick={() => setPreview(null)}>Annuler</button>
              </div>
            </div>
          )}
          {done && <p role="status">{done}</p>}
        </div>
      )}
    </section>
  )
}
