import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCards } from '../../lib/useData'
import { DeckRow } from './DeckRow'
import { useMeta } from './useMeta'
import './meta.css'

/** Carte « Tier list » de l'accueil : top 5 sur 7 jours. */
export default function MetaTop() {
  const { meta } = useMeta()
  const cards = useCards()
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const top = useMemo(
    () => (meta?.decks ?? []).filter((d) => d.stats['7d'] && d.stats['7d'].tier !== null).sort((a, b) => b.stats['7d']!.score - a.stats['7d']!.score).slice(0, 5),
    [meta],
  )
  if (!top.length) return null
  return (
    <section aria-label="Tier list" className="meta meta-top">
      <div className="ev-head"><h2>Tier list</h2><Link to="/meta">Méta complète</Link></div>
      <ul className="meta-list">
        {top.map((d) => <DeckRow key={d.id} deck={d} stats={d.stats['7d']!} cardById={cardById} onOpen={() => { location.hash = '#/meta' }} />)}
      </ul>
    </section>
  )
}
