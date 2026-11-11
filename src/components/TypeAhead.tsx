import { useEffect, useMemo, useRef, useState } from 'react'
import { CardThumb } from './CardTile'
import { normalize, RARITY_LABEL } from '../lib/useData'
import type { Card } from '../lib/types'

/** Rang de correspondance (plus petit = meilleur), -1 si aucune. */
export function rank(c: Card, q: string): number {
  const n = normalize(q.trim())
  if (!n) return -1
  if (String(c.number) === n) return 0
  const names = [normalize(c.name), normalize(c.nameEn ?? '')]
  if (names.some((x) => x.startsWith(n))) return 1
  if (/^\d+$/.test(n)) return String(c.number).startsWith(n) ? 2 : -1
  if (names.some((x) => x.split(/[\s\-']+/).some((w) => w.startsWith(n)))) return 3
  if (names.some((x) => x.includes(n))) return 4
  return -1
}

interface Props {
  cards: Card[]
  owned: Map<string, number>
  onPick: (c: Card) => void
  placeholder?: string
  limit?: number
}

export function TypeAhead({ cards, owned, onPick, placeholder, limit = 8 }: Props) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => {
    if (!q.trim()) return []
    return cards
      .map((c) => ({ c, r: rank(c, q) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || a.c.number - b.c.number)
      .slice(0, limit)
      .map((x) => x.c)
  }, [cards, q, limit])
  useEffect(() => { input.current?.focus() }, [])

  const pick = (c: Card) => {
    onPick(c)
    setQ(''); setSel(0)
    input.current?.focus()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); pick(results[sel]) }
    else if (e.key === 'Escape') { setQ(''); setSel(0) }
  }
  return (
    <div className="typeahead">
      <input ref={input} className="input ta-input" type="text" inputMode="search" enterKeyHint="done" autoComplete="off" autoCorrect="off" spellCheck={false}
        placeholder={placeholder ?? 'Début du nom ou numéro…'} value={q} onChange={(e) => { setQ(e.target.value); setSel(0) }} onKeyDown={onKey} />
      {q.trim() !== '' && (
        <ul className="ta-list" role="listbox">
          {results.map((c, i) => (
            // onPointerDown + preventDefault : l'input garde le focus, le clavier reste ouvert.
            <li key={c.id} role="option" aria-selected={i === sel} className={'ta-item' + (i === sel ? ' sel' : '')}
              onPointerDown={(e) => { e.preventDefault(); pick(c) }}>
              <CardThumb card={c} />
              <span className="grow"><b>{c.name}</b><small className="muted"> #{c.number} · {c.id}</small></span>
              <span className="ta-rar">{RARITY_LABEL[c.rarity]}</span>
              <span className={'ta-qty' + (owned.get(c.id) ? '' : ' zero')}>×{owned.get(c.id) ?? 0}</span>
            </li>
          ))}
          {!results.length && <li className="ta-item muted">Aucune carte</li>}
        </ul>
      )}
    </div>
  )
}
