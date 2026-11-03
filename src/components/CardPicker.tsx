import { useMemo, useState } from 'react'
import { Sheet } from './Sheet'
import { CardTile } from './CardTile'
import { Filters } from './Filters'
import { matchCard, setLabel, useCards, useOwned, useSets } from '../lib/useData'
import type { Card, Rarity } from '../lib/types'

interface Props {
  title: string
  onPick: (c: Card) => void
  onClose: () => void
  /** Si défini, seules les cartes pour lesquelles ceci renvoie true sont sélectionnables. */
  allow?: (c: Card, qty: number) => boolean
  /** Masque les cartes non sélectionnables au lieu de les griser. */
  hideDisallowed?: boolean
}

export function CardPicker({ title, onPick, onClose, allow, hideDisallowed }: Props) {
  const cards = useCards()
  const owned = useOwned()
  const sets = useSets()
  const [q, setQ] = useState('')
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [setId, setSetId] = useState('')
  const shown = useMemo(() => {
    const out = cards.filter((c) => (!setId || c.setId === setId) && matchCard(c, q, rarities))
      .filter((c) => !(hideDisallowed && allow && !allow(c, owned.get(c.id) ?? 0)))
    return out.slice(0, 300)
  }, [cards, owned, q, rarities, setId, allow, hideDisallowed])
  return (
    <Sheet title={title} onClose={onClose} full>
      <select className="input" value={setId} onChange={(e) => setSetId(e.target.value)}>
        <option value="">Toutes les extensions</option>
        {sets.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}
      </select>
      <Filters q={q} setQ={setQ} rarities={rarities} setRarities={setRarities} />
      <div className="grid">
        {shown.map((c) => {
          const qty = owned.get(c.id) ?? 0
          const ok = !allow || allow(c, qty)
          return <CardTile key={c.id} card={c} count={qty} dim={qty === 0} disabled={!ok} showName onClick={() => onPick(c)} />
        })}
      </div>
      {shown.length === 0 && <p className="muted">Aucune carte.</p>}
      {shown.length === 300 && <p className="muted">Affinez la recherche pour voir plus de cartes.</p>}
    </Sheet>
  )
}
