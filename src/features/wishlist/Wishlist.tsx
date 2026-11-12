import { useState } from 'react'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { ListRow } from '../../components/PageKit'
import type { HelpBlock } from '../../components/HelpSheet'
import { Icon } from '../../components/Icon'
import { cardImageUrl, setWish } from '../../lib/db'
import { CardPicker } from '../../components/CardPicker'
import { SetBadge } from '../../components/Brand'
import { useCards, useOwned, useWishlist } from '../../lib/useData'
import type { Card } from '../../lib/types'

const PRIO = [{ v: 1, l: 'Haute' }, { v: 2, l: 'Moyenne' }, { v: 3, l: 'Basse' }]

const HELP: HelpBlock[] = [
  { title: 'Cartes visées', text: "Ajoute les cartes que tu cherches : l'accueil te dira quel booster ouvrir." },
  { title: 'Priorité', text: "Haute, moyenne ou basse : les cartes de haute priorité passent en premier dans la liste et dans les conseils de l'accueil." },
  { title: 'Carte grisée', text: "Tu ne possèdes pas encore cette carte. Le nombre sur la vignette est ton nombre d'exemplaires." },
]

function Thumb({ card, count }: { card: Card; count: number }) {
  const [broken, setBroken] = useState(false)
  return <>
    {broken ? <span className="wish-fallback">{card.id}</span>
      : <img src={cardImageUrl(card)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />}
    {count > 0 && <span className="wish-count" aria-label={`${count} exemplaire${count > 1 ? 's' : ''}`}>{count}</span>}
  </>
}

export default function WishlistScreen() {
  const wishes = useWishlist()
  const cards = useCards()
  const owned = useOwned()
  const [adding, setAdding] = useState(false)
  const rows = wishes
    .map((w) => ({ w, c: cards.find((c) => c.id === w.cardId) }))
    .filter((r) => r.c)
    .sort((a, b) => a.w.priority - b.w.priority)
  return (
    <div className="page" data-section="pink">
      <PageHeader icon="heart" title="Souhaits" help={HELP}
        actions={rows.length > 0 ? [{ icon: 'plus', label: 'Ajouter une carte visée', onClick: () => setAdding(true), primary: true }] : undefined} />
      {!rows.length && <EmptyState icon="heart" title="Aucune carte visée" text="Ajoute les cartes que tu cherches : l'accueil te dira quel booster ouvrir." action={<button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Ajouter une carte visée</button>} />}
      <ul className="list">
        {rows.map(({ w, c }) => {
          const n = owned.get(w.cardId) ?? 0
          return (
            <li key={w.cardId}>
              <ListRow
                className={'wish-row' + (n ? '' : ' missing')}
                thumb={<Thumb card={c!} count={n} />}
                title={c!.name}
                sub={<><SetBadge setId={c!.setId} className="mini" /> {c!.id}</>}
                actions={<>
                  <select className="input wish-prio" value={w.priority} onChange={(e) => setWish(w.cardId, Number(e.target.value))} aria-label={`Priorité de ${c!.name}`}>
                    {PRIO.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                  </select>
                  <button className="btn ghost wish-del" onClick={() => setWish(w.cardId, null)} aria-label={`Retirer ${c!.name}`}><Icon name="close" /></button>
                </>}
              />
            </li>
          )
        })}
      </ul>
      {adding && (
        <CardPicker title="Carte visée" onClose={() => setAdding(false)}
          onPick={(c) => { void setWish(c.id, 2); setAdding(false) }} />
      )}
    </div>
  )
}
