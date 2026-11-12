import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CardThumb } from '../../components/CardTile'
import { Icon } from '../../components/Icon'
import { TypeAhead } from '../../components/TypeAhead'
import { useToast } from '../../components/Toast'
import { db, onUndoError, rewriteEvent } from '../../lib/db'
import { editImpact, sameEvent, validateEvent } from '../../lib/historyEdit'
import { RARITY_LABEL, useCards, useOwned } from '../../lib/useData'
import type { Card, HistoryEvent } from '../../lib/types'

const nf = new Intl.NumberFormat('fr-FR')
const NONE: HistoryEvent[] = []
const LIST_STEP = 60

/** Mises à jour (corrections) : seules utiles pour savoir si une modification est absorbée. */
const useCorrections = () =>
  useLiveQuery(() => db.history.where('kind').equals('correction').toArray(), []) ?? NONE

function CardLine({ id, card, children }: { id: string; card?: Card; children?: ReactNode }) {
  return (
    <li className="he-line">
      {card ? <CardThumb card={card} /> : <span className="thumb thumb-fb">?</span>}
      <span className="he-name"><b>{card?.name ?? id}</b><small>{card ? `${card.setId} n° ${card.number} · ${RARITY_LABEL[card.rarity]}` : 'Carte inconnue'}</small></span>
      {children}
    </li>
  )
}

/** Effet de la modification sur les quantités actuelles, carte par carte. */
function Impact({ old, next, cardById }: { old: HistoryEvent; next: HistoryEvent | null; cardById: Map<string, Card> }) {
  const owned = useOwned()
  const corrections = useCorrections()
  const lines = useMemo(() => editImpact(old, next, corrections, owned), [old, next, corrections, owned])
  if (!lines.length) return <p className="hs-hint he-impact-none">Les quantités de ta collection ne changent pas.</p>
  const absorbed = lines.some((l) => l.absorbed)
  return (
    <section className="he-impact" aria-label="Effet sur ta collection">
      <h3 className="hs-h">Effet sur ta collection</h3>
      <ul className="he-list">
        {lines.map((l) => (
          <CardLine key={l.cardId} id={l.cardId} card={cardById.get(l.cardId)}>
            <span className="he-q">
              {l.absorbed
                ? <><b>{nf.format(l.before)}</b><small>inchangée</small></>
                : l.after === l.before ? <><b>{nf.format(l.before)}</b><small>déjà à 0</small></>
                : <><b className={l.after > l.before ? 'pos' : l.after < l.before ? 'neg' : ''}>{nf.format(l.before)} → {nf.format(l.after)}</b>{l.clamped && <small>bornée à 0</small>}</>}
            </span>
          </CardLine>
        ))}
      </ul>
      {absorbed && <p className="hs-hint">« Inchangée » : une mise à jour plus récente a déjà fixé la quantité de cette carte.</p>}
    </section>
  )
}

/** Choix d'une carte : carte actuelle + recherche pour la remplacer. */
function CardField({ label, id, cards, cardById, onPick }: { label: string; id: string; cards: Card[]; cardById: Map<string, Card>; onPick: (id: string) => void }) {
  const owned = useOwned()
  return (
    <div className="he-field">
      <h3 className="hs-h">{label}</h3>
      <ul className="he-list"><CardLine id={id} card={cardById.get(id)} /></ul>
      <TypeAhead cards={cards} owned={owned} onPick={(c) => onPick(c.id)} placeholder="Remplacer par… (nom ou numéro)" />
    </div>
  )
}

function Friend({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="he-field">
      <span className="hs-h">Ami (facultatif)</span>
      <input className="input" value={value ?? ''} onChange={(ev) => onChange(ev.target.value.trim() ? ev.target.value : undefined)} />
    </label>
  )
}

