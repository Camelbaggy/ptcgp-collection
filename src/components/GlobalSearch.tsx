import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { Icon } from './Icon'
import { CardThumb } from './CardTile'
import { CardDetail } from './CardDetail'
import { SetBadge } from './Brand'
import { searchCards } from '../lib/search'
import { RARITY_LABEL, useCardById, useCards, useOwned } from '../lib/useData'
import type { Card } from '../lib/types'

/** Recherche globale : nom (FR/EN), numéro ou identifiant ; un résultat ouvre la fiche carte. */
export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const cards = useCards()
  const byId = useCardById()
  const owned = useOwned()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Card | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const dq = useDeferredValue(q)
  const { results, total } = useMemo(() => searchCards(cards, dq), [cards, dq])
  useEffect(() => { input.current?.focus() }, [])

  return (
    <>
      <Sheet title="Rechercher une carte" onClose={onClose}>
        <label className="search">
          <Icon name="search" />
          <input ref={input} className="input" type="search" enterKeyHint="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, numéro ou identifiant (A1-12)" aria-label="Rechercher une carte"
            onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) setOpen(results[0]) }} />
        </label>
        {!q.trim() ? (
          <p className="muted gs-hint">Tape le nom d'une carte (en français ou en anglais), son numéro ou son identifiant.</p>
        ) : results.length === 0 ? (
          <p className="muted gs-hint">Aucune carte ne correspond à « {q.trim()} ».</p>
        ) : (
          <>
            <ul className="gs-list" aria-label="Résultats">
              {results.map((c) => {
                const n = owned.get(c.id) ?? 0
                return (
                  <li key={c.id}>
                    <button type="button" className="gs-row" onClick={() => setOpen(c)}>
                      <CardThumb card={c} />
                      <span className="gs-main">
                        <b>{c.name}</b>
                        <small>{c.id} · {RARITY_LABEL[c.rarity]}</small>
                      </span>
                      <SetBadge setId={c.setId} />
                      <span className={'gs-qty' + (n ? '' : ' none')} aria-label={n ? `${n} possédée${n > 1 ? 's' : ''}` : 'Non possédée'}>{n ? `×${n}` : '0'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {total > results.length && <p className="muted gs-hint">{total - results.length} autres résultats : précise ta recherche.</p>}
          </>
        )}
      </Sheet>
      {open && <CardDetail card={byId.get(open.id) ?? open} qty={owned.get(open.id) ?? 0} onClose={() => setOpen(null)} />}
    </>
  )
}
