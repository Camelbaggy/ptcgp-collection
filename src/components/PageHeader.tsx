import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

/** Couleur de section (alignée sur la navigation) : `data-section` sur la page expose `--section`. */
export type Section = 'violet' | 'blue' | 'teal' | 'pink' | 'orange' | 'yellow' | 'red' | 'green' | 'grey'

/** En-tête de page : tuile d'icône colorée, grand titre, sous-titre discret, actions à droite. */
export function PageHeader({ icon, title, sub, children }: { icon: IconName; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="ph">
      <span className="tile-ic ph-ic" style={{ '--c': 'var(--section, var(--violet))' } as CSSProperties}><Icon name={icon} /></span>
      <div className="ph-txt">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="ph-act">{children}</div>}
    </header>
  )
}

/** Titre de carte : petite tuile d'icône + titre + lien « action › » (comme l'accueil). */
export function SectionHead({ icon, title, action, to, onAction, children }: { icon: IconName; title: ReactNode; action?: string; to?: string; onAction?: () => void; children?: ReactNode }) {
  return (
    <h2 className="sh">
      <span className="tile-ic"><Icon name={icon} /></span>
      <span className="sh-t">{title}</span>
      {children}
      {action && (to
        ? <Link to={to} className="more">{action}<Icon name="chev" /></Link>
        : <button type="button" className="more" onClick={onAction}>{action}<Icon name="chev" /></button>)}
    </h2>
  )
}

/** État vide : icône, texte, action facultative. */
export function EmptyState({ icon = 'inbox', title, text, action }: { icon?: IconName; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="tile-ic"><Icon name={icon} /></span>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}