/** Formulaire propre à chaque type d'évènement. */
function Fields({ draft, set, cardById }: { draft: HistoryEvent; set: (e: HistoryEvent) => void; cardById: Map<string, Card> }) {
  const cards = useCards()
  const owned = useOwned()
  const [all, setAll] = useState(false)
  if (draft.kind === 'pack') {
    const inBooster = cards.filter((c) => c.boosterIds.includes(draft.boosterId))
    return (
      <div className="he-field">
        <h3 className="hs-h">Cartes du booster</h3>
        <ul className="he-list">
          {draft.cardIds.map((id, i) => (
            <CardLine key={i} id={id} card={cardById.get(id)}>
              <button className="btn ghost he-x" aria-label={`Retirer ${cardById.get(id)?.name ?? id}`} onClick={() => set({ ...draft, cardIds: draft.cardIds.filter((_, j) => j !== i) })}><Icon name="close" /></button>
            </CardLine>
          ))}
        </ul>
        <TypeAhead cards={inBooster.length ? inBooster : cards} owned={owned} onPick={(c) => set({ ...draft, cardIds: [...draft.cardIds, c.id] })} placeholder="Ajouter une carte (nom ou numéro)" />
      </div>
    )
  }
  if (draft.kind === 'share') {
    return (
      <>
        <div className="seg seg-sm" role="group" aria-label="Sens du partage">
          <button className={draft.direction === 'given' ? 'on' : ''} aria-pressed={draft.direction === 'given'} onClick={() => set({ ...draft, direction: 'given' })}>Donnée</button>
          <button className={draft.direction === 'received' ? 'on' : ''} aria-pressed={draft.direction === 'received'} onClick={() => set({ ...draft, direction: 'received' })}>Reçue</button>
        </div>
        <CardField label="Carte" id={draft.cardId} cards={cards} cardById={cardById} onPick={(id) => set({ ...draft, cardId: id })} />
        <Friend value={draft.friend} onChange={(friend) => set({ ...draft, friend })} />
      </>
    )
  }
  if (draft.kind === 'trade') {
    return (
      <>
        <CardField label="Carte donnée" id={draft.given} cards={cards} cardById={cardById} onPick={(id) => set({ ...draft, given: id })} />
        <CardField label="Carte reçue" id={draft.received} cards={cards} cardById={cardById} onPick={(id) => set({ ...draft, received: id })} />
        <Friend value={draft.friend} onChange={(friend) => set({ ...draft, friend })} />
        <label className="he-field">
          <span className="hs-h">Jetons d'échange (facultatif)</span>
          <input className="input" type="number" inputMode="numeric" min={0} value={draft.tokens ?? ''}
            onChange={(ev) => set({ ...draft, tokens: ev.target.value === '' ? undefined : Math.max(0, Math.floor(Number(ev.target.value))) })} />
        </label>
      </>
    )
  }
  const shown = all ? draft.changes : draft.changes.slice(0, LIST_STEP)
  return (
    <div className="he-field">
      <h3 className="hs-h">Quantités fixées par cette mise à jour</h3>
      <ul className="he-list">
        {shown.map((c, i) => (
          <CardLine key={c.cardId + i} id={c.cardId} card={cardById.get(c.cardId)}>
            <span className="he-from">{nf.format(c.from)} →</span>
            <input className="input he-num" type="number" inputMode="numeric" min={0} aria-label={`Nouvelle quantité de ${cardById.get(c.cardId)?.name ?? c.cardId}`} value={c.to}
              onChange={(ev) => { const to = Math.max(0, Math.floor(Number(ev.target.value) || 0)); set({ ...draft, changes: draft.changes.map((x, j) => (j === i ? { ...x, to } : x)) }) }} />
            <button className="btn ghost he-x" aria-label={`Retirer ${cardById.get(c.cardId)?.name ?? c.cardId} de la mise à jour`} onClick={() => set({ ...draft, changes: draft.changes.filter((_, j) => j !== i) })}><Icon name="close" /></button>
          </CardLine>
        ))}
      </ul>
      {!all && draft.changes.length > LIST_STEP && <button className="btn" onClick={() => setAll(true)}>Afficher les {nf.format(draft.changes.length)} cartes</button>}
    </div>
  )
}

/** Modification d'un évènement : formulaire, effet sur la collection, enregistrement annulable. */
export function EventEditor({ e, cardById, onDone, onCancel }: { e: HistoryEvent; cardById: Map<string, Card>; onDone: () => void; onCancel: () => void }) {
  const toast = useToast()
  const [draft, setDraft] = useState<HistoryEvent>(e)
  const [busy, setBusy] = useState(false)
  const error = validateEvent(draft)
  const unchanged = sameEvent(draft, e)
  const save = async () => {
    setBusy(true)
    try {
      const { added, removed } = await rewriteEvent(e.id, draft)
      toast('Évènement modifié', { label: 'Annuler', run: () => void rewriteEvent(added?.id ?? null, removed).catch(onUndoError(toast)) })
      onDone()
    } catch (err) { onUndoError(toast)(err); setBusy(false) }
  }
  return (
    <div className="he">
      <Fields draft={draft} set={setDraft} cardById={cardById} />
      {!unchanged && !error && <Impact old={e} next={draft} cardById={cardById} />}
      {error && !unchanged && <p className="he-err" role="alert"><Icon name="warn" />{error}</p>}
      <div className="he-actions">
        <button className="btn" onClick={onCancel}>Annuler</button>
        <button className="btn primary" disabled={busy || unchanged || !!error} onClick={() => void save()}><Icon name="check" />Enregistrer</button>
      </div>
    </div>
  )
}

/** Confirmation de suppression avec l'effet sur la collection. */
export function EventDelete({ e, cardById, onDone, onCancel }: { e: HistoryEvent; cardById: Map<string, Card>; onDone: () => void; onCancel: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const remove = async () => {
    setBusy(true)
    try {
      const { removed } = await rewriteEvent(e.id, null)
      toast('Évènement supprimé', { label: 'Annuler', run: () => void rewriteEvent(null, removed).catch(onUndoError(toast)) })
      onDone()
    } catch (err) { onUndoError(toast)(err); setBusy(false) }
  }
  return (
    <div className="he">
      <p className="he-warn"><Icon name="alert" />Supprimer cet évènement de l'historique et recalculer ta collection ?</p>
      <Impact old={e} next={null} cardById={cardById} />
      <div className="he-actions">
        <button className="btn" onClick={onCancel}>Garder</button>
        <button className="btn danger" disabled={busy} onClick={() => void remove()}><Icon name="trash" />Supprimer</button>
      </div>
    </div>
  )
}
