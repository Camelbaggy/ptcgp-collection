import { useState } from 'react'
import { EmptyState, PageHeader } from '../../components/PageHeader'
import { SegTabs } from '../../components/PageKit'
import { Sheet } from '../../components/Sheet'
import { CardDetail } from '../../components/CardDetail'
import type { HelpBlock } from '../../components/HelpSheet'
import { Icon } from '../../components/Icon'
import { cardImageUrl, setWish } from '../../lib/db'
import { CardPicker } from '../../components/CardPicker'
import { useCards, useOwned, usePersisted, useWishlist } from '../../lib/useData'
import type { Card } from '../../lib/types'

const PRIO = [{ v: 1, l: 'Haute' }, { v: 2, l: 'Moyenne' }, { v: 3, l: 'Basse' }]
const PRIO_LABEL: Record<string, string> = { '1': 'Priorité haute', '2': 'Priorité moyenne', '3': 'Priorité basse' }

const HELP: HelpBlock[] = [
  { title: 'Cartes visées', text: "Ajoute les cartes que tu cherches : l'accueil te dira quel booster ouvrir." },
  { title: 'Priorité', text: "Haute, moyenne ou basse : les cartes de haute priorité passent en premier dans la liste et dans les conseils de l'accueil." },
  { title: 'Modifier une carte', text: 'Touche une carte pour changer sa priorité, la retirer ou ouvrir sa fiche.' },
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
  const [sel, setSel] = useState<string | null>(null)
  const [fiche, setFiche] = useState<Card | null>(null)
  const [closed, setClosed] = usePersisted<Record<string, boolean>>('wish.closed', {})
  const rows = wishes
    .map((w) => ({ w, c: cards.find((c) => c.id === w.cardId) }))
    .filter((r) => r.c)
    .sort((a, b) => a.w.priority - b.w.priority)
  const selRow = rows.find((r) => r.w.cardId === sel)
  return (
    <div className="page" data-section="pink">
      <PageHeader icon="heart" title="Souhaits" help={HELP}
        actions={rows.length > 0 ? [{ icon: 'plus', label: 'Ajouter une carte visée', onClick: () => setAdding(true), primary: true }] : undefined} />
      {!rows.length && <EmptyState icon="heart" title="Aucune carte visée" text="Ajoute les cartes que tu cherches : l'accueil te dira quel booster ouvrir." action={<button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Ajouter une carte visée</button>} />}
      {PRIO.map((p) => {
        const items = rows.filter((r) => r.w.priority === p.v)
        if (!items.length) return null
        const shut = !!closed[p.v]
        return (
          <section key={p.v} className="wish-sec" data-content-start="">
            <button type="button" className="wish-sec-h" aria-expanded={!shut} onClick={() => setClosed({ ...closed, [p.v]: !shut })}>
              <b>{PRIO_LABEL[p.v]}</b><span>{items.length}</span><Icon name="chev" className={shut ? '' : 'open'} />
            </button>
            {!shut && (
              <ul className="wish-grid">
                {items.map(({ w, c }) => {
                  const n = owned.get(w.cardId) ?? 0
                  return (
                    <li key={w.cardId}>
                      <button type="button" className={'wish-cell' + (n ? '' : ' missing')} onClick={() => setSel(w.cardId)} aria-label={`${c!.name}, ${n} exemplaire${n > 1 ? 's' : ''}`}>
                        <Thumb card={c!} count={n} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
      {selRow && (
        <Sheet title={selRow.c!.name} onClose={() => setSel(null)}>
          <div className="wish-sheet">
            <div className="wish-big"><Thumb card={selRow.c!} count={owned.get(selRow.w.cardId) ?? 0} /></div>
            <SegTabs label="Priorité" value={String(selRow.w.priority) as '1' | '2' | '3'}
              options={PRIO.map((p) => ({ value: String(p.v) as '1' | '2' | '3', label: p.l }))}
              onChange={(v) => void setWish(selRow.w.cardId, Number(v))} />
            <div className="row">
              <button className="btn" onClick={() => { setFiche(selRow.c!); setSel(null) }}>Voir la fiche</button>
              <button className="btn" onClick={() => { void setWish(selRow.w.cardId, null); setSel(null) }}><Icon name="close" />Retirer</button>
            </div>
          </div>
        </Sheet>
      )}
      {fiche && <CardDetail card={fiche} qty={owned.get(fiche.id) ?? 0} onClose={() => setFiche(null)} />}
      {adding && (
        <CardPicker title="Carte visée" onClose={() => setAdding(false)}
          onPick={(c) => { void setWish(c.id, 2); setAdding(false) }} />
      )}
    </div>
  )
}
