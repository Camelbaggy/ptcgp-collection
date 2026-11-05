import { useMemo, useState } from 'react'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { useCards, usePersisted } from '../../lib/useData'
import type { MetaDeck, WindowKey } from '../../lib/meta/compute'
import { DeckRow } from './DeckRow'
import MetaDetail from './MetaDetail'
import { TIERS, TIER_LABEL, TIER_SUB, WINDOW_LABEL, dateTimeFr, useMeta } from './useMeta'
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
      .filter((x): x is { d: MetaDeck; s: NonNullable<typeof x.s> } => !!x.s && x.s.tier !== null)
      .sort((a, b) => b.s.score - a.s.score)
    return TIERS.map((t) => ({ tier: t, rows: rows.filter((x) => x.s.tier === t) })).filter((g) => g.rows.length)
  }, [meta, win])

  return (
    <div className="page meta" data-section="red">
      <PageHeader icon="trophy" title="Méta" sub="Tier list des decks du moment" />
      {loading && <p className="muted">Chargement…</p>}
      {!loading && !meta && <EmptyState icon="trophy" title="Pas encore de données" text="La méta est mise à jour chaque matin." />}
      {meta && (
        <>
          <div className="chips" role="group" aria-label="Période">
            {(Object.keys(WINDOW_LABEL) as WindowKey[]).map((w) => (
              <button key={w} className={'chip' + (w === win ? ' on' : '')} aria-pressed={w === win} onClick={() => setWin(w)}>{WINDOW_LABEL[w]}</button>
            ))}
          </div>
          <p className="muted meta-src card">
            {meta.windows[win].players.toLocaleString('fr-FR')} participations · {meta.windows[win].matches.toLocaleString('fr-FR')} matchs · {meta.windows[win].tournaments} tournois · Mis à jour le {dateTimeFr(meta.generatedAt)} · Source : Limitless · Score 0–100 : popularité, performance, positionnement
          </p>
          {!groups.length && <EmptyState icon="trophy" title="Aucun deck" text="Aucun deck sur cette période." />}
          {groups.map((g) => (
            <section key={g.tier} className="meta-tier card">
              <h2><span className={'tier-badge t-' + g.tier}>{TIER_LABEL[g.tier]}</span> <small className="muted">{TIER_SUB[g.tier]}</small></h2>
              <ul className="meta-list">
                {g.rows.map((x) => <DeckRow key={x.d.id} deck={x.d} stats={x.s} cardById={cardById} onOpen={() => setOpen(x.d)} />)}
              </ul>
            </section>
          ))}
        </>
      )}
      {open && <MetaDetail key={open.name} deck={open} win={win} decks={meta?.decks ?? []} onOpen={setOpen} onClose={() => setOpen(null)} />}
    </div>
  )
}
