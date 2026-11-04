import { useEffect, useRef, type ReactNode } from 'react'

export function Sheet({ title, onClose, children, full }: { title: string; onClose: () => void; children: ReactNode; full?: boolean }) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    // Focus the close button, give focus back to the opener on close.
    const prev = document.activeElement as HTMLElement | null
    close.current?.focus()
    return () => prev?.focus?.()
  }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className={'sheet' + (full ? ' full' : '')} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button ref={close} className="btn ghost" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
