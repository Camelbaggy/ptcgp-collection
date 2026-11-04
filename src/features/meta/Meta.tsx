import { useMemo, useState } from 'react'
import { useCards, usePersisted } from '../../lib/useData'
import type { MetaDeck, WindowKey } from '../../lib/meta/compute'
import { DeckRow } from './DeckRow'
import MetaDetail from './MetaDetail'
import { TIERS, WINDOW_LABEL, dateTimeFr, useMeta } from './useMeta'
import './meta.css'

export default function Meta() {
  const { meta, loading } = useMeta()
  const cards = useCards()
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const [win, setWin] = usePersisted<WindowKey>('metaWindow', '7d')
  const [open, setOpen] = useState<MetaDeck | null>(null)

  const groups = useMemo(() => {
    if (!meta) return []
    const rows = meta.decks
      .map((d) => ({ d, s: d.stats[win] }))
      .filter((x): x is { d: MetaDeck; s: NonNullable<typeof x.s> } => !!x.s)
      .sort((a, b) => b.s.score - a.s.score)
    return TIERS.map((t) => ({ tier: t, rows: rows.filter((x) => x.s.tier === t) })).filter((g) => g.rows.length)
  }, [meta, win])

  return (
    <div className="page meta">
      <h1>Méta</h1>
      {loading && <p className="muted">Chargement…</p>}
      {!loading && !meta && <p className="muted">Pas encore de données de méta. Elles sont mises à jour chaque matin.</p>}
      {meta && (
        <>
          <div className="chips" role="group" aria-label="Période">
            {(Object.keys(WINDOW_LABEL) as WindowKey[]).map((w) => (
              <button key={w} className={'chip' + (w === win ? ' on' : '')} aria-pressed={w === win} onClick={() => setWin(w)}>{WINDOW_LABEL[w]}</button>
            ))}
          </div>
          <p className="muted meta-src">
            {meta.windows[win].players.toLocaleString('fr-FR')} joueurs · {meta.windows[win].tournaments} tournois · Mis à jour le {dateTimeFr(meta.generatedAt)} · Source : Limitless
          </p>
          {!groups.length && <p className="muted">Aucun deck sur cette période.</p>}
          {groups.map((g) => (
            <section key={g.tier} className="meta-tier">
              <h2><span className={'tier-badge t-' + g.tier}>{g.tier}</span></h2>
              <ul className="meta-list">
                {g.rows.map((x) => <DeckRow key={x.d.id} deck={x.d} stats={x.s} cardById={cardById} onOpen={() => setOpen(x.d)} />)}
              </ul>
            </section>
          ))}
        </>
      )}
      {open && <MetaDetail deck={open} win={win} onClose={() => setOpen(null)} />}
    </div>
  )
}
