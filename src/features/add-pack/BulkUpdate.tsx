import { useMemo, useRef, useState } from 'react'
import { applyCorrections, undoLast } from '../../lib/db'
import { Filters } from '../../components/Filters'
import { useToast } from '../../components/Toast'
import { matchCard, RARITY_LABEL, setLabel, useCards, useOwned, usePersisted, useSets } from '../../lib/useData'
import type { Rarity } from '../../lib/types'

/**
 * Mise à jour en masse « tableur » : liste compacte des cartes de l'extension (ordre du numéro),
 * on tape la quantité, Entrée/Tab passe à la carte suivante, un seul « Enregistrer » à la fin.
 */
export default function BulkUpdate() {
  const sets = useSets()
  const cards = useCards()
  const owned = useOwned()
  const toast = useToast()
  const [setId, setSetId] = usePersisted('bulk.setId', '')
  const [q, setQ] = useState('')
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [pending, setPending] = useState<Record<string, string>>({})
  const box = useRef<HTMLDivElement>(null)

  const curSet = sets.find((s) => s.id === setId) ?? sets[sets.length - 1]
  const rows = useMemo(
    () => cards.filter((c) => c.setId === curSet?.id && matchCard(c, q, rarities)),
    [cards, curSet, q, rarities],
  )

  const changed = Object.entries(pending).filter(([id, v]) => v !== '' && Number(v) !== (owned.get(id) ?? 0))

  const move = (from: HTMLInputElement, dir: 1 | -1) => {
    const all = Array.from(box.current?.querySelectorAll<HTMLInputElement>('input.bulk-input') ?? [])
    const next = all[all.indexOf(from) + dir]
    if (next) {
      next.focus() // onFocus sélectionne le contenu
      next.scrollIntoView({ block: 'center' })
    }
  }
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || (e.key === 'Tab')) {
      e.preventDefault()
      move(e.currentTarget, e.shiftKey ? -1 : 1)
    }
  }

  const save = async () => {
    const ev = await applyCorrections(changed.map(([cardId, v]) => ({ cardId, to: Number(v) })))
    const n = changed.length
    setPending({})
    toast(ev ? `${n} carte(s) mise(s) à jour` : 'Rien à changer', ev ? { label: 'Annuler', run: () => void undoLast() } : undefined)
  }

  return (
    <>
      <select className="input" aria-label="Extension" value={curSet?.id ?? ''} onChange={(e) => setSetId(e.target.value)}>
        {sets.map((s) => <option key={s.id} value={s.id}>{setLabel(s)}</option>)}
      </select>
      <Filters q={q} setQ={setQ} rarities={rarities} setRarities={setRarities} />
      <div className="bulklist" ref={box}>
        {rows.map((c) => {
          const cur = owned.get(c.id) ?? 0
          const v = pending[c.id]
          const mod = v !== undefined && v !== '' && Number(v) !== cur
          return (
            <label key={c.id} className={'bulkline' + (mod ? ' changed' : '')}>
              <span className="mono num">{c.number}</span>
              <span className="grow nm">{c.name}</span>
              <span className="rar">{RARITY_LABEL[c.rarity]}</span>
              <input className="bulk-input" inputMode="numeric" enterKeyHint="next" autoComplete="off" aria-label={`Quantité ${c.name}`}
                value={v ?? String(cur)}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPending((p) => ({ ...p, [c.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                onBlur={() => setPending((p) => (p[c.id] === '' ? (({ [c.id]: _x, ...r }) => (void _x, r))(p) : p))}
                onKeyDown={onKey} />
            </label>
          )
        })}
        {!rows.length && <p className="muted">Aucune carte.</p>}
      </div>
      <div className="actionbar">
        <span>{changed.length} modifiée{changed.length > 1 ? 's' : ''}</span>
        <button className="btn ghost" disabled={!Object.keys(pending).length} onClick={() => setPending({})}>Annuler</button>
        <button className="btn primary" disabled={!changed.length} onClick={save}>Enregistrer</button>
      </div>
    </>
  )
}
