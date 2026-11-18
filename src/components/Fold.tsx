import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { prefGet, prefSet } from '../lib/storage'

/**
 * Encart repliable (Réglages) : en-tête cliquable (icône, titre, résumé d'une ligne, chevron) et contenu.
 * L'état ouvert/fermé est mémorisé par `id` (préférence `fold.<id>`). `?ouvrir=<id>` dans l'URL l'ouvre et le fait défiler.
 * Le contenu reste monté quand l'encart est fermé (`hidden`) : ses effets et ses champs (ex. import de fichier) restent disponibles.
 */
export function Fold({ id, icon, title, summary, color, className, children }: {
  id: string; icon: IconName; title: ReactNode; summary?: ReactNode; color?: string; className?: string; children: ReactNode
}) {
  const [params] = useSearchParams()
  const target = params.get('ouvrir') === id
  const [open, setOpen] = useState<boolean>(() => target || prefGet<boolean>(`fold.${id}`, false))
  const ref = useRef<HTMLElement>(null)
  const bodyId = useId()

  // un nouveau lien `?ouvrir=<id>` rouvre l'encart (ajustement pendant le rendu, sans effet)
  const [prevTarget, setPrevTarget] = useState(target)
  if (target !== prevTarget) { setPrevTarget(target); if (target) setOpen(true) }
  useEffect(() => { if (target) ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, [target])

  const toggle = () => { const n = !open; setOpen(n); prefSet(`fold.${id}`, n) }
  return (
    <section ref={ref} className={`card fold${open ? ' open' : ''}${className ? ` ${className}` : ''}`} id={`fold-${id}`}>
      <button type="button" className="fold-hd" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
        <span className="tile-ic" style={color ? { '--c': color } as CSSProperties : undefined}><Icon name={icon} /></span>
        <span className="fold-t">
          <b>{title}</b>
          {summary != null && summary !== '' && <span className="fold-s">{summary}</span>}
        </span>
        <span className="fold-chev"><Icon name="chev" /></span>
      </button>
      <div className="fold-body" id={bodyId} hidden={!open}>{children}</div>
    </section>
  )
}
