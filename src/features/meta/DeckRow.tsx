import { CardThumb } from '../../components/CardTile'
import type { Card } from '../../lib/types'
import type { DeckStats, MetaDeck } from '../../lib/meta/compute'
import { delta1, pct1, score1 } from './useMeta'

export function DeckRow({ deck, stats, cardById, onOpen }: { deck: MetaDeck; stats: DeckStats; cardById: Map<string, Card>; onOpen: () => void }) {
  return (
    <li>
      <button className="meta-row" onClick={onOpen}>
        <span className="meta-icons">
          {deck.iconCardIds.slice(0, 2).map((id) => cardById.get(id) && <CardThumb key={id} card={cardById.get(id)!} />)}
        </span>
        <span className="meta-main">
          <b>{deck.nameFr}</b>
          <small>{stats.games} matchs · part {pct1(stats.share)}</small>
        </span>
        <span className="meta-num"><b className={stats.winRate >= 0.5 ? 'ok' : 'warn'}>{pct1(stats.winRate)}</b><small>victoires</small></span>
        <span className="meta-num meta-score"><b>{score1(stats.score)}</b><small className={stats.delta ? (stats.delta > 0 ? 'ok' : 'warn') : undefined}>{stats.delta ? delta1(stats.delta) : 'score'}</small></span>
      </button>
    </li>
  )
}
