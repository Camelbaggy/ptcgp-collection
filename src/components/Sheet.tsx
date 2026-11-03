import { useEffect, type ReactNode } from 'react'

export function Sheet({ title, onClose, children, full }: { title: string; onClose: () => void; children: ReactNode; full?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className={'sheet' + (full ? ' full' : '')} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
