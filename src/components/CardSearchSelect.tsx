import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { CardThumb } from './CardTile'
import { Icon } from './Icon'
import { rank } from './TypeAhead'
import { RARITY_LABEL } from '../lib/useData'
import type { Card } from '../lib/types'

const MAX_RESULTS = 30

interface Props {
  /** id de la carte choisie, '' = aucune. */
  value: string
  onChange: (id: string) => void
  /** Cartes proposées en premier (« Suggestions »). */
  suggestions: Card[]
  /** Toutes les cartes cherchables. */
  cards: Card[]
  /** Cartes de l'extension en cours : elles passent avant les autres dans les résultats. */
  preferred: Card[]
  /** Si renseigné, ajoute l'option « aucune carte » avec ce libellé. */
  noneLabel?: string
  label: string
}

const labelOf = (c: Card) => `${c.name} ${RARITY_LABEL[c.rarity]} · ${c.id}`

/** Sélecteur de carte avec recherche (début du nom FR/EN ou numéro), en feuille. */
export default function CardSearchSelect({ value, onChange, suggestions, cards, preferred, noneLabel, label }: Props) {
  const [open, setOpen] = useState(false)
  const current = cards.find((c) => c.id === value) ?? suggestions.find((c) => c.id === value)
  const btn = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={btn} type="button" className="input shot-select csel-btn" aria-label={label} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span className="csel-cur">{current ? labelOf(current) : (noneLabel ?? 'Choisir une carte')}</span>
        <Icon name="search" />
      </button>
      {open && (
        <Picker title={label} suggestions={suggestions} cards={cards} preferred={preferred} noneLabel={noneLabel} value={value}
          onClose={() => setOpen(false)} onPick={(id) => { onChange(id); setOpen(false) }} />
      )}
    </>
  )
}

function Picker({ title, suggestions, cards, preferred, noneLabel, value, onClose, onPick }: {
  title: string; suggestions: Card[]; cards: Card[]; preferred: Card[]; noneLabel?: string; value: string
  onClose: () => void; onPick: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const prefIds = useMemo(() => new Set(preferred.map((c) => c.id)), [preferred])
  const sugIds = useMemo(() => new Set(suggestions.map((c) => c.id)), [suggestions])

  // Rangées affichées : { id, card? } ; id '' = aucune carte.
  const rows = useMemo(() => {
    const none = noneLabel ? [{ id: '', card: undefined as Card | undefined }] : []
    if (!q.trim()) return [...suggestions.map((c) => ({ id: c.id, card: c as Card | undefined })), ...none]
    const found = cards
      .map((c) => ({ c, r: rank(c, q) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || Number(prefIds.has(b.c.id)) - Number(prefIds.has(a.c.id)) || a.c.number - b.c.number)
      .slice(0, MAX_RESULTS)
      .map((x) => ({ id: x.c.id, card: x.c as Card | undefined }))
    return [...found, ...none]
  }, [q, cards, suggestions, prefIds, noneLabel])

  // Sheet donne le focus au bouton Fermer à l'ouverture : on reprend la main après.
  useEffect(() => { const t = window.setTimeout(() => input.current?.focus(), 30); return () => window.clearTimeout(t) }, [])
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [sel])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, rows.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && rows[sel]) { e.preventDefault(); onPick(rows[sel].id) }
  }

  const searching = q.trim() !== ''
  return (
    <Sheet title={title} onClose={onClose}>
      <input ref={input} className="input ta-input" type="text" inputMode="search" enterKeyHint="done" autoComplete="off" autoCorrect="off" spellCheck={false}
        placeholder="Début du nom ou numéro…" aria-label="Rechercher une carte" value={q} onChange={(e) => { setQ(e.target.value); setSel(0) }} onKeyDown={onKey} />
      <p className="muted small csel-head">{searching ? 'Résultats' : 'Suggestions'}</p>
      <ul ref={list} className="ta-list csel-list" role="listbox" aria-label={searching ? 'Résultats' : 'Suggestions'}>
        {rows.map((r, i) => (
          <li key={r.id || 'none'} role="option" aria-selected={i === sel} className={'ta-item' + (i === sel ? ' sel' : '') + (r.id === value ? ' cur' : '')}
            onPointerDown={(e) => e.preventDefault()} onClick={() => onPick(r.id)}>
            {r.card ? (
              <>
                <CardThumb card={r.card} />
                <span className="grow csel-name"><b>{r.card.name}</b>
                  <small className="muted"> #{r.card.number} · {r.card.id}{!prefIds.has(r.card.id) && (sugIds.has(r.card.id) || searching) ? ' (autre extension)' : ''}</small></span>
                <span className="ta-rar">{RARITY_LABEL[r.card.rarity]}</span>
              </>
            ) : <span className="grow">{noneLabel}</span>}
          </li>
        ))}
        {!rows.some((r) => r.card) && searching && <li className="ta-item muted">Aucune carte trouvée</li>}
      </ul>
    </Sheet>
  )
}
