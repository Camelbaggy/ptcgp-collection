import { useMemo, useState } from 'react'
import EventDetail from './EventDetail'
import { cardImageUrl } from '../../lib/db'
import { ASSET_BASE } from '../../lib/native/platform'
import { useCardById, useCards, useOwned, useSets } from '../../lib/useData'
import type { GameEvent } from '../../lib/events/parse'
import { translateEventName } from '../../lib/events/translate'
import { shortEventName } from '../../lib/events/display'
import { ListRow } from '../../components/PageKit'
import { TYPE_INFO, daysUntil, dayShortFr, duration, phase } from './format'
import { Icon } from '../../components/Icon'
import './events.css'

export function TypeBadge({ type }: { type: GameEvent['type'] }) {
  const t = TYPE_INFO[type]
  return <span className={`ev-type ev-${type}`}><Icon name={t.icon} />{t.label}</span>
}

/** Vignette d'une ligne : image de l'évènement, sinon première carte à l'affiche, sinon icône de la catégorie. */
function Thumb({ e }: { e: GameEvent }) {
  const [broken, setBroken] = useState(false)
  const byId = useCardById()
  const card = e.cardIds?.length ? byId.get(e.cardIds[0]) : undefined
  const fallback = <span className={`ev-thumb ev-fallback ev-${e.type}`} aria-hidden><Icon name={TYPE_INFO[e.type].icon} /></span>
  if (broken) return fallback
  if (e.image) return <img className="ev-thumb" src={ASSET_BASE + e.image} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
  if (card) return <img className="ev-thumb ev-thumb-card" src={cardImageUrl(card)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
  return fallback
}

export function CardThumb({ card, qty }: { card: Parameters<typeof cardImageUrl>[0] & { name: string }; qty: number }) {
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
  const owned = useOwned()
  const byId = useCardById()
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

/** Ligne d'évènement (une ligne de liste) : vignette, nom court, temps restant, catégorie à droite. Le détail est dans la fiche. */
export function EventRow({ e, now }: { e: GameEvent; now: number }) {
  const p = phase(e, now)
  const { label, title } = useEventName(e)
  const owned = useOwned()
  const [open, setOpen] = useState(false)
  const short = e.type === 'expansion' ? label : shortEventName(label)
  const time = p === 'live' ? duration(Date.parse(e.end) - now) : p === 'soon' ? `dans ${duration(Date.parse(e.start) - now)}` : 'terminé'
  const have = e.cardIds?.length ? e.cardIds.filter((id) => (owned.get(id) ?? 0) > 0).length : 0
  return (
    <li className={`ev-row ev-${p}`}>
      <ListRow
        thumb={<Thumb e={e} />}
        title={<span title={title}>{short}</span>}
        sub={<><span className={'ev-time' + (p === 'live' ? ' live' : '')}>{time}</span>{e.cardIds?.length ? ` · ${have}/${e.cardIds.length} cartes` : ''}</>}
        right={<TypeBadge type={e.type} />}
        onClick={() => setOpen(true)}
        label={`Détails : ${label}`}
      />
      {open && <EventDetail e={e} now={now} onClose={() => setOpen(false)} />}
    </li>
  )
}

/** Une ligne : « C2 dans 34 jours » et la date courte. */
export function ExpansionCountdown({ e, now }: { e: GameEvent; now: number }) {
  const n = daysUntil(e.start, now)
  const text = n <= 0 ? `${e.name} sort aujourd'hui` : `${e.name} dans ${n} jour${n > 1 ? 's' : ''}`
  return (
    <aside className="ev-countdown" aria-label="Prochaine extension">
      <b>{text}</b><span>{dayShortFr(e.start)}</span>
    </aside>
  )
}
