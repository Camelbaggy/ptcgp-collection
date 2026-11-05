import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { SectionHead } from '../../components/PageHeader'
import { CardThumb } from '../../components/CardTile'
import { RARITY_LABEL, useCards, useHistory } from '../../lib/useData'
import type { Card, HistoryEvent } from '../../lib/types'
import { HistorySheet } from './HistorySheet'

const N = 10

const when = (iso: string) => {
  const d = new Date(iso)
  if (isNaN(+d)) return iso.slice(0, 10)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' })
    + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function Thumb({ card }: { card?: Card }) {
  return card ? <CardThumb card={card} /> : <span className="thumb thumb-fb">?</span>
}

/** Les 10 derniers échanges ou partages, chacun ouvrant la fiche détaillée ; lien vers l'historique filtré. */
export function RecentHistory({ kind }: { kind: 'trade' | 'share' }) {
  const events = useHistory(N, kind)
  const cards = useCards()
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const [openId, setOpen] = useState<string | null>(null)
  const open = events.find((e) => e.id === openId)
  const name = (id: string) => cardById.get(id)?.name ?? id
  const rar = (id: string) => { const c = cardById.get(id); return c ? RARITY_LABEL[c.rarity] : '' }
  const title = kind === 'trade' ? 'Derniers échanges' : 'Derniers partages'

  const row = (e: HistoryEvent) => {
    if (e.kind === 'trade') {
      return (
        <>
          <span className="rh-thumbs"><Thumb card={cardById.get(e.given)} /><Icon name="swap" className="rh-arrow" /><Thumb card={cardById.get(e.received)} /></span>
          <span className="rh-main">
            <b className="rh-t"><span className="neg">{name(e.given)}</span> contre <span className="pos">{name(e.received)}</span></b>
            <small>{when(e.date)}{e.friend ? ` · avec ${e.friend}` : ''}{rar(e.given) ? ` · ${rar(e.given)}` : ''}</small>
          </span>
        </>
      )
    }
    if (e.kind === 'share') {
      const given = e.direction === 'given'
      return (
        <>
          <span className="rh-thumbs"><Thumb card={cardById.get(e.cardId)} /></span>
          <span className="rh-main">
            <b className="rh-t"><span className={given ? 'neg' : 'pos'}>{given ? 'Donné' : 'Reçu'}</span> : {name(e.cardId)}</b>
            <small>{when(e.date)}{e.friend ? ` · ${given ? 'à' : 'de'} ${e.friend}` : ''}{rar(e.cardId) ? ` · ${rar(e.cardId)}` : ''}</small>
          </span>
        </>
      )
    }
    return null
  }

  return (
    <section className="card rh">
      <SectionHead icon="history" title={title} action="Tout l'historique" to={`/historique?type=${kind}`} />
      {events.length ? (
        <ul className="list">
          {events.map((e) => (
            <li key={e.id}>
              <button className="list-item rh-row" onClick={() => setOpen(e.id)}>
                {row(e)}
                <Icon name="chev" className="chev" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rh-empty">{kind === 'trade' ? 'Aucun échange enregistré pour l’instant.' : 'Aucun partage enregistré pour l’instant.'} <Link to="/historique">Voir l’historique</Link></p>
      )}
      {open && <HistorySheet e={open} cardById={cardById} onClose={() => setOpen(null)} />}
    </section>
  )
}
