import { useMemo, useState } from 'react'
import { useCards, useSets } from '../../lib/useData'
import type { GameEvent } from '../../lib/events/parse'
import { translateEventName } from '../../lib/events/translate'
import { EmptyState } from '../../components/PageHeader'
import EventDetail from './EventDetail'
import { Icon } from '../../components/Icon'
import { edgeOn } from '../../lib/events/display'
import { TYPE_INFO, TYPE_ORDER } from './format'

const DAY = 86400000
const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Vrai si l'évènement est actif pendant le jour local [d0, d0 + 24 h). Les évènements ponctuels comptent le jour de leur début. */
export function activeOn(e: GameEvent, d0: number, d1: number): boolean {
  const s = Date.parse(e.start), x = Date.parse(e.end)
  return x <= s ? s >= d0 && s < d1 : s < d1 && x > d0
}

/** Cases d'un mois (lundi en premier) : dates locales, avec les jours du mois voisin pour compléter les semaines. */
export function monthCells(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const count = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7) * 7
  return Array.from({ length: count }, (_, i) => new Date(year, month, 1 - lead + i))
}

/** Vue calendrier mensuelle : barres colorées par type, jour sélectionnable, détail au toucher d'un évènement. */
export default function EventCalendar({ events, now }: { events: GameEvent[]; now: number }) {
  const today = new Date(now)
  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [sel, setSel] = useState<number>(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime())
  const [open, setOpen] = useState<GameEvent | null>(null)
  const sets = useSets()
  const cards = useCards()
  const ctx = useMemo(() => ({ sets, cards }), [sets, cards])
  const cells = useMemo(() => monthCells(cur.y, cur.m), [cur])
  const cellEvents = useMemo(
    () => cells.map((d) => { const d0 = d.getTime(), d1 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); return events.filter((e) => activeOn(e, d0, d1)) }),
    [cells, events],
  )
  const cellEdges = useMemo(
    () => cells.map((d, i) => { const d0 = d.getTime(), d1 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); return cellEvents[i].some((e) => edgeOn(e, d0, d1)) }),
    [cells, cellEvents],
  )
  const move = (delta: number) => {
    const n = new Date(cur.y, cur.m + delta, 1)
    setCur({ y: n.getFullYear(), m: n.getMonth() })
  }
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const selIdx = cells.findIndex((d) => d.getTime() === sel)
  const selDate = new Date(sel)
  const selEvents = selIdx >= 0 ? cellEvents[selIdx] : events.filter((e) => activeOn(e, sel, sel + DAY))
  const name = (e: GameEvent) => (e.type === 'expansion' ? e.name : translateEventName(e.name, ctx))

  return (
    <section className="ev-cal" data-content-start="" aria-label="Calendrier des évènements">
      <div className="ev-cal-nav">
        <button className="btn" onClick={() => move(-1)} aria-label="Mois précédent"><Icon name="chevl" /></button>
        <h2 aria-live="polite">{MONTHS[cur.m]} {cur.y}</h2>
        <button className="btn" onClick={() => move(1)} aria-label="Mois suivant"><Icon name="chev" /></button>
      </div>
      <div className="ev-cal-grid" role="grid" aria-label={`${MONTHS[cur.m]} ${cur.y}`}>
        {WEEKDAYS.map((w) => <span key={w} className="ev-cal-wd" role="columnheader">{w}</span>)}
        {cells.map((d, i) => {
          const evs = cellEvents[i]
          const types = TYPE_ORDER.filter((t) => evs.some((e) => e.type === t))
          const edge = cellEdges[i]
          const ms = d.getTime()
          const cls = ['ev-cal-day', d.getMonth() !== cur.m && 'out', ms === todayMs && 'today', ms === sel && 'sel'].filter(Boolean).join(' ')
          return (
            <button key={ms} type="button" role="gridcell" className={cls} onClick={() => setSel(ms)} aria-pressed={ms === sel}
              aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]} : ${evs.length} évènement${evs.length > 1 ? 's' : ''}${edge ? ', un commence ou se termine' : ''}`}>
              <span className="ev-cal-num">{d.getDate()}</span>
              {edge && <span className="ev-cal-edge" aria-hidden />}
              <span className="ev-cal-dots" aria-hidden>
                {types.map((t) => <span key={t} className={`ev-dot ev-c-${t}`} />)}
              </span>
            </button>
          )
        })}
      </div>
      <div className="ev-cal-legend" aria-hidden>
        {TYPE_ORDER.filter((t) => events.some((e) => e.type === t)).map((t) => <span key={t}><i className={`ev-dot ev-c-${t}`} /> {TYPE_INFO[t].label}</span>)}
        <span><i className="ev-cal-edge static" /> Début ou fin</span>
      </div>
      <h3 className="ev-sub">{new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(selDate)}</h3>
      {selEvents.length ? (
        <ul className="ev-list">
          {selEvents.map((e) => (
            <li key={e.id}>
              <button type="button" className={`ev-cal-item ev-c-${e.type}`} onClick={() => setOpen(e)} aria-haspopup="dialog">
                <Icon name={TYPE_INFO[e.type].icon} /><b>{name(e)}</b>
                {(() => { const k = edgeOn(e, sel, sel + DAY); return k ? <small className="ev-cal-edgetxt">{k === 'end' ? 'se termine' : k === 'start' ? 'commence' : 'commence et se termine'}</small> : null })()}
              </button>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon="cal" title="Rien ce jour-là" text="Aucun évènement n'est prévu à cette date." />}
      {open && <EventDetail e={open} now={now} onClose={() => setOpen(null)} />}
    </section>
  )
}
