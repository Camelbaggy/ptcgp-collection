import type { HistoryEvent } from '../lib/types'
import { BoosterEmblem, SetBadge } from './Brand'

/** Logo(s) d'un évènement d'historique : pack = logo + emblème ; partage/échange/correction = logo(s) des cartes. */
export function EventBadge({ e, setOf }: { e: HistoryEvent; setOf?: (cardId: string) => string | undefined }) {
  const of = (id: string) => setOf?.(id) ?? id.split('-')[0]
  if (e.kind === 'pack') {
    return <span className="ev-badges"><SetBadge setId={e.boosterId.split('-')[0]} /><BoosterEmblem boosterId={e.boosterId} small /></span>
  }
  const ids = e.kind === 'share' ? [of(e.cardId)]
    : e.kind === 'trade' ? [of(e.given), of(e.received)]
    : e.changes.map((c) => of(c.cardId))
  const uniq = [...new Set(ids)].slice(0, 2)
  return <span className="ev-badges">{uniq.map((s) => <SetBadge key={s} setId={s} />)}</span>
}
