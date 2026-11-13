import { useState } from 'react'
import { EmptyState } from '../../components/PageHeader'
import { ActionButton } from '../../components/PageKit'
import { Icon } from '../../components/Icon'
import { share, onUndoError, undoLast } from '../../lib/db'
import { CardPicker } from '../../components/CardPicker'
import { CardTile } from '../../components/CardTile'
import { useToast } from '../../components/Toast'
import { useOwned } from '../../lib/useData'
import { canShareCard } from '../../lib/ops'
import type { Card } from '../../lib/types'
import { RecentHistory } from '../history/RecentHistory'

export function SharePanel({ friend }: { friend: string }) {
  const owned = useOwned()
  const toast = useToast()
  const [dir, setDir] = useState<'given' | 'received'>('given')
  const [card, setCard] = useState<Card | null>(null)
  const [picking, setPicking] = useState(false)
  const qty = card ? owned.get(card.id) ?? 0 : 0
  const ok = card && (dir === 'received' || canShareCard(card.rarity, qty))

  const confirm = async () => {
    if (!card) return
    try {
      await share(card.id, dir, friend.trim())
      toast(dir === 'given' ? `Donné : ${card.name}` : `Reçu : ${card.name}`, { label: 'Annuler', run: () => void undoLast().catch(onUndoError(toast)) })
      setCard(null)
    } catch (e) { toast((e as Error).message) }
  }

  return (
    <>
      <div className="seg">
        <button className={dir === 'given' ? 'on' : ''} onClick={() => { setDir('given'); setCard(null) }}><Icon name="gift" />Je donne</button>
        <button className={dir === 'received' ? 'on' : ''} onClick={() => { setDir('received'); setCard(null) }}><Icon name="inbox" />Je reçois</button>
      </div>
      {card ? (
        <div className="pick-result card">
          <CardTile card={card} count={qty} showName />
          <p>Possédées : <b>{qty}</b>{dir === 'given' && card && !canShareCard(card.rarity, qty) && <span className="warn"> — D1–D4 en au moins 2 exemplaires</span>}</p>
        </div>
      ) : <EmptyState icon="cards" title="Aucune carte choisie" text="Choisis la carte donnée ou reçue pour continuer." />}
      <div className="row">
        <button className="btn big" onClick={() => setPicking(true)}><Icon name="search" />{card ? 'Changer de carte' : 'Choisir une carte'}</button>
        <ActionButton className="btn primary big" disabled={!ok} hint={card ? 'Moins de 2 exemplaires' : 'Choisis une carte'} onClick={confirm}><Icon name="check" />Confirmer</ActionButton>
      </div>
      <RecentHistory kind="share" />
      {picking && (
        <CardPicker title={dir === 'given' ? 'Carte à donner (D1–D4, ≥ 2 ex.)' : 'Carte reçue'} onClose={() => setPicking(false)}
          allow={dir === 'given' ? (c, q) => canShareCard(c.rarity, q) : undefined} hideDisallowed={dir === 'given'}
          onPick={(c) => { setCard(c); setPicking(false) }} />
      )}
    </>
  )
}
