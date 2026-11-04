import { BoosterBadge, SetBadge } from './Brand'
import { Sheet } from './Sheet'
import { CardTile } from './CardTile'
import { setOwned, setWish } from '../lib/db'
import { RARITY_LABEL, useBoosters, useWishlist } from '../lib/useData'
import type { Card } from '../lib/types'

export function CardDetail({ card, qty, onClose }: { card: Card; qty: number; onClose: () => void }) {
  const boosters = useBoosters()
  const wish = useWishlist().find((w) => w.cardId === card.id)
  return (
    <Sheet title={card.name} onClose={onClose}>
      <div className="detail">
        <CardTile card={card} />
        <dl>
          <dt>Extension</dt><dd><SetBadge setId={card.setId} /></dd>
          <dt>Identifiant</dt><dd>{card.id}</dd>
          <dt>Rareté</dt><dd>{RARITY_LABEL[card.rarity]} ({card.rarity})</dd>
          {card.type && <><dt>Type</dt><dd>{card.type}</dd></>}
          <dt>Boosters</dt><dd className="bb-list">{card.boosterIds.length ? card.boosterIds.map((id) => { const b = boosters.find((x) => x.id === id); return <BoosterBadge key={id} boosterId={id} setId={b?.setId ?? card.setId} logo={false} text={b?.name ?? id} /> }) : '—'}</dd>
        </dl>
      </div>
      <div className="stepper">
        <button className="btn big" onClick={() => setOwned(card.id, qty - 1)} disabled={qty <= 0} aria-label="Moins">−</button>
        <input className="qty-input" inputMode="numeric" aria-label="Quantité" value={qty} onFocus={(e) => e.target.select()}
          onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '')); void setOwned(card.id, n) }} />
        <button className="btn big" onClick={() => setOwned(card.id, qty + 1)} aria-label="Plus">+</button>
      </div>
      <div className="row">
        <button className={'btn big' + (wish ? ' primary' : '')} onClick={() => setWish(card.id, wish ? null : 2)}>
          {wish ? '♥ Dans les souhaits' : '♡ Ajouter aux souhaits'}
        </button>
      </div>
    </Sheet>
  )
}
