import { useMemo, useState } from 'react'
import { cardImageUrl, BASE } from '../../lib/db'
import { useCards, useOwned } from '../../lib/useData'
import type { GameEvent } from '../../lib/events/parse'
import { TYPE_INFO, dateTimeFr, daysUntil, dayFr, phase, rangeFr, timeLabel } from './format'
import './events.css'

export function TypeBadge({ type }: { type: GameEvent['type'] }) {
  const t = TYPE_INFO[type]
  return <span className={`ev-type ev-${type}`}><span aria-hidden>{t.icon}</span> {t.label}</span>
}

function Thumb({ e }: { e: GameEvent }) {
  const [broken, setBroken] = useState(false)
  if (!e.image || broken) return <span className={`ev-thumb ev-fallback ev-${e.type}`} aria-hidden>{TYPE_INFO[e.type].icon}</span>
  return <img className="ev-thumb" src={BASE + e.image} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
}

function CardThumb({ card, have }: { card: Parameters<typeof cardImageUrl>[0] & { name: string }; have: boolean }) {
  const [broken, setBroken] = useState(false)
  const cls = 'ev-card' + (have ? ' have' : ' miss')
  const title = `${card.name} · ${card.id}${have ? '' : ' (manquante)'}`
  if (broken) return <span className={cls + ' ev-card-fb'} title={title}>{card.id}</span>
  return <img className={cls} src={cardImageUrl(card)} alt={title} title={title} loading="lazy" onError={() => setBroken(true)} />
}

/** Cartes à l'affiche d'un évènement : les manquantes sont mises en avant. */
function Featured({ ids }: { ids: string[] }) {
  const cards = useCards()
  const owned = useOwned()
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const list = ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c)
  if (!list.length) return null
  const missing = list.filter((c) => (owned.get(c.id) ?? 0) === 0).length
  return (
    <div className="ev-cards">
      <small className={missing ? 'ev-miss' : 'muted'}>{missing ? `${missing} carte${missing > 1 ? 's' : ''} manquante${missing > 1 ? 's' : ''} sur ${list.length}` : `Tu as déjà les ${list.length} cartes`}</small>
      <div className="ev-cardrow">
        {[...list].sort((a, b) => (owned.get(a.id) ?? 0) - (owned.get(b.id) ?? 0)).map((c) => {
          return <CardThumb key={c.id} card={c} have={(owned.get(c.id) ?? 0) > 0} />
        })}
      </div>
    </div>
  )
}

export function EventRow({ e, now }: { e: GameEvent; now: number }) {
  const p = phase(e, now)
  return (
    <li className={`ev-row ev-${p}`}>
      <Thumb e={e} />
      <div className="ev-main">
        <div className="ev-top"><TypeBadge type={e.type} /></div>
        <b className="ev-name">{e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.name}</a> : e.name}</b>
        <span className={'ev-time' + (p === 'live' ? ' live' : '')}>{timeLabel(e, now)}</span>
        <small className="muted">{rangeFr(e)}</small>
        {e.cardIds?.length ? <Featured ids={e.cardIds} /> : null}
      </div>
    </li>
  )
}

/** Carte « Prochaine extension dans N jours ». */
export function ExpansionCountdown({ e, now }: { e: GameEvent; now: number }) {
  const n = daysUntil(e.start, now)
  const text = n <= 0 ? `${e.name} sort aujourd'hui` : `${e.name} dans ${n} jour${n > 1 ? 's' : ''}`
  return (
    <aside className="ev-countdown" aria-label="Prochaine extension">
      <span className="ev-bigico" aria-hidden>📦</span>
      <div><b>{text}</b><small>{dayFr(e.start)} · {dateTimeFr(e.start).split(' ').slice(-1)[0]}</small></div>
    </aside>
  )
}
