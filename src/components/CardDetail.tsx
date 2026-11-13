import { useState } from 'react'
import { createPortal } from 'react-dom'
import { BoosterBadge, SetBadge } from './Brand'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
import { CardTile } from './CardTile'
import { setOwned, setWish } from '../lib/db'
import { Rarity } from './Rarity'
import { cardImageUrl } from '../lib/db'
import { useBoosters, useWishlist } from '../lib/useData'
import type { Card } from '../lib/types'

export function CardDetail({ card, qty, onClose }: { card: Card; qty: number; onClose: () => void }) {
  const boosters = useBoosters()
  const [zoom, setZoom] = useState(false)
  const wish = useWishlist().find((w) => w.cardId === card.id)
  return (
    <Sheet title={card.name} onClose={onClose}>
      <div className="detail">
        <CardTile card={card} onClick={() => setZoom(true)} />
        <dl>
          <dt>Extension</dt><dd><SetBadge setId={card.setId} /></dd>
          <dt>Identifiant</dt><dd>{card.id}</dd>
          <dt>Rareté</dt><dd><Rarity r={card.rarity} /></dd>
          {card.type && <><dt>Type</dt><dd>{card.type}</dd></>}
          <dt>Boosters</dt><dd className="bb-list">{card.boosterIds.length ? card.boosterIds.map((id) => { const b = boosters.find((x) => x.id === id); return <BoosterBadge key={id} boosterId={id} setId={b?.setId ?? card.setId} logo={false} text={b?.name ?? id} /> }) : '—'}</dd>
        </dl>
      </div>
      <div className="stepper">
        <button className="btn big" onClick={() => setOwned(card.id, qty - 1)} disabled={qty <= 0} aria-label="Moins"><Icon name="minus" /></button>
        <input className="qty-input" inputMode="numeric" aria-label="Quantité" value={qty} onFocus={(e) => e.target.select()}
          onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '')); void setOwned(card.id, n) }} />
        <button className="btn big" onClick={() => setOwned(card.id, qty + 1)} aria-label="Plus"><Icon name="plus" /></button>
      </div>
      <div className="row">
        <button className={'btn big' + (wish ? ' primary' : '')} onClick={() => setWish(card.id, wish ? null : 2)}>
          <Icon name={wish ? 'heartfill' : 'heart'} />{wish ? 'Dans les souhaits' : 'Ajouter aux souhaits'}
        </button>
      </div>
      {zoom && createPortal(
        <div className="card-zoom" role="dialog" aria-modal="true" aria-label={card.name} onClick={() => setZoom(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setZoom(false) } }}>
          <button className="btn ghost card-zoom-x" aria-label="Fermer" autoFocus onClick={() => setZoom(false)}><Icon name="close" /></button>
          <img src={cardImageUrl(card)} alt={card.name} />
        </div>, document.body,
      )}
    </Sheet>
  )
}
