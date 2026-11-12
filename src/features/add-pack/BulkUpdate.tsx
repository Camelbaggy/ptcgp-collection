import { useMemo, useRef, useState } from 'react'
import { Filters } from '../../components/Filters'
import { useToast } from '../../components/Toast'
import { matchCard, RARITY_LABEL, splitSets, useCards, useOwned, usePersisted, useSets } from '../../lib/useData'
import type { Rarity } from '../../lib/types'
import { ReviewActionBar } from './CorrectionReview'
import { SetLine } from './SetChoice'
import { saveCorrections, useCorrectionEdits } from './correctionEdits'

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
  const review = useCorrectionEdits()
  const pending = review.edits
  const box = useRef<HTMLDivElement>(null)

  const grouped = splitSets(sets)
  const curSet = sets.find((s) => s.id === setId) ?? grouped.regular[grouped.regular.length - 1] ?? sets[sets.length - 1]
  const rows = useMemo(
    () => cards.filter((c) => c.setId === curSet?.id && matchCard(c, q, rarities)),
    [cards, curSet, q, rarities],
  )

  // toutes les saisies, même celles masquées par la recherche
  const changed = review.changed(Object.keys(pending).map((cardId) => ({ cardId, cur: owned.get(cardId) ?? 0, read: null })))

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
    await saveCorrections(review.corrections(changed), toast)
    review.reset()
  }

  return (
    <>
      <SetLine sets={sets} value={curSet} onPick={setSetId}
        detail={`${cards.filter((c) => c.setId === curSet?.id && (owned.get(c.id) ?? 0) > 0).length} / ${cards.filter((c) => c.setId === curSet?.id).length}`} />
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
                onChange={(e) => review.edit(c.id, e.target.value)}
                onBlur={() => review.setEdits((p) => (p[c.id] === '' ? (({ [c.id]: _x, ...r }) => (void _x, r))(p) : p))}
                onKeyDown={onKey} />
            </label>
          )
        })}
        {!rows.length && <p className="muted">Aucune carte.</p>}
      </div>
      <ReviewActionBar count={changed.length} onCancel={review.reset} onSave={save} cancelDisabled={!Object.keys(pending).length} />
    </>
  )
}
