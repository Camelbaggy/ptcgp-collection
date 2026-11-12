import { useDeferredValue, useMemo, useState } from 'react'
import { addWonderPick, onUndoError, undoLast } from '../../lib/db'
import { searchCards } from '../../lib/search'
import { Icon } from '../../components/Icon'
import { CardThumb } from '../../components/CardTile'
import { SetBadge } from '../../components/Brand'
import { useToast } from '../../components/Toast'
import { RARITY_LABEL, useCardById, useCards, useHistory, useOwned } from '../../lib/useData'
import type { Card } from '../../lib/types'

/**
 * Pioche miracle : on cherche la carte gagnée, on la touche, elle est ajoutée (évènement `pack` marqué `wonder`, annulable).
 * Consignes dans l'aide « ? » de l'écran Ajout (`addHelp.tsx`).
 */
export default function WonderPick() {
  const cards = useCards()
  const byId = useCardById()
  const owned = useOwned()
  const toast = useToast()
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q)
  const { results, total } = useMemo(() => searchCards(cards, dq, 12), [cards, dq])
  const history = useHistory(200, 'pack')
  const picks = useMemo(() => history.filter((e) => e.kind === 'pack' && e.wonder), [history])

  const add = (c: Card) => {
    void addWonderPick(c).then(() => {
      setQ('')
      toast(`${c.name} ajoutée`, { label: 'Annuler', run: () => { void undoLast().catch(onUndoError(toast)) } })
    }).catch((e) => toast(String((e as Error).message)))
  }

  return (
    <section className="card wonder-pick" aria-label="Pioche miracle">
      <label className="search">
        <Icon name="search" />
        <input className="input" type="search" enterKeyHint="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Carte gagnée : nom ou numéro" aria-label="Carte gagnée"
          onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) add(results[0]) }} />
      </label>
      {q.trim() === '' ? null : results.length === 0 ? (
        <p className="muted small">Aucune carte ne correspond à « {q.trim()} ».</p>
      ) : (
        <>
          <ul className="gs-list" aria-label="Résultats">
            {results.map((c) => {
              const n = owned.get(c.id) ?? 0
              return (
                <li key={c.id}>
                  <button type="button" className="gs-row" onClick={() => add(c)}>
                    <CardThumb card={c} />
                    <span className="gs-main"><b>{c.name}</b><small>{c.id} · {RARITY_LABEL[c.rarity]}{n ? '' : ' · nouvelle carte'}</small></span>
                    <SetBadge setId={c.setId} />
                    <span className={'gs-qty' + (n ? '' : ' none')}>{n ? `×${n}` : '0'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {total > results.length && <p className="muted small">{total - results.length} autres résultats : précise ta recherche.</p>}
        </>
      )}
      <h3>Dernières pioches <small className="muted">{picks.length} notée{picks.length > 1 ? 's' : ''}</small></h3>
      {picks.length === 0 ? <p className="muted small">Aucune pioche notée pour l'instant.</p> : (
        <ul className="gs-list">
          {picks.slice(0, 8).map((e) => {
            const c = e.kind === 'pack' ? byId.get(e.cardIds[0]) : undefined
            if (!c) return null
            return (
              <li key={e.id} className="gs-row static">
                <CardThumb card={c} />
                <span className="gs-main"><b>{c.name}</b><small>{c.id} · {new Date(e.date).toLocaleDateString('fr-FR')}</small></span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
