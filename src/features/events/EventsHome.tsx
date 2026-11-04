import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { EventRow, ExpansionCountdown } from './EventViews'
import { phase } from './format'
import { useEvents, useNow } from './useEvents'

/** Section « Évènements » de l'accueil : prochaine extension, en cours, à venir. */
export default function EventsHome() {
  const { events } = useEvents()
  const now = useNow()
  const v = useMemo(() => {
    if (!events) return null
    const reg = events.filter((e) => e.type !== 'expansion')
    return {
      next: events.filter((e) => e.type === 'expansion' && Date.parse(e.start) >= now).sort((a, b) => a.start.localeCompare(b.start))[0],
      live: reg.filter((e) => phase(e, now) === 'live').sort((a, b) => a.end.localeCompare(b.end)),
      soon: reg.filter((e) => phase(e, now) === 'soon').sort((a, b) => a.start.localeCompare(b.start)),
    }
  }, [events, now])
  if (!v) return null
  return (
    <section aria-label="Évènements">
      {v.next && <ExpansionCountdown e={v.next} now={now} />}
      <div className="ev-head"><h2>Évènements</h2><Link to="/evenements">Programme complet</Link></div>
      <h3 className="ev-sub">En cours</h3>
      {v.live.length ? <ul className="ev-list">{v.live.map((e) => <EventRow key={e.id} e={e} now={now} />)}</ul> : <p className="ptc-empty">Aucun évènement en cours.</p>}
      <h3 className="ev-sub">À venir</h3>
      {v.soon.length ? <ul className="ev-list">{v.soon.slice(0, 4).map((e) => <EventRow key={e.id} e={e} now={now} />)}</ul> : <p className="ptc-empty">Rien d'annoncé pour l'instant.</p>}
    </section>
  )
}
