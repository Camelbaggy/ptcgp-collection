import type { ReactNode } from 'react'
import { Sheet } from '../../components/Sheet'
import { CardTile } from '../../components/CardTile'
import { CardDetail } from '../../components/CardDetail'
import { useState } from 'react'
import { BoosterBadge, SetLogo } from '../../components/Brand'
import { Icon } from '../../components/Icon'
import { RARITY_LABEL, useBoosters, useOwned } from '../../lib/useData'
import { rankBoosters } from '../../lib/packBooster'
import { setPackBooster } from '../../lib/db'
import { useToast } from '../../components/Toast'
import type { Card, HistoryEvent } from '../../lib/types'
import { EventDelete, EventEditor } from './EventEditor'

const dateLabel = (iso: string) => {
  const d = new Date(iso)
  return isNaN(+d) ? iso : d.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
}
const nf = new Intl.NumberFormat('fr-FR')

const TITLE: Record<HistoryEvent['kind'], string> = {
  pack: 'Booster ouvert', share: 'Partage', trade: 'Échange', correction: 'Mise à jour',
}

/** Une carte en grand : image (touche pour la fiche), nom, extension + numéro, rareté ; `value` en pastille. */
function CardCell({ id, card, value, onPick }: { id: string; card?: Card; value?: ReactNode; onPick: (c: Card) => void }) {
  return (
    <li className="hs-cell">
      {card ? <CardTile card={card} onClick={() => onPick(card)} /> : <span className="tile-fallback">{id}</span>}
      {value && <span className="hs-val">{value}</span>}
      <b className="hs-cn">{card?.name ?? id}</b>
      <small className="hs-sub">
        {card ? <><SetLogo setId={card.setId} small fallback={<span>{card.setId}</span>} /> n° {card.number} · {RARITY_LABEL[card.rarity]}{card.finish === 'Brillante' ? ' · brillante' : ''}</> : 'Carte inconnue'}
      </small>
    </li>
  )
}

/** Autres boosters pouvant contenir toutes les cartes du pack : permet de corriger un booster mal choisi. */
function FixBooster({ e, cards }: { e: Extract<HistoryEvent, { kind: 'pack' }>; cards: Card[] }) {
  const boosters = useBoosters()
  const toast = useToast()
  if (!cards.length) return null
  const others = rankBoosters(cards).filter((r) => r.hits === cards.length && r.boosterId !== e.boosterId)
  if (!others.length) return null
  return (
    <section className="hs-fix">
      <h3 className="hs-h">Mauvais booster ? Ces cartes peuvent aussi venir de :</h3>
      <div className="hs-fix-list">
        {others.map(({ boosterId }) => {
          const b = boosters.find((x) => x.id === boosterId)
          return (
            <button key={boosterId} className="btn hs-fix-btn" onClick={async () => { await setPackBooster(e.id, boosterId); toast('Booster corrigé') }}>
              <BoosterBadge boosterId={boosterId} setId={b?.setId} name={b?.name} />
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Tuile détaillant un évènement de l'historique (cartes concernées). */
export function HistorySheet({ e, cardById, onClose }: { e: HistoryEvent; cardById: Map<string, Card>; onClose: () => void }) {
  const boosters = useBoosters()
  const owned = useOwned()
  const [picked, setPicked] = useState<Card | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view')
  const card = (id: string) => cardById.get(id)
  const cell = (id: string, value?: ReactNode, key: string | number = id) => <CardCell key={key} id={id} card={card(id)} value={value} onPick={setPicked} />
  let body: ReactNode
  if (e.kind === 'pack') {
    const b = boosters.find((x) => x.id === e.boosterId)
    body = (
      <>
        <div className="hs-head"><BoosterBadge boosterId={e.boosterId} setId={b?.setId} name={b?.name} /></div>
        <p className="hs-hint">{nf.format(e.cardIds.length)} carte{e.cardIds.length > 1 ? 's' : ''}</p>
        <ul className="hs-grid">{e.cardIds.map((id, i) => cell(id, undefined, i))}</ul>
        <FixBooster e={e} cards={e.cardIds.map(card).filter((c): c is Card => !!c)} />
      </>
    )
  } else if (e.kind === 'trade') {
    body = (
      <>
        {(e.friend || e.tokens) && <p className="hs-hint">{e.friend ? `Avec ${e.friend}` : ''}{e.friend && e.tokens ? ' · ' : ''}{e.tokens ? `${nf.format(e.tokens)} jeton${e.tokens > 1 ? 's' : ''}` : ''}</p>}
        <div className="hs-trade">
          <div><h3 className="hs-h">Donnée</h3><ul className="hs-grid one">{cell(e.given, <b className="neg">−1</b>)}</ul></div>
          <span className="hs-arrow" aria-hidden="true"><Icon name="swap" /></span>
          <div><h3 className="hs-h">Reçue</h3><ul className="hs-grid one">{cell(e.received, <b className="pos">+1</b>)}</ul></div>
        </div>
      </>
    )
  } else if (e.kind === 'share') {
    const given = e.direction === 'given'
    body = (
      <>
        <p className="hs-hint">{given ? 'Carte donnée' : 'Carte reçue'}{e.friend ? ` · ${given ? 'à' : 'de'} ${e.friend}` : ''}</p>
        <ul className="hs-grid">{cell(e.cardId, given ? <b className="neg">−1</b> : <b className="pos">+1</b>)}</ul>
      </>
    )
  } else {
    const plus = e.changes.reduce((s, c) => s + Math.max(0, c.to - c.from), 0)
    const minus = e.changes.reduce((s, c) => s + Math.max(0, c.from - c.to), 0)
    body = (
      <>
        <p className="hs-hint">{nf.format(e.changes.length)} carte{e.changes.length > 1 ? 's' : ''} modifiée{e.changes.length > 1 ? 's' : ''} · +{nf.format(plus)} / −{nf.format(minus)} exemplaire{plus + minus > 1 ? 's' : ''}</p>
        <ul className="hs-grid">
          {e.changes.map((c, i) => {
            const d = c.to - c.from
            return cell(c.cardId, <><b className={d > 0 ? 'pos' : d < 0 ? 'neg' : ''}>{d > 0 ? '+' : d < 0 ? '−' : ''}{nf.format(Math.abs(d))}</b><small>{nf.format(c.from)} → {nf.format(c.to)}</small></>, i)
          })}
        </ul>
      </>
    )
  }
  return (
    <>
      <Sheet title={mode === 'edit' ? `Modifier : ${TITLE[e.kind].toLowerCase()}` : mode === 'delete' ? 'Supprimer l’évènement' : TITLE[e.kind]} full onClose={onClose}>
        <p className="hs-date">{dateLabel(e.date)}</p>
        {mode === 'edit' ? <EventEditor e={e} cardById={cardById} onDone={onClose} onCancel={() => setMode('view')} />
          : mode === 'delete' ? <EventDelete e={e} cardById={cardById} onDone={onClose} onCancel={() => setMode('view')} />
          : <>
            {body}
            <div className="he-actions hs-actions">
              <button className="btn" onClick={() => setMode('edit')}><Icon name="edit" />Modifier</button>
              <button className="btn danger" onClick={() => setMode('delete')}><Icon name="trash" />Supprimer</button>
            </div>
          </>}
      </Sheet>
      {picked && <CardDetail card={picked} qty={owned.get(picked.id) ?? 0} onClose={() => setPicked(null)} />}
    </>
  )
}
