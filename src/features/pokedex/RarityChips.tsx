import { RARITY_LABEL } from '../../lib/useData'
import { DEX_RARITIES, type RarityCount } from '../../lib/pokedex/aggregate'
import type { Rarity } from '../../lib/types'

/** Petites pastilles colorées : nombre de cartes par rareté (vert quand toutes sont possédées). */
export function RarityChips({ by, showOwned }: { by: Partial<Record<Rarity, RarityCount>>; showOwned?: boolean }) {
  return (
    <span className="dx-rar">
      {DEX_RARITIES.filter((r) => by[r]).map((r) => {
        const c = by[r]!
        return (
          <span key={r} className={`dx-r r-${r}` + (c.owned === c.total ? ' done' : '')} title={`${RARITY_LABEL[r]} : ${c.owned}/${c.total} possédée(s)`}>
            <i aria-hidden>{RARITY_LABEL[r]}</i>{showOwned ? `${c.owned}/${c.total}` : c.total}
          </span>
        )
      })}
    </span>
  )
}
