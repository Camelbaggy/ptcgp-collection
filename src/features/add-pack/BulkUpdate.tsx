import { useMemo, useState } from 'react'
import { applyCorrections, undoLast } from '../../lib/db'
import { CardThumb } from '../../components/CardTile'
import { TypeAhead } from '../../components/TypeAhead'
import { useToast } from '../../components/Toast'
import { RARITY_LABEL, setLabel, useCards, useOwned, usePersisted, useSets } from '../../lib/useData'

/** Mise à jour en masse : on cherche une carte, puis on fixe directement sa quantité possédée. */
export default function BulkUpdate() {
  const sets = useSets()
  const cards = useCards()
  const owned = useOwned()
  const toast = useToast()
  const [setId, setSetId] = usePersisted('bulk.setId', '')
  // quantité cible saisie (texte), par carte, dans l'ordre d'ajout
  const [edits, setEdits] = useState<{ id: string; value: string }[]>([])
  const candidates = useMemo(() => cards.filter((c) => !setId || c.setId === setId), [cards, setId])
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])

  const target = (v: string, from: number) => (v.trim() === '' ? from : Math.max(0, Math.floor(Number(v)) || 0))
  const changed = edits.filter((e) => target(e.value, owned.get(e.id) ?? 0) !== (owned.get(e.id) ?? 0))

  const addCard = (id: string) =>
    setEdits((es) => (es.some((e) => e.id === id) ? es : [{ id, value: String(owned.get(id) ?? 0) }, ...es]))
  const setValue = (id: string, value: string) =>
    setEdits((es) => es.map((e) => (e.id === id ? { ...e, value: value.replace(/\D/g, '') } : e)))
  const step = (id: string, d: number) =>
    setEdits((es) => es.map((e) => (e.id === id ? { ...e, value: String(Math.max(0, target(e.value, owned.get(id) ?? 0) + d)) } : e)))

  const save = async () => {
    const ev = await applyCorrections(changed.map((e) => ({ cardId: e.id, to: target(e.value, owned.get(e.id) ?? 0) })))
    setEdits([])
    toast(ev ? `${changed.length} carte(s) mise(s) à jour` : 'Rien à changer', ev ? { label: 'Annuler', run: () => void undoLast() } : undefined)
  }

  return (
    <>
      <select className="input" aria-label="Extension" value={setId} onChange={(e) => setSetId(e.target.value)}>
        <option value="">Toutes les extensions</option>
        {sets.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}
      </select>
      <div className="sticky-top">
        <TypeAhead cards={candidates} owned={owned} onPick={(c) => addCard(c.id)} placeholder="Carte à corriger (nom ou numéro)…" />
      </div>
      {edits.map((e) => {
        const c = byId.get(e.id)
        if (!c) return null
        const from = owned.get(e.id) ?? 0
        const to = target(e.value, from)
        return (
          <div key={e.id} className={'bulkrow' + (to !== from ? ' changed' : '')}>
            <CardThumb card={c} />
            <span className="grow"><b>{c.name}</b><br /><small className="muted">{c.id} · {RARITY_LABEL[c.rarity]} · actuel {from}</small></span>
            <button className="btn" onClick={() => step(e.id, -1)} aria-label="Moins">−</button>
            <input inputMode="numeric" aria-label={`Quantité ${c.name}`} value={e.value} onFocus={(ev) => ev.target.select()} onChange={(ev) => setValue(e.id, ev.target.value)} />
            <button className="btn" onClick={() => step(e.id, 1)} aria-label="Plus">+</button>
          </div>
        )
      })}
      {!edits.length && <p className="muted">Tapez un nom, choisissez la carte, puis saisissez la quantité réelle.</p>}
      <div className="row">
        <button className="btn ghost" disabled={!edits.length} onClick={() => setEdits([])}>Vider</button>
        <button className="btn primary big" disabled={!changed.length} onClick={save}>Enregistrer ({changed.length})</button>
      </div>
    </>
  )
}
