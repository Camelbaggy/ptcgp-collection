import { CardThumb } from '../../components/CardTile'
import type { Card } from '../../lib/types'
import type { MetaDeck } from '../../lib/meta/compute'
import type { PmDeck } from '../../lib/pocketMads/types'
import { delta1, pct1, score1 } from './useMeta'

/** Une ligne de la tier list : chiffres PocketMads, nom français et icônes tirés de Limitless. */
export function DeckRow({ pm, deck, cardById, onOpen }: { pm: PmDeck; deck: MetaDeck | null; cardById: Map<string, Card>; onOpen: () => void }) {
  return (
    <li>
      <button className="meta-row" onClick={onOpen}>
        <span className="meta-icons">
          {deck?.iconCardIds.slice(0, 2).map((id) => cardById.get(id) && <CardThumb key={id} card={cardById.get(id)!} />)}
        </span>
        <span className="meta-main">
          <b>{deck?.nameFr ?? pm.name}</b>
          <small>{pm.games !== undefined ? `${pm.games} matchs` : ''}{pm.share !== undefined ? ` · part ${pct1(pm.share)}` : ''}{pm.shift ? ' · change de tier' : ''}</small>
        </span>
        {pm.winRate !== undefined && <span className="meta-num"><b className={pm.winRate >= 0.5 ? 'ok' : 'warn'}>{pct1(pm.winRate)}</b><small>victoires</small></span>}
        {pm.score !== undefined && (
          <span className="meta-num meta-score"><b>{score1(pm.score)}</b><small className={pm.delta ? (pm.delta > 0 ? 'ok' : 'warn') : undefined}>{pm.delta ? delta1(pm.delta) : 'score'}</small></span>
        )}
      </button>
    </li>
  )
}
