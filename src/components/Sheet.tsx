import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { Icon } from './Icon'
import { lockScroll } from '../lib/scrollLock'

/** Drag distance (px) or flick speed (px/ms) past which releasing the handle closes the sheet. */
const CLOSE_DIST = 110
const CLOSE_SPEED = 0.6

export function Sheet({ title, onClose, children, full }: { title: string; onClose: () => void; children: ReactNode; full?: boolean }) {
  const close = useRef<HTMLButtonElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; y0: number; t: number; y: number; vy: number } | null>(null)
  const [dy, setDy] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'drag' | 'back' | 'out'>('idle')

  useEffect(() => {
    // Focus the close button, give focus back to the opener on close.
    const prev = document.activeElement as HTMLElement | null
    close.current?.focus({ preventScroll: true })
    return () => prev?.focus?.({ preventScroll: true })
  }, [])
  useEffect(() => lockScroll(), [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, select')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, y0: e.clientY, t: e.timeStamp, y: e.clientY, vy: 0 }
    setPhase('drag')
  }
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dt = Math.max(1, e.timeStamp - d.t)
    d.vy = 0.7 * ((e.clientY - d.y) / dt) + 0.3 * d.vy
    d.y = e.clientY
    d.t = e.timeStamp
    const raw = e.clientY - d.y0
    setDy(raw > 0 ? raw : raw / 4) // resist upward pulls
  }
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    const dist = e.clientY - d.y0
    if (dist > CLOSE_DIST || (dist > 20 && d.vy > CLOSE_SPEED)) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (reduce) { onClose(); return }
      setPhase('out')
      setDy((sheet.current?.offsetHeight ?? 600) + 40)
      window.setTimeout(onClose, 200)
    } else {
      setPhase('back')
      setDy(0)
    }
  }

  const moving = phase !== 'idle'
  const style = moving ? { transform: `translateY(${dy}px)`, transition: phase === 'drag' ? 'none' : 'transform .2s ease-out' } : undefined
  // Fade only the backdrop tint (opacity on the container would also fade the sheet).
  const backStyle = moving && dy > 0 ? ({ '--back-a': Math.max(0.1, 1 - dy / 500) } as CSSProperties) : undefined

  return (
    <div className="sheet-back" onClick={onClose} style={backStyle}>
      <div
        ref={sheet}
        className={'sheet' + (full ? ' full' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={style}
        onTransitionEnd={() => phase === 'back' && setPhase('idle')}
      >
        <div className="sheet-drag" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className="sheet-grab" aria-hidden="true" />
          <header className="sheet-head">
            <h2>{title}</h2>
            <button ref={close} className="btn ghost" onClick={onClose} aria-label="Fermer"><Icon name="close" /></button>
          </header>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
