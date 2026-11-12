import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CardTile } from './CardTile'
import { SetLogo } from './Brand'
import { Icon } from './Icon'
import { groupBySet, onReveal } from '../lib/reveal'
import { setLabel, useCardById, useCards, useOwned, useSets } from '../lib/useData'

const LIGHT_AT = 600 // ms entre l'arrivée sur la carte (sombre) et son illumination
const STEP_MS = 2300 // durée totale d'une carte avant la suivante
const SPARKS = 14
const SPARK_COLORS = ['var(--yellow)', 'var(--pink)', 'var(--teal)', '#fff']

const SETTLE_MS = 250 // pause entre la fin du défilement et l'illumination
const SCROLL_MAX_MS = 4000 // au-delà, on illumine quand même

/** Appelle `done` quand la carte ne bouge plus à l'écran (défilement fluide terminé). */
function waitScrollEnd(el: HTMLElement, setRaf: (r: number) => void, done: () => void) {
  const start = performance.now()
  let last = el.getBoundingClientRect().top
  let stable = 0
  const tick = (now: number) => {
    const top = el.getBoundingClientRect().top
    stable = Math.abs(top - last) < 0.5 ? stable + 1 : 0
    last = top
    // Au moins 150 ms pour laisser le défilement démarrer, puis ~8 images immobiles.
    if ((now - start > 150 && stable >= 8) || now - start > SCROLL_MAX_MS) done()
    else setRaf(requestAnimationFrame(tick))
  }
  setRaf(requestAnimationFrame(tick))
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Overlay « Nouvelle carte ! » : la liste de l'extension s'ouvre, la carte sombre s'illumine. */
export function NewCardReveal() {
  const cards = useCards()
  const sets = useSets()
  const owned = useOwned()
  const [ids, setIds] = useState<string[]>([])
  const [cur, setCur] = useState<string | null>(null)
  const [lit, setLit] = useState<Set<string>>(new Set())
  const panel = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const idsRef = useRef(ids)
  useEffect(() => { idsRef.current = ids }, [ids])

  const byId = useCardById()
  const groups = useMemo(() => groupBySet(ids, byId), [ids, byId])
  const flat = useMemo(() => groups.flatMap((g) => g.cardIds), [groups])
  const open = ids.length > 0

  useEffect(() => onReveal((fresh) => {
    if (!idsRef.current.length) opener.current = document.activeElement as HTMLElement | null
    setIds((p) => [...p, ...fresh.filter((f) => !p.includes(f))])
  }), [])

  // Démarre sur la première carte dès que la liste est prête.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- sélection de la première carte dès que la liste est prête
    if (open && (cur === null || !flat.includes(cur)) && flat.length) setCur(flat[0])
  }, [open, cur, flat])

  const close = useCallback(() => {
    setIds([]); setCur(null); setLit(new Set())
    opener.current?.focus?.()
  }, [])

  const idx = cur ? flat.indexOf(cur) : -1
  const isLast = idx >= flat.length - 1
  const next = useCallback(() => {
    if (idx >= 0 && idx < flat.length - 1) setCur(flat[idx + 1])
    else close()
  }, [idx, flat, close])

  // Déroulé d'une carte : défilement vers la carte, attente de la fin du défilement
  // (position de la carte stable), puis illumination, puis passage à la suivante.
  useEffect(() => {
    if (!cur) return
    const quick = reduced()
    const timers: number[] = []
    let raf = 0
    const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)) }
    const light = () => {
      setLit((p) => new Set(p).add(cur))
      if (!isLast) later(next, quick ? 1600 : STEP_MS - LIGHT_AT)
    }
    later(() => {
      const el = grid.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(cur)}"]`)
      el?.scrollIntoView({ block: 'center', behavior: quick ? 'auto' : 'smooth' })
      if (!el || quick) { later(light, quick ? 200 : LIGHT_AT); return }
      waitScrollEnd(el, (r) => { raf = r }, () => later(light, SETTLE_MS))
    }, quick ? 0 : 450)
    return () => { timers.forEach((t) => window.clearTimeout(t)); cancelAnimationFrame(raf) }
  }, [cur, isLast, next])

  // Clavier : Échap ferme, Tab reste dans la boîte de dialogue.
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close() }
      else if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled])')]
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, close])
  useEffect(() => { if (open) panel.current?.querySelector<HTMLElement>('.btn.primary')?.focus() }, [open])
  useEffect(() => { grid.current?.setAttribute('inert', '') }, [cur])

  const card = cur ? byId.get(cur) : undefined
  const group = card ? groups.find((g) => g.setId === card.setId) : undefined
  const set = card ? sets.find((s) => s.id === card.setId) : undefined
  const setCards = useMemo(
    () => (card ? cards.filter((c) => c.setId === card.setId).sort((a, b) => a.number - b.number) : []),
    [cards, card?.setId], // eslint-disable-line react-hooks/exhaustive-deps
  )
  if (!open || !card || !group) return null

  const fresh = new Set(group.cardIds)
  const isOwned = (id: string) => (owned.get(id) ?? 0) > 0 && (!fresh.has(id) || lit.has(id))
  const ownedCount = setCards.filter((c) => isOwned(c.id)).length
  const isLit = lit.has(card.id)
  const remaining = flat.length - idx - 1

  return (
    <div className="rv-back" onClick={close}>
      <div ref={panel} className="rv-panel" role="dialog" aria-modal="true" aria-label="Nouvelle carte" onClick={(e) => e.stopPropagation()}>
        <header className="rv-head">
          <SetLogo setId={card.setId} name={set?.name} small fallback={null} />
          <div className="grow">
            <b>{set ? setLabel(set) : card.setId}</b>
            <span className="muted"> · {ownedCount}/{setCards.length}</span>
          </div>
          <button className="btn ghost" onClick={close} aria-label="Fermer"><Icon name="close" /></button>
        </header>
        <div className="rv-grid grid" ref={grid} key={card.setId}>
          {setCards.map((c) => {
            const hit = isLit && c.id === card.id
            const locked = !isOwned(c.id)
            return (
              <div key={c.id} data-id={c.id} className={'rv-cell' + (locked ? ' locked' : '') + (hit ? ' hit' : '') + (c.id === card.id ? ' cur' : '')}>
                <CardTile card={c} disabled={false} />
                {hit && (
                  <>
                    <span className="rv-shine" aria-hidden="true" />
                    <span className="rv-sparks" aria-hidden="true">
                      {Array.from({ length: SPARKS }, (_, i) => {
                        const a = (i / SPARKS) * Math.PI * 2 + (i % 2) * 0.2
                        const d = 38 + (i % 3) * 18
                        return <i key={i} style={{ '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`, '--dl': `${(i % 4) * 60}ms`, '--sc': SPARK_COLORS[i % 4] } as React.CSSProperties} />
                      })}
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
        <footer className="rv-foot">
          <div className={'rv-caption' + (isLit ? ' on' : '')} aria-live="polite" aria-atomic="true">
            {isLit ? (
              <>
                <span className="rv-kicker"><Icon name="sparkle" /> Nouvelle carte !</span>
                <b className="rv-name">{card.name}</b>
                <span className="muted">{card.id} · {ownedCount}/{setCards.length} dans l’extension{flat.length > 1 ? ` · ${idx + 1}/${flat.length}` : ''}</span>
              </>
            ) : <span className="muted">&nbsp;</span>}
          </div>
          <div className="rv-actions">
            {remaining > 0 && <button className="btn" onClick={close}>Passer</button>}
            <button className="btn primary" onClick={next}>{remaining > 0 ? 'Suivant' : 'Super !'}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
