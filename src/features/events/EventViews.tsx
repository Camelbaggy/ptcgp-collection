import { useMemo, useState } from 'react'
import EventDetail from './EventDetail'
import { cardImageUrl, BASE } from '../../lib/db'
import { useCards, useOwned, useSets } from '../../lib/useData'
import type { GameEvent } from '../../lib/events/parse'
import { translateEventName } from '../../lib/events/translate'
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

function CardThumb({ card, qty }: { card: Parameters<typeof cardImageUrl>[0] & { name: string }; qty: number }) {
  const [broken, setBroken] = useState(false)
  const have = qty > 0
  const cls = 'ev-card' + (have ? ' have' : ' miss')
  const title = `${card.name} · ${card.id}${have ? ` (×${qty})` : ' (manquante)'}`
  const inner = broken
    ? <span className={cls + ' ev-card-fb'} title={title}>{card.id}</span>
    : <img className={cls} src={cardImageUrl(card)} alt={title} title={title} loading="lazy" onError={() => setBroken(true)} />
  return <span className="ev-cardwrap">{inner}<span className={'ev-qty' + (have ? '' : ' miss')} aria-hidden>{have ? `×${qty}` : '!'}</span></span>
}

/** Cartes à l'affiche d'un évènement : les manquantes sont mises en avant. */
export function Featured({ ids, detail }: { ids: string[]; detail?: boolean }) {
  const cards = useCards()
  const owned = useOwned()
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const list = ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c)
  if (!list.length) return null
  const missing = list.filter((c) => (owned.get(c.id) ?? 0) === 0).length
  return (
    <span className="ev-cards">
      <small className={missing ? 'ev-miss' : 'muted'}>{missing ? `${missing} carte${missing > 1 ? 's' : ''} manquante${missing > 1 ? 's' : ''} sur ${list.length}` : `Tu as déjà les ${list.length} cartes`}</small>
      <span className={detail ? 'ev-cardrow wrap' : 'ev-cardrow'}>
        {[...list].sort((a, b) => (owned.get(a.id) ?? 0) - (owned.get(b.id) ?? 0)).map((c) => <CardThumb key={c.id} card={c} qty={owned.get(c.id) ?? 0} />)}
      </span>
    </span>
  )
}

/** Nom français (traduit au mieux) ; les extensions ont déjà un nom français. */
function useEventName(e: GameEvent): { label: string; title?: string } {
  const sets = useSets()
  const cards = useCards()
  const ctx = useMemo(() => ({ sets, cards }), [sets, cards])
  if (e.type === 'expansion') return { label: e.name }
  const label = translateEventName(e.name, ctx)
  return { label, title: label !== e.name ? e.name : undefined }
}

export function EventRow({ e, now }: { e: GameEvent; now: number }) {
  const p = phase(e, now)
  const { label, title } = useEventName(e)
  const [open, setOpen] = useState(false)
  return (
    <li className={`ev-row ev-${p}`}>
      <button type="button" className="ev-rowbtn" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Détails : ${label}`}>
        <Thumb e={e} />
        <span className="ev-main">
          <span className="ev-top"><TypeBadge type={e.type} />{'source' in e && e.source === 'pokemon-zone' && <span className="ev-src">Pokemon-Zone</span>}</span>
          <b className="ev-name" title={title}>{label}</b>
          <span className={'ev-time' + (p === 'live' ? ' live' : '')}>{timeLabel(e, now)}</span>
          <small className="muted">{rangeFr(e)}</small>
          {e.rewards?.length ? <small className="muted">{e.rewards.join(' · ')}</small> : null}
          {e.cardIds?.length ? <Featured ids={e.cardIds} /> : null}
        </span>
      </button>
      {open && <EventDetail e={e} now={now} onClose={() => setOpen(false)} />}
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
