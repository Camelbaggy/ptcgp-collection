import { useMemo, useState } from 'react'
import type { EventType } from '../../lib/events/parse'
import { usePersisted } from '../../lib/useData'
import { Icon } from '../../components/Icon'
import { EmptyState, PageHeader, SectionHead } from '../../components/PageHeader'
import EventCalendar from './EventCalendar'
import { EventRow, ExpansionCountdown } from './EventViews'
import { TYPE_INFO, TYPE_ORDER, phase } from './format'
import PzImport from './PzImport'
import { isNative } from '../../lib/native/holoNative'
import { useEvents, useNow } from './useEvents'

export default function Events() {
  const { events, importedCount, loading } = useEvents()
  const now = useNow()
  const [filter, setFilter] = usePersisted<EventType | 'all'>('events-filter', 'all')
  const [view, setView] = usePersisted<'list' | 'cal'>('events-view', 'list')
  const [showPast, setShowPast] = useState(false)
  const v = useMemo(() => {
    const all = events.filter((e) => filter === 'all' || e.type === filter)
    const by = (p: string) => all.filter((e) => phase(e, now) === p)
    return {
      next: events.filter((e) => e.type === 'expansion' && phase(e, now) === 'soon').sort((a, b) => a.start.localeCompare(b.start))[0],
      live: by('live').sort((a, b) => a.end.localeCompare(b.end)),
      soon: by('soon').sort((a, b) => a.start.localeCompare(b.start)),
      past: by('past').sort((a, b) => b.end.localeCompare(a.end)),
    }
  }, [events, filter, now])

  const calEvents = useMemo(() => events.filter((e) => filter === 'all' || e.type === filter), [events, filter])

  return (
    <div className="page" data-section="yellow">
      <PageHeader icon="cal" title="Évènements" sub="Drops, Wonder Pick, missions et prochaines extensions" />
      <PzImport />
      {loading ? <p className="muted">Chargement…</p> : !importedCount ? (
        <>
          {v.next && <ExpansionCountdown e={v.next} now={now} />}
          <EmptyState icon="cal" title="Aucun évènement pour l'instant" text={isNative ? <>Touche « Synchroniser avec Pokémon-Zone » ci-dessus.</> : <>Utilise « Import .html Pokemon-Zone » ci-dessus (aide : « ? »).</>} />
        </>
      ) : (
        <>
          {v.next && <ExpansionCountdown e={v.next} now={now} />}
          <div className="chips scroll ev-filter" role="group" aria-label="Filtrer par type">
            <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>Tous</button>
            {TYPE_ORDER.map((t) => (
              <button key={t} className={'chip' + (filter === t ? ' on' : '')} onClick={() => setFilter(t)}><Icon name={TYPE_INFO[t].icon} />{TYPE_INFO[t].label}</button>
            ))}
          </div>
          <div className="chips ev-view" role="group" aria-label="Affichage">
            <button className={'chip' + (view === 'list' ? ' on' : '')} aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="grid" />Liste</button>
            <button className={'chip' + (view === 'cal' ? ' on' : '')} aria-pressed={view === 'cal'} onClick={() => setView('cal')}><Icon name="cal" />Calendrier</button>
          </div>
          {view === 'cal' ? <EventCalendar events={calEvents} now={now} /> : <>
          <SectionHead icon="bolt" title="En cours" />
          {v.live.length ? <ul className="ev-list">{v.live.map((e) => <EventRow key={e.id} e={e} now={now} />)}</ul> : <p className="ptc-empty">Aucun évènement en cours.</p>}
          <SectionHead icon="clock" title="À venir" />
          {v.soon.length ? <ul className="ev-list">{v.soon.map((e) => <EventRow key={e.id} e={e} now={now} />)}</ul> : <p className="ptc-empty">Rien d'annoncé pour l'instant.</p>}
          <SectionHead icon="history" title="Terminés récemment" />
          {v.past.length ? (
            showPast ? <ul className="ev-list">{v.past.map((e) => <EventRow key={e.id} e={e} now={now} />)}</ul>
              : <button className="btn" onClick={() => setShowPast(true)}>Afficher les {v.past.length} évènements terminés</button>
          ) : <p className="ptc-empty">Aucun.</p>}
          </>}
          <p className="muted"><small>Source : Pokémon-Zone{isNative ? '' : ' (import manuel)'}. Horaires affichés dans ton fuseau horaire ; évènements terminés depuis plus de 30 jours masqués.</small></p>
        </>
      )}
    </div>
  )
}
