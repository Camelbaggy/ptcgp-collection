import { RARITIES, RARITY_LABEL } from '../lib/useData'
import type { Rarity } from '../lib/types'

interface Props {
  q: string; setQ: (v: string) => void
  rarities: Rarity[]; setRarities: (v: Rarity[]) => void
  available?: Rarity[]
}

export function Filters({ q, setQ, rarities, setRarities, available }: Props) {
  const list = RARITIES.filter((r) => !available || available.includes(r))
  const toggle = (r: Rarity) => setRarities(rarities.includes(r) ? rarities.filter((x) => x !== r) : [...rarities, r])
  return (
    <div className="filters">
      <input type="search" className="input" placeholder="Rechercher (nom, numéro)…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" role="group" aria-label="Rareté">
        {list.map((r) => (
          <button key={r} className={'chip' + (rarities.includes(r) ? ' on' : '')} onClick={() => toggle(r)}>
            {RARITY_LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  )
}
