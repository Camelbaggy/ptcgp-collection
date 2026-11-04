import { useMemo, useState } from 'react'
import type { EventType } from '../../lib/events/parse'
import { usePersisted } from '../../lib/useData'
import { EventRow, ExpansionCountdown } from './EventViews'
import { TYPE_INFO, TYPE_ORDER, phase } from './format'
import { useEvents, useNow } from './useEvents'

export default function Events() {
  const { events, loading } = useEvents()
  const now = useNow()
  const [filter, setFilter] = usePersisted<EventType | 'all'>('events-filter', 'all')
  const [showPast, setShowPast] = useState(false)
  const v = useMemo(() => {
    const all = (events ?? []).filter((e) => filter === 'all' || e.type === filter)
    const by = (p: string) => all.filter((e) => phase(e, now) === p)
    return {
      next: (events ?? []).filter((e) => e.type === 'expansion' && phase(e, now) === 'soon').sort((a, b) => a.start.localeCompare(b.start))[0],
      live: by('live').sort((a, b) => a.end.localeCompare(b.end)),
      soon: by('soon').sort((a, b) => a.start.localeCompare(b.start)),
      past: by('past').sort((a, b) => b.end.localeCompare(a.end)),
    }
  }, [events, filter, now])

  return (
    <div className="page">
      <h1>Évènements</h1>
      {loading ? <p className="muted">Chargement…</p> : !events ? (
        <p className="ptc-empty">Programme indisponible : il est téléchargé lors du déploiement et n'est pas encore dans cette version de l'application.</p>
      ) : (
        <>
          {v.next && <ExpansionCountdown e={v.next} now={now} />}
          <div className="chips scroll ev-filter" role="group" aria-label="Filtrer par type">
            <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>Tous</button>
            {TYPE_ORDER.map((t) => (
              <button key={t} className={'chip' + (filter === t ? ' on' : '')} onClick={() => setFilter(t)}>{TYPE_INFO[t].icon} {TYPE_INFO[t].label}</button>
            ))}
          </div>
          <h2>En cours</h2>
          {v.live.length ? <ul className="ev-list">{v.live.map((e) => <EventRow key={e.id} e={e} now={now} />)}</ul> : <p className="ptc-empty">Aucun évènement en cours.</p>}
          <h2>À venir</h2>
          {v.soon.length ? <ul className="ev-list">{v.soon.map((e) => <EventRow key={e.id} e={e} now={now} />)}</ul> : <p className="ptc-empty">Rien d'annoncé pour l'instant.</p>}
          <h2>Terminés récemment</h2>
          {v.past.length ? (
            showPast ? <ul className="ev-list">{v.past.map((e) => <EventRow key={e.id} e={e} now={now} />)}</ul>
              : <button className="btn" onClick={() => setShowPast(true)}>Afficher les {v.past.length} évènements terminés</button>
          ) : <p className="ptc-empty">Aucun.</p>}
          <p className="muted"><small>Source : Serebii. Les horaires sont estimés (changement de jour à 06:00 UTC) et affichés dans ton fuseau horaire.</small></p>
        </>
      )}
    </div>
  )
}
