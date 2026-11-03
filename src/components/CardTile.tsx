import { memo, useState } from 'react'
import { cardImageUrl } from '../lib/db'
import { RARITY_LABEL } from '../lib/useData'
import type { Card } from '../lib/types'

interface Props {
  card: Card
  /** Badge de quantité (possédée ou compteur de saisie). */
  count?: number
  dim?: boolean
  disabled?: boolean
  onClick?: () => void
  onMinus?: () => void
  showName?: boolean
}

export const CardTile = memo(function CardTile({ card, count, dim, disabled, onClick, onMinus, showName }: Props) {
  const [broken, setBroken] = useState(false)
  return (
    <div className={'tile' + (dim ? ' dim' : '') + (disabled ? ' disabled' : '')}>
      <button className="tile-main" onClick={disabled ? undefined : onClick} aria-label={`${card.name} ${card.id}`} disabled={disabled}>
        {broken ? (
          <span className="tile-fallback">
            <b>{card.name}</b>
            <small>{card.id}</small>
            <small>{RARITY_LABEL[card.rarity]}</small>
          </span>
        ) : (
          <img src={cardImageUrl(card)} alt={card.name} loading="lazy" decoding="async" onError={() => setBroken(true)} />
        )}
        {showName && <span className="tile-name">{card.name}</span>}
      </button>
      {count !== undefined && count > 0 && <span className="badge">{count}</span>}
      {onMinus && count !== undefined && count > 0 && (
        <button className="minus" onClick={onMinus} aria-label="Retirer une carte">−</button>
      )}
    </div>
  )
})
