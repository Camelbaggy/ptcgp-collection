import type { ReactNode } from 'react'
import { Sheet } from '../../components/Sheet'
import { CardThumb } from '../../components/CardTile'
import { BoosterBadge, SetLogo } from '../../components/Brand'
import { Icon } from '../../components/Icon'
import { RARITY_LABEL, useBoosters } from '../../lib/useData'
import type { Card, HistoryEvent } from '../../lib/types'

const dateLabel = (iso: string) => {
  const d = new Date(iso)
  return isNaN(+d) ? iso : d.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
}
const nf = new Intl.NumberFormat('fr-FR')

const TITLE: Record<HistoryEvent['kind'], string> = {
  pack: 'Booster ouvert', share: 'Partage', trade: 'Échange', correction: 'Mise à jour',
}

/** Une ligne de carte : vignette, nom, extension + numéro, rareté ; `value` à droite. */
function CardLine({ id, card, value }: { id: string; card?: Card; value?: ReactNode }) {
  return (
    <li className="hs-card">
      {card ? <CardThumb card={card} /> : <span className="thumb thumb-fb">?</span>}
      <span className="hs-main">
        <b>{card?.name ?? id}</b>
        <small className="hs-sub">
          {card ? <><SetLogo setId={card.setId} small fallback={<span>{card.setId}</span>} /> n° {card.number} · {RARITY_LABEL[card.rarity]}{card.finish === 'Brillante' ? ' · brillante' : ''}</> : 'Carte inconnue'}
        </small>
      </span>
      {value && <span className="hs-val">{value}</span>}
    </li>
  )
}

/** Tuile détaillant un évènement de l'historique (cartes concernées). */
export function HistorySheet({ e, cardById, onClose }: { e: HistoryEvent; cardById: Map<string, Card>; onClose: () => void }) {
  const boosters = useBoosters()
  const card = (id: string) => cardById.get(id)
  let body: ReactNode
  if (e.kind === 'pack') {
    const b = boosters.find((x) => x.id === e.boosterId)
    body = (
      <>
        <div className="hs-head"><BoosterBadge boosterId={e.boosterId} setId={b?.setId} name={b?.name} /></div>
        <p className="hs-hint">{nf.format(e.cardIds.length)} carte{e.cardIds.length > 1 ? 's' : ''}</p>
        <ul className="hs-cards">{e.cardIds.map((id, i) => <CardLine key={id + i} id={id} card={card(id)} />)}</ul>
      </>
    )
  } else if (e.kind === 'trade') {
    body = (
      <>
        {(e.friend || e.tokens) && <p className="hs-hint">{e.friend ? `Avec ${e.friend}` : ''}{e.friend && e.tokens ? ' · ' : ''}{e.tokens ? `${nf.format(e.tokens)} jeton${e.tokens > 1 ? 's' : ''}` : ''}</p>}
        <h3 className="hs-h">Donnée</h3>
        <ul className="hs-cards"><CardLine id={e.given} card={card(e.given)} value={<b className="neg">−1</b>} /></ul>
        <div className="hs-arrow" aria-hidden="true"><Icon name="swap" /></div>
        <h3 className="hs-h">Reçue</h3>
        <ul className="hs-cards"><CardLine id={e.received} card={card(e.received)} value={<b className="pos">+1</b>} /></ul>
      </>
    )
  } else if (e.kind === 'share') {
    const given = e.direction === 'given'
    body = (
      <>
        <p className="hs-hint">{given ? 'Carte donnée' : 'Carte reçue'}{e.friend ? ` · ${given ? 'à' : 'de'} ${e.friend}` : ''}</p>
        <ul className="hs-cards"><CardLine id={e.cardId} card={card(e.cardId)} value={given ? <b className="neg">−1</b> : <b className="pos">+1</b>} /></ul>
      </>
    )
  } else {
    const plus = e.changes.reduce((s, c) => s + Math.max(0, c.to - c.from), 0)
    const minus = e.changes.reduce((s, c) => s + Math.max(0, c.from - c.to), 0)
    body = (
      <>
        <p className="hs-hint">{nf.format(e.changes.length)} carte{e.changes.length > 1 ? 's' : ''} modifiée{e.changes.length > 1 ? 's' : ''} · +{nf.format(plus)} / −{nf.format(minus)} exemplaire{plus + minus > 1 ? 's' : ''}</p>
        <ul className="hs-cards">
          {e.changes.map((c, i) => {
            const d = c.to - c.from
            return <CardLine key={c.cardId + i} id={c.cardId} card={card(c.cardId)}
              value={<><b className={d > 0 ? 'pos' : d < 0 ? 'neg' : ''}>{d > 0 ? '+' : d < 0 ? '−' : ''}{nf.format(Math.abs(d))}</b><small>{nf.format(c.from)} → {nf.format(c.to)}</small></>} />
          })}
        </ul>
      </>
    )
  }
  return (
    <Sheet title={TITLE[e.kind]} onClose={onClose}>
      <p className="hs-date">{dateLabel(e.date)}</p>
      {body}
    </Sheet>
  )
}
