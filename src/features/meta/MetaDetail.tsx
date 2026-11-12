import { useMemo } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { CardTile } from '../../components/CardTile'
import { useBoosterById, useCardById, useCards, useOwned, useRates } from '../../lib/useData'
import type { MetaCard, MetaDeck } from '../../lib/meta/compute'
import { BoosterBadge } from '../../components/Brand'
import { buildContext, deckBuild, ownedByName } from '../../lib/meta/buildable'
import { DeckQr } from './DeckQr'
import { Matchups } from './Matchups'
import type { OpenDeck } from './Meta'
import { TIER_LABEL, delta1, limitlessUrl, pct1, pocketMadsUrl, score1 } from './useMeta'

/** Fiche d'un deck : chiffres PocketMads (ou du calcul Holothèque), puis liste type, matchups et QR code tirés de Limitless. */
export default function MetaDetail({ open, decks, onOpen, onClose }: { open: OpenDeck; decks: MetaDeck[]; onOpen: (d: MetaDeck) => void; onClose: () => void }) {
  const { deck, pm, tier, source } = open
  const srcName = source === 'home' ? 'Holothèque' : 'PocketMads'
  const cards = useCards()
  const owned = useOwned()
  // matchups sur 7 jours, comme la tier list PocketMads
  const s = deck ? deck.stats['7d'] ?? deck.stats['14d'] : undefined
  const cardById = useCardById()
  const deckByName = useMemo(() => new Map(decks.map((d) => [d.name, d])), [decks])
  const rates = useRates()
  const boosterById = useBoosterById()
  const ctx = useMemo(() => buildContext(cards, owned, rates), [cards, owned, rates])
  const ownedNames = useMemo(() => ownedByName(cards, owned), [cards, owned])
  const have = (c: MetaCard) => {
    const card = cardById.get(c.cardId)
    return card ? ownedNames.get(card.nameEn ?? card.name) ?? 0 : 0
  }
  const build = useMemo(() => (deck ? deckBuild(deck.consensus, ctx) : null), [deck, ctx])
  const missing = build?.missing ?? 0
  const pick = build?.booster
  const pickB = pick ? boosterById.get(pick.boosterId) : undefined
  const unobtainable = build?.cards.filter((c) => !c.obtainable).reduce((n, c) => n + c.need, 0) ?? 0

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

  const pmUrl = pm?.id ? pocketMadsUrl(pm.id, '7d') : deck ? pocketMadsUrl(deck.id, '7d') : 'https://app.pocketmads.com/tier-list'
  return (
    <Sheet title={deck?.nameFr ?? pm?.name ?? 'Deck'} onClose={onClose} full>
      <div className="meta-detail">
        {pm && (
          <div className="ptc-tiles">
            {pm.score !== undefined && <div className="ptc-tile"><b>{score1(pm.score)}</b><span>Score {srcName}{pm.delta ? ` (${delta1(pm.delta)} / 24 h)` : ''}</span></div>}
            <div className="ptc-tile"><b>{tier ? TIER_LABEL[tier] : '–'}</b><span>Tier{pm.shift ? ' · vient de changer' : ''}</span></div>
            {pm.winRate !== undefined && <div className="ptc-tile"><b>{pct1(pm.winRate)}</b><span>Victoires{pm.games !== undefined ? ` · ${pm.games} matchs` : ''}</span></div>}
            {pm.share !== undefined && <div className="ptc-tile"><b>{pct1(pm.share)}</b><span>Part de la méta</span></div>}
          </div>
        )}
        {!pm && <p className="muted">Ce deck n'est pas dans la tier list {source === 'home' ? 'du calcul Holothèque' : 'PocketMads'}.</p>}

        {!deck && <p className="muted"><Icon name="alert" /> Pas de liste Limitless pour ce deck (trop peu joué, ou nom différent) : vois sa fiche sur PocketMads.</p>}
        {deck && (
          <>
            <h3><Icon name="layers" /> Liste type ({deck.lists} liste{deck.lists > 1 ? 's' : ''})</h3>
            {!deck.consensus.length ? <p className="muted">Aucune liste publiée sur Limitless pour ce deck ces 14 derniers jours.</p>
              : missing > 0 ? <p className="warn"><Icon name="alert" /> <b>Il te manque {missing} carte{missing > 1 ? 's' : ''}.</b></p> : <p className="ok"><Icon name="check" /> Tu as toutes les cartes.</p>}
            {pick && missing > 0 && (
              <div className="card meta-open">
                <span className="muted">À ouvrir en priorité</span>
                <BoosterBadge boosterId={pick.boosterId} setId={pickB?.setId} name={pickB?.name} />
                <small className="muted">
                  {Math.round(pick.p * 1000) / 10} % de chance par pack d'avoir au moins une carte manquante (environ {Math.ceil(pick.packs)} pack{Math.ceil(pick.packs) > 1 ? 's' : ''}), {pick.covers} carte{pick.covers > 1 ? 's' : ''} manquante{pick.covers > 1 ? 's' : ''} dans ce booster.
                </small>
              </div>
            )}
            {unobtainable > 0 && <p className="muted"><Icon name="alert" /> {unobtainable} carte{unobtainable > 1 ? 's' : ''} manquante{unobtainable > 1 ? 's' : ''} ne sort{unobtainable > 1 ? 'ent' : ''} d'aucun booster (mission, promo…).</p>}
            {grid(deck.consensus)}

            {deck.flex.length > 0 && (<><h3><Icon name="swap" /> Cartes flex</h3>{grid(deck.flex)}</>)}

            {s?.matchups && s.matchups.length > 0 && (
              <>
                <h3><Icon name="swap" /> Matchups · top {s.matchups.length} du moment</h3>
                <Matchups key={deck.name} matchups={s.matchups} deckByName={deckByName} cardById={cardById} onOpen={onOpen} />
              </>
            )}

            <h3><Icon name="grid" /> QR code du deck</h3>
            <DeckQr consensus={deck.consensus} cardById={cardById} />
          </>
        )}

        <div className="meta-links">
          <a className="btn" href={pmUrl} target="_blank" rel="noopener">PocketMads<Icon name="ext" /></a>
          {deck && <a className="btn" href={limitlessUrl(deck.id)} target="_blank" rel="noopener">Limitless<Icon name="ext" /></a>}
        </div>
      </div>
    </Sheet>
  )
}
