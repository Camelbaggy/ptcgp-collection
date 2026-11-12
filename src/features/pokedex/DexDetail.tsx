import { EmptyState } from '../../components/PageHeader'
import { Sheet } from '../../components/Sheet'
import { CardTile } from '../../components/CardTile'
import { SetBadge } from '../../components/Brand'
import { RARITY_LABEL } from '../../lib/useData'
import { DEX_RARITIES, type DexRow } from '../../lib/pokedex/aggregate'
import type { Card } from '../../lib/types'
import { TYPES } from './dexTypes'
import { Sprite } from './Sprite'

export const rowTitle = (r: DexRow) => r.entry.nameFr + (r.entry.formLabelFr ? ' ' + r.entry.formLabelFr : '')

/** Couleurs d'une pastille de type : texte blanc ou foncé, fond assombri si besoin (contraste ≥ 4,5:1). */
function chipColors(hex: string | undefined): { background?: string; color: string } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return { background: hex, color: '#fff' }
  const ch = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
  const lum = (rgb: number[]) => {
    const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const DARK = 0.0085 // #17142e
  let k = 1
  for (;;) {
    const L = lum(ch.map((v) => v * k))
    if ((L + 0.05) / (DARK + 0.05) >= 5) return { background: `rgb(${ch.map((v) => Math.round(v * k)).join(',')})`, color: '#17142e' }
    if (1.05 / (L + 0.05) >= 4.6) return { background: `rgb(${ch.map((v) => Math.round(v * k)).join(',')})`, color: '#fff' }
    k -= 0.04
  }
}

export function TypeChips({ ids }: { ids: number[] }) {
  return <span className="dx-types">{ids.map((t) => <span key={t} className="dx-type" style={chipColors(TYPES[t]?.color)}>{TYPES[t]?.fr ?? t}</span>)}</span>
}

interface Props {
  row: DexRow
  siblings: DexRow[]
  owned: Map<string, number>
  onSelect: (r: DexRow) => void
  onCard: (c: Card) => void
  onClose: () => void
}

export function DexDetail({ row, siblings, owned, onSelect, onCard, onClose }: Props) {
  const e = row.entry
  const cards = [...row.cards].sort((a, b) => DEX_RARITIES.indexOf(a.rarity) - DEX_RARITIES.indexOf(b.rarity) || a.setId.localeCompare(b.setId) || a.number - b.number)
  return (
    <Sheet title={rowTitle(row)} onClose={onClose} full>
      <div className="dx-head">
        <Sprite formId={e.formId} dex={e.dex} size={128} />
        <dl>
          <dt>N°</dt><dd>{String(e.dex).padStart(4, '0')} · génération {e.gen}</dd>
          <dt>FR</dt><dd>{rowTitle(row)}</dd>
          <dt>EN</dt><dd>{e.formLabelEn ? `${e.nameEn} (${e.formLabelEn})` : e.nameEn}</dd>
          <dt>Types</dt><dd><TypeChips ids={e.types} /></dd>
          <dt>Possédées</dt><dd><b>{row.owned} / {row.total}</b> cartes différentes</dd>
        </dl>
      </div>
      {siblings.length > 1 && (
        <div className="chips scroll" role="group" aria-label="Formes">
          {siblings.map((s) => (
            <button key={s.entry.formId} className={'chip' + (s.entry.formId === e.formId ? ' on' : '')} onClick={() => onSelect(s)}>
              {s.entry.formLabelFr ?? 'De base'} <small>({s.owned}/{s.total})</small>
            </button>
          ))}
        </div>
      )}
      {row.total === 0 ? (
        <EmptyState icon="cards" title="Pas de carte" text="Aucune carte TCG Pocket pour ce Pokémon." />
      ) : (
        <>
          <table className="dx-table">
            <thead><tr><th>Rareté</th><th>Dans le jeu</th><th>Possédées</th></tr></thead>
            <tbody>
              {DEX_RARITIES.filter((r) => row.byRarity[r]).map((r) => (
                <tr key={r}><td>{RARITY_LABEL[r]}</td><td>{row.byRarity[r]!.total}</td><td className={row.byRarity[r]!.owned === row.byRarity[r]!.total ? 'ok' : ''}>{row.byRarity[r]!.owned}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="grid dx-cards">
            {cards.map((c) => {
              const q = owned.get(c.id) ?? 0
              return (
                <div key={c.id} className="dx-card">
                  <CardTile card={c} count={q} dim={q === 0} onClick={() => onCard(c)} />
                  <small><SetBadge setId={c.setId} /> {RARITY_LABEL[c.rarity]}</small>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Sheet>
  )
}
