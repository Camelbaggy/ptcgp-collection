import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Fold } from '../../components/Fold'
import { CardThumb } from '../../components/CardTile'
import { useToast } from '../../components/Toast'
import { applyCorrections, db, onUndoError, undoLast } from '../../lib/db'
import { checkOwnedConsistency, type Discrepancy } from '../../lib/sync/rebase'
import type { SyncRow } from '../../lib/sync/merge'
import type { Card } from '../../lib/types'

type Row = Discrepancy & { card?: Card }

/** Réglages : compare les quantités à l'historique (dernière correction + évènements suivants) et propose de corriger. */
export default function ConsistencyCheck() {
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [off, setOff] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const [owned, history] = await Promise.all([db.owned.toArray(), db.history.toArray()])
      const found = checkOwnedConsistency(owned, history as unknown as SyncRow[])
      const cards = await db.cards.bulkGet(found.map((d) => d.cardId))
      setRows(found.map((d, i) => ({ ...d, card: cards[i] })))
      setOff(new Set())
    } finally { setBusy(false) }
  }

  const fix = async () => {
    if (!rows) return
    const todo = rows.filter((r) => !off.has(r.cardId))
    if (!todo.length) return
    setBusy(true)
    try {
      await applyCorrections(todo.map((r) => ({ cardId: r.cardId, to: r.expected })))
      toast(`${todo.length} carte${todo.length > 1 ? 's' : ''} corrigée${todo.length > 1 ? 's' : ''}`, {
        label: 'Annuler', run: () => { void undoLast().then(() => run()).catch(onUndoError(toast)) },
      })
      await run()
    } finally { setBusy(false) }
  }

  const toggle = (id: string, on: boolean) => setOff((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n })
  const chosen = rows ? rows.filter((r) => !off.has(r.cardId)).length : 0

  return (
    <Fold id="consistency" icon="check" color="var(--blue)" title="Vérifier les quantités" className="consistency"
      summary="Compare chaque carte à ton historique">
      <p className="muted">
        Compare chaque carte à sa dernière correction (mise à jour, import Pokémon-Zone, vidéo…) et aux packs, échanges et
        partages saisis depuis. Utile si une ancienne synchro a perdu un ajout. Rien n'est modifié sans ton accord.
      </p>
      <div className="sync-row">
        <button className="btn" disabled={busy} onClick={() => void run()}><Icon name="search" />Vérifier</button>
      </div>
      {rows && !rows.length && <p className="sync-status" role="status">Tout est cohérent.</p>}
      {rows && rows.length > 0 && (
        <>
          <p className="sync-status" role="status">
            {rows.length} carte{rows.length > 1 ? 's' : ''} ne correspond{rows.length > 1 ? 'ent' : ''} pas à l'historique.
          </p>
          <p className="muted">
            Un ajustement fait à la main depuis la fiche d'une carte apparaît aussi ici : décoche les cartes que tu as
            volontairement modifiées.
          </p>
          <ul className="consistency-list">
            {rows.map((r) => (
              <li key={r.cardId}>
                <label className="row check-row">
                  <input type="checkbox" checked={!off.has(r.cardId)} onChange={(e) => toggle(r.cardId, e.target.checked)} />
                  {r.card && <CardThumb card={r.card} />}
                  <span className="consistency-name">
                    {r.card?.name ?? r.cardId}
                    <small className="muted"> {r.cardId} · depuis le {new Date(r.since).toLocaleDateString('fr-FR')}</small>
                  </span>
                  <span className="consistency-q">{r.quantity} <Icon name="chev" /> {r.expected}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="sync-row">
            <button className="btn primary" disabled={busy || !chosen} onClick={() => void fix()}>
              <Icon name="check" />Corriger {chosen} carte{chosen > 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
    </Fold>
  )
}
