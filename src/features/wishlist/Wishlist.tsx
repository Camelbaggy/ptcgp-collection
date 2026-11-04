import { useState } from 'react'
import { setWish } from '../../lib/db'
import { CardPicker } from '../../components/CardPicker'
import { SetBadge } from '../../components/Brand'
import { CardTile } from '../../components/CardTile'
import { useCards, useOwned, useWishlist } from '../../lib/useData'

const PRIO = [{ v: 1, l: 'Haute' }, { v: 2, l: 'Moyenne' }, { v: 3, l: 'Basse' }]

export default function WishlistScreen() {
  const wishes = useWishlist()
  const cards = useCards()
  const owned = useOwned()
  const [adding, setAdding] = useState(false)
  const rows = wishes
    .map((w) => ({ w, c: cards.find((c) => c.id === w.cardId) }))
    .filter((r) => r.c)
    .sort((a, b) => a.w.priority - b.w.priority)
  return (
    <div className="page">
      <h1>Souhaits</h1>
      <button className="btn primary big" onClick={() => setAdding(true)}>Ajouter une carte visée</button>
      {!rows.length && <p className="muted">Aucune carte visée pour l'instant.</p>}
      <ul className="list">
        {rows.map(({ w, c }) => (
          <li key={w.cardId} className="wish">
            <CardTile card={c!} count={owned.get(w.cardId)} dim={!owned.get(w.cardId)} />
            <div className="grow">
              <b>{c!.name}</b><br /><span className="with-icon"><SetBadge setId={c!.setId} className="mini" /><small className="muted">{c!.id}</small></span>
              <select className="input" value={w.priority} onChange={(e) => setWish(w.cardId, Number(e.target.value))} aria-label="Priorité">
                {PRIO.map((p) => <option key={p.v} value={p.v}>Priorité {p.l.toLowerCase()}</option>)}
              </select>
            </div>
            <button className="btn ghost" onClick={() => setWish(w.cardId, null)} aria-label="Retirer">✕</button>
          </li>
        ))}
      </ul>
      {adding && (
        <CardPicker title="Carte visée" onClose={() => setAdding(false)}
          onPick={(c) => { void setWish(c.id, 2); setAdding(false) }} />
      )}
    </div>
  )
}
