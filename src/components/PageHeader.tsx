import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { HelpSheet, type HelpBlock } from './HelpSheet'
import SyncStatusIcon from '../features/sync/SyncStatusIcon'

/** Couleur de section (alignée sur la navigation) : `data-section` sur la page expose `--section`. */
export type Section = 'violet' | 'blue' | 'teal' | 'pink' | 'orange' | 'yellow' | 'red' | 'green' | 'grey'

/** Bouton icône de l'en-tête de page (44 px) : action secondaire de l'écran. */
export interface HeaderAction {
  icon: IconName
  /** Nom de l'action, lu par les lecteurs d'écran et affiché au survol. */
  label: string
  onClick?: () => void
  /** Lien interne (`#/…`) au lieu d'un clic. */
  to?: string
  /** Petit nombre ou repère sur l'icône (ex. filtres actifs). Masqué si 0, vide ou absent. */
  badge?: number | string
  /** Bouton à bascule (vue liste/grille…) : état appuyé. */
  pressed?: boolean
  /** Action principale de l'écran (ex. « Ajouter ») : bouton plein, couleur de section. */
  primary?: boolean
}

/**
 * En-tête de page : tuile d'icône colorée, titre, sous-titre facultatif (seulement s'il porte une donnée),
 * puis à droite les icônes d'action (`actions`), l'aide « ? » (`help`) et l'état de synchro.
 * `children` reste possible pour un contrôle particulier (rendu avant les icônes).
 */
export function PageHeader({ icon, title, sub, help, actions, children }: {
  icon: IconName; title: ReactNode; sub?: ReactNode
  /** Contenu de la feuille d'aide de l'écran : un bouton « ? » l'ouvre. */
  help?: HelpBlock[]
  actions?: HeaderAction[]
  children?: ReactNode
}) {
  const [helpOpen, setHelpOpen] = useState(false)
  const helpTitle = typeof title === 'string' ? title : ''
  return (
    <header className="ph">
      <span className="tile-ic ph-ic" style={{ '--c': 'var(--section, var(--violet))' } as CSSProperties}><Icon name={icon} /></span>
      <div className="ph-txt">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="ph-act">
        {children}
        {actions?.map((a) => <HeaderIconButton key={a.label} {...a} />)}
        {help && help.length > 0 && <HeaderIconButton icon="help" label="Aide" onClick={() => setHelpOpen(true)} />}
        <SyncStatusIcon />
      </div>
      {helpOpen && help && <HelpSheet page={helpTitle} blocks={help} onClose={() => setHelpOpen(false)} />}
    </header>
  )
}

/** Bouton icône carré de 44 px (en-tête de page, barre d'outils). */
export function HeaderIconButton({ icon, label, onClick, to, badge, pressed, primary }: HeaderAction) {
  const inner = <>
    <Icon name={icon} />
    {badge !== undefined && badge !== 0 && badge !== '' && <span className="ph-badge" aria-hidden="true">{badge}</span>}
  </>
  const name = badge !== undefined && badge !== 0 && badge !== '' ? `${label} (${badge})` : label
  const cls = 'ph-btn' + (primary ? ' primary' : '') + (pressed ? ' on' : '')
  if (to) return <Link to={to} className={cls} aria-label={name} title={label}>{inner}</Link>
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={name} title={label} aria-pressed={pressed}>{inner}</button>
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
