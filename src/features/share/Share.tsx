import { useState } from 'react'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import { share, undoLast } from '../../lib/db'
import { CardPicker } from '../../components/CardPicker'
import { CardTile } from '../../components/CardTile'
import { useToast } from '../../components/Toast'
import { useOwned, usePersisted } from '../../lib/useData'
import { canShareCard } from '../../lib/ops'
import type { Card } from '../../lib/types'

export default function Share() {
  const owned = useOwned()
  const toast = useToast()
  const [dir, setDir] = useState<'given' | 'received'>('given')
  const [friend, setFriend] = usePersisted('friend', '')
  const [card, setCard] = useState<Card | null>(null)
  const [picking, setPicking] = useState(false)
  const qty = card ? owned.get(card.id) ?? 0 : 0
  const ok = card && (dir === 'received' || canShareCard(card.rarity, qty))

  const confirm = async () => {
    if (!card) return
    try {
      await share(card.id, dir, friend.trim())
      toast(dir === 'given' ? `Donné : ${card.name}` : `Reçu : ${card.name}`, { label: 'Annuler', run: () => void undoLast() })
      setCard(null)
    } catch (e) { toast((e as Error).message) }
  }

  return (
    <div className="page" data-section="pink">
      <PageHeader icon="gift" title="Partage" sub="Donne ou reçois une carte d'un ami" />
      <div className="seg">
        <button className={dir === 'given' ? 'on' : ''} onClick={() => { setDir('given'); setCard(null) }}><Icon name="gift" />Je donne</button>
        <button className={dir === 'received' ? 'on' : ''} onClick={() => { setDir('received'); setCard(null) }}><Icon name="inbox" />Je reçois</button>
      </div>
      <input className="input" aria-label="Ami" placeholder="Ami (facultatif)" value={friend} onChange={(e) => setFriend(e.target.value)} />
      {card ? (
        <div className="pick-result card">
          <CardTile card={card} count={qty} showName />
          <p>Possédées : <b>{qty}</b>{dir === 'given' && card && !canShareCard(card.rarity, qty) && <span className="warn"> — D1–D4 en au moins 2 exemplaires</span>}</p>
        </div>
      ) : <EmptyState icon="cards" title="Aucune carte choisie" text="Choisis la carte donnée ou reçue pour continuer." />}
      <div className="row">
        <button className="btn big" onClick={() => setPicking(true)}><Icon name="search" />{card ? 'Changer de carte' : 'Choisir une carte'}</button>
        <button className="btn primary big" disabled={!ok} onClick={confirm}><Icon name="check" />Confirmer</button>
      </div>
      {picking && (
        <CardPicker title={dir === 'given' ? 'Carte à donner (D1–D4, ≥ 2 ex.)' : 'Carte reçue'} onClose={() => setPicking(false)}
          allow={dir === 'given' ? (c, q) => canShareCard(c.rarity, q) : undefined} hideDisallowed={dir === 'given'}
          onPick={(c) => { setCard(c); setPicking(false) }} />
      )}
    </div>
  )
}
