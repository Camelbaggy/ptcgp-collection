import { useMemo } from 'react'
import { Sheet } from '../../components/Sheet'
import { CardTile } from '../../components/CardTile'
import { useCards, useOwned } from '../../lib/useData'
import type { MetaCard, MetaDeck, WindowKey } from '../../lib/meta/compute'
import { DeckQr } from './DeckQr'
import { TIER_LABEL, delta1, limitlessUrl, pct1, pocketMadsUrl, score1 } from './useMeta'

export default function MetaDetail({ deck, win, onClose }: { deck: MetaDeck; win: WindowKey; onClose: () => void }) {
  const cards = useCards()
  const owned = useOwned()
  const s = deck.stats[win]
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  // Owned copies are counted by card name: every printing of a card is playable.
  const ownedByName = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cards) {
      const q = owned.get(c.id) ?? 0
      if (q) m.set(c.nameEn ?? c.name, (m.get(c.nameEn ?? c.name) ?? 0) + q)
    }
    return m
  }, [cards, owned])
  const have = (c: MetaCard) => {
    const card = cardById.get(c.cardId)
    return card ? ownedByName.get(card.nameEn ?? card.name) ?? 0 : 0
  }
  const missing = deck.consensus.reduce((n, c) => n + (cardById.has(c.cardId) ? Math.max(0, c.count - have(c)) : 0), 0)

  const grid = (list: MetaCard[]) => (
    <div className="grid meta-grid">
      {list.map((c) => {
        const card = cardById.get(c.cardId)
        if (!card) return null
        const lack = Math.max(0, c.count - have(c))
        return (
          <div key={c.cardId} className={'meta-card' + (lack ? ' lack' : '')}>
            <CardTile card={card} count={c.count} />
            <small>{Math.round(c.inclusion * 100)} %{lack ? ` · −${lack}` : ''}</small>
          </div>
        )
      })}
    </div>
  )

  return (
    <Sheet title={deck.nameFr} onClose={onClose} full>
      <div className="meta-detail">
        {s && (
          <div className="ptc-tiles">
            <div className="ptc-tile"><b>{score1(s.score)}</b><span>Score{s.delta ? ` (${delta1(s.delta)} / 24 h)` : ''}</span></div>
            <div className="ptc-tile"><b>{s.tier === null ? '–' : TIER_LABEL[s.tier]}</b><span>Tier</span></div>
            <div className="ptc-tile"><b>{pct1(s.winRate)}</b><span>Victoires · {s.games} matchs</span></div>
            <div className="ptc-tile"><b>{pct1(s.share)}</b><span>Part · {s.players} participations</span></div>
          </div>
        )}
        {s && s.posGames > 0 && <p className="muted">Contre les decks à ≥ 3 % : {pct1(s.posWinRate)} sur {s.posGames} matchs. {s.wins} V · {s.losses} D (hors miroirs, égalités et byes).</p>}

        <h3>Liste type ({deck.lists} listes)</h3>
        {missing > 0 ? <p className="warn"><b>Il te manque {missing} carte{missing > 1 ? 's' : ''}.</b></p> : <p className="ok">Tu as toutes les cartes.</p>}
        {grid(deck.consensus)}

        {deck.flex.length > 0 && (<><h3>Cartes flex</h3>{grid(deck.flex)}</>)}

        <h3>QR code du deck</h3>
        <DeckQr consensus={deck.consensus} cardById={cardById} />

        <div className="meta-links">
          <a className="btn" href={pocketMadsUrl(deck.id, win)} target="_blank" rel="noopener">PocketMads ↗</a>
          <a className="btn" href={limitlessUrl(deck.id)} target="_blank" rel="noopener">Limitless ↗</a>
        </div>
      </div>
    </Sheet>
  )
}
