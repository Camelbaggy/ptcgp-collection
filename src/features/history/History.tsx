import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { EventBadge } from '../../components/EventBadge'
import { useToast } from '../../components/Toast'
import { onUndoError, undoLast } from '../../lib/db'
import { useBoosters, useCardById, useHistory } from '../../lib/useData'
import type { HistoryEvent } from '../../lib/types'
import { HistorySheet } from './HistorySheet'

type Kind = 'all' | HistoryEvent['kind']
const KINDS: { k: Kind; label: string }[] = [
  { k: 'all', label: 'Tout' }, { k: 'pack', label: 'Boosters' }, { k: 'trade', label: 'Échanges' },
  { k: 'share', label: 'Partages' }, { k: 'correction', label: 'Mises à jour' },
]
const STEP = 50

const dayKey = (iso: string) => {
  const d = new Date(iso)
  return isNaN(+d) ? iso.slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dayTitle = (key: string, today: string, yesterday: string) => {
  if (key === today) return "Aujourd'hui"
  if (key === yesterday) return 'Hier'
  const d = new Date(key + 'T12:00:00')
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
  return s[0].toUpperCase() + s.slice(1)
}
const timeOf = (iso: string) => {
  const d = new Date(iso)
  return isNaN(+d) ? iso.slice(11, 16) : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function History() {
  const toast = useToast()
  const [limit, setLimit] = useState(STEP)
  const [params, setParams] = useSearchParams()
  const kind: Kind = KINDS.some((x) => x.k === params.get('type')) ? params.get('type') as Kind : 'all'
  const setKind = (k: Kind) => { setLimit(STEP); setParams(k === 'all' ? {} : { type: k }, { replace: true }) }
  const [openId, setOpen] = useState<string | null>(null)
  const history = useHistory(limit, kind === 'all' ? undefined : kind)
  const boosters = useBoosters()
  const cardById = useCardById()
  const name = (id: string) => cardById.get(id)?.name ?? id
  const boosterName = (id: string) => boosters.find((b) => b.id === id)?.name ?? id

  const describe = (e: HistoryEvent) =>
    e.kind === 'pack' ? <>{/^booster/i.test(boosterName(e.boosterId)) ? '' : 'Booster '}{boosterName(e.boosterId)} <small>{e.cardIds.length} carte{e.cardIds.length > 1 ? 's' : ''}</small></>
    : e.kind === 'share' ? <>Partage {e.direction === 'given' ? 'donné' : 'reçu'} : {name(e.cardId)}</>
    : e.kind === 'correction' ? <>Mise à jour <small>{e.changes.length} carte{e.changes.length > 1 ? 's' : ''}</small></>
    : <>Échange : {name(e.given)} → {name(e.received)}</>

  const open = history.find((e) => e.id === openId)
  const shown = history
  const days = useMemo(() => {
    const out: { key: string; items: HistoryEvent[] }[] = []
    for (const e of shown) {
      const k = dayKey(e.date)
      const last = out[out.length - 1]
      if (last && last.key === k) last.items.push(e)
      else out.push({ key: k, items: [e] })
    }
    return out
  }, [shown])
  // oxlint-disable-next-line react/purity -- repères « aujourd'hui » et « hier » recalculés à chaque rendu
  const now = new Date()
  const today = dayKey(now.toISOString())
  const yesterday = dayKey(new Date(now.getTime() - 864e5).toISOString())

  return (
    <div className="page" data-section="green">
      <PageHeader icon="history" title="Historique" sub="Touche une ligne pour voir les cartes." />
      <div className="hist-bar">
        <div className="chips scroll" role="group" aria-label="Type d'évènement">
          {KINDS.map(({ k, label }) => (
            <button key={k} className={'chip' + (kind === k ? ' on' : '')} aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
        <button className="btn" disabled={!history.length} onClick={async () => { try { const e = await undoLast(); if (e) toast('Dernier évènement annulé') } catch (err) { onUndoError(toast)(err) } }}>
          <Icon name="undo" />Annuler le dernier
        </button>
      </div>
      {!shown.length && <EmptyState icon="history" title="Rien pour l'instant" text={kind === 'all' ? 'Tes ajouts, partages et échanges apparaîtront ici.' : 'Aucun évènement de ce type pour l’instant.'} />}
      {days.map((d) => (
        <section key={d.key} className="card hist-day">
          <h2 className="hist-dt">{dayTitle(d.key, today, yesterday)}</h2>
          <ul className="list">
            {d.items.map((e) => (
              <li key={e.id}>
                <button className="list-item hist" onClick={() => setOpen(e.id)}>
                  <span className="mono">{timeOf(e.date)}</span>
                  <EventBadge e={e} setOf={(id) => cardById.get(id)?.setId} />
                  <span className="grow">{describe(e)}</span>
                  <Icon name="chev" className="chev" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {history.length >= limit && <button className="btn hist-more" onClick={() => setLimit(limit + STEP)}>Afficher plus</button>}
      {open && <HistorySheet e={open} cardById={cardById} onClose={() => setOpen(null)} />}
    </div>
  )
}
