import { useState } from 'react'
import { share, undoLast } from '../../lib/db'
import { CardPicker } from '../../components/CardPicker'
import { CardTile } from '../../components/CardTile'
import { useToast } from '../../components/Toast'
import { useOwned, usePersisted } from '../../lib/useData'
import { canGive } from '../../lib/ops'
import type { Card } from '../../lib/types'

export default function Share() {
  const owned = useOwned()
  const toast = useToast()
  const [dir, setDir] = useState<'given' | 'received'>('given')
  const [friend, setFriend] = usePersisted('friend', '')
  const [card, setCard] = useState<Card | null>(null)
  const [picking, setPicking] = useState(false)
  const qty = card ? owned.get(card.id) ?? 0 : 0
  const ok = card && (dir === 'received' || canGive(qty))

  const confirm = async () => {
    if (!card) return
    try {
      await share(card.id, dir, friend.trim())
      toast(dir === 'given' ? `Donné : ${card.name}` : `Reçu : ${card.name}`, { label: 'Annuler', run: () => void undoLast() })
      setCard(null)
    } catch (e) { toast((e as Error).message) }
  }

  return (
    <div className="page">
      <h1>Partage</h1>
      <div className="seg">
        <button className={dir === 'given' ? 'on' : ''} onClick={() => { setDir('given'); setCard(null) }}>Je donne</button>
        <button className={dir === 'received' ? 'on' : ''} onClick={() => { setDir('received'); setCard(null) }}>Je reçois</button>
      </div>
      <input className="input" placeholder="Ami (facultatif)" value={friend} onChange={(e) => setFriend(e.target.value)} />
      {card ? (
        <div className="pick-result">
          <CardTile card={card} count={qty} showName />
          <p>Possédées : <b>{qty}</b>{dir === 'given' && !canGive(qty) && <span className="warn"> — il faut au moins 2 exemplaires</span>}</p>
        </div>
      ) : <p className="muted">Choisissez une carte.</p>}
      <div className="row">
        <button className="btn big" onClick={() => setPicking(true)}>{card ? 'Changer de carte' : 'Choisir une carte'}</button>
        <button className="btn primary big" disabled={!ok} onClick={confirm}>Confirmer</button>
      </div>
      {picking && (
        <CardPicker title={dir === 'given' ? 'Carte à donner (≥ 2 ex.)' : 'Carte reçue'} onClose={() => setPicking(false)}
          allow={dir === 'given' ? (_c, q) => canGive(q) : undefined} hideDisallowed={dir === 'given'}
          onPick={(c) => { setCard(c); setPicking(false) }} />
      )}
    </div>
  )
}
