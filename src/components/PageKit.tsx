import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { Sheet } from './Sheet'

/*
 * Kit de page épuré (lot L01) : briques communes des écrans. Règles d'usage dans CLAUDE.md (§5, « UI »).
 * N'utilise que les jetons --fs-* et --r-* (styles en fin de styles.css, section « Kit de page »).
 */

/**
 * Ligne « Changer » (48 px) : logo(s) + libellé + valeur + « Changer ». Remplace un sélecteur rarement modifié
 * (extension, booster…). Toute la ligne est cliquable ; la feuille de choix appartient à l'écran.
 */
export function ChangeLine({ logo, label, detail, onChange, action = 'Changer' }: {
  logo?: ReactNode
  label: ReactNode
  /** Valeur ou précision à droite du libellé (ex. « 190 / 217 »). */
  detail?: ReactNode
  onChange: () => void
  action?: string
}) {
  return (
    <button type="button" className="change-line" onClick={onChange}>
      {logo && <span className="cl-logo">{logo}</span>}
      <span className="cl-label">{label}</span>
      {detail !== undefined && <span className="cl-detail">{detail}</span>}
      <span className="cl-action">{action}</span>
    </button>
  )
}

/** Puce « Filtres · n » (n = filtres actifs, masqué si 0) qui ouvre la feuille `FilterSheet` de l'écran. */
export function FilterButton({ count, onClick, label = 'Filtres' }: { count: number; onClick: () => void; label?: string }) {
  return (
    <button type="button" className={'chip filter-btn' + (count > 0 ? ' active' : '')} onClick={onClick} aria-haspopup="dialog"
      aria-label={count > 0 ? `${label}, ${count} actif${count > 1 ? 's' : ''}` : label}>
      <Icon name="filter" />{label}{count > 0 && <span aria-hidden="true"> · {count}</span>}
    </button>
  )
}

/** Feuille des filtres : sections titrées (`FilterSection`), « Réinitialiser » et « Voir » en pied. */
export function FilterSheet({ title = 'Filtres', count, onReset, onClose, children }: {
  title?: string
  /** Nombre de filtres actifs : « Réinitialiser » est inactif à 0. */
  count: number
  onReset: () => void
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="filter-sheet">{children}</div>
      <div className="filter-foot">
        <button type="button" className="btn" onClick={onReset} disabled={count === 0}><Icon name="undo" />Réinitialiser</button>
        <button type="button" className="btn primary" onClick={onClose}>Voir</button>
      </div>
    </Sheet>
  )
}

/** Section titrée d'une `FilterSheet`. */
export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className="filter-sec" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  )
}

/**
 * Ligne de liste standard (56 px mini) : vignette (44 × 60, ex. image de carte) ou icône, titre (deux lignes au plus),
 * sous-ligne facultative d'une ligne, information à droite, chevron facultatif.
 * `onClick` ou `to` rendent la ligne cliquable ; `actions` (sélecteur, bouton « Retirer »…) restent à l'extérieur
 * de la zone cliquable pour ne pas imbriquer de boutons. À placer dans `<ul className="list"><li>`.
 */
export function ListRow({ thumb, icon, title, sub, right, chevron, onClick, to, actions, className, label }: {
  thumb?: ReactNode
  icon?: IconName
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  chevron?: boolean
  onClick?: () => void
  to?: string
  actions?: ReactNode
  className?: string
  /** Nom accessible de la zone cliquable, si le titre seul ne suffit pas. */
  label?: string
}) {
  const body = <>
    {thumb ? <span className="lr-thumb">{thumb}</span> : icon && <span className="tile-ic lr-ic"><Icon name={icon} /></span>}
    <span className="lr-txt">
      <span className="lr-title">{title}</span>
      {sub && <span className="lr-sub">{sub}</span>}
    </span>
    {right !== undefined && <span className="lr-right">{right}</span>}
    {chevron && <Icon name="chev" className="lr-chev" />}
  </>
  const main = to
    ? <Link to={to} className="lr-main" aria-label={label}>{body}</Link>
    : onClick
      ? <button type="button" className="lr-main" onClick={onClick} aria-label={label}>{body}</button>
      : <div className="lr-main">{body}</div>
  return (
    <div className={'list-row' + (className ? ` ${className}` : '')}>
      {main}
      {actions && <div className="lr-actions">{actions}</div>}
    </div>
  )
}

export interface SegOption<T extends string> {
  value: T; label: string; icon?: IconName
  /** Nom complet pour les lecteurs d'écran quand le libellé est abrégé (ex. « 10 » → « 10 boosters »). */
  aria?: string
}

/**
 * Sélecteur à segments sur une seule ligne : libellés courts, jamais sur deux lignes ;
 * défile horizontalement si la place manque (le segment choisi reste visible).
 */
export function SegTabs<T extends string>({ options, value, onChange, label }: {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  /** Nom du groupe pour les lecteurs d'écran. */
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [value])
  return (
    <div ref={ref} className="seg-tabs" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} aria-label={o.aria} title={o.aria} className={o.value === value ? 'on' : undefined} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} />}{o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Bouton d'action principal qui dit pourquoi il est inactif : `hint` (5 mots au plus, ex. « Choisis les deux cartes »)
 * s'affiche sous le bouton tant que `disabled` est vrai. Les autres props vont au `<button>` (classe `btn primary` par défaut).
 */
export function ActionButton({ hint, disabled, className = 'btn primary', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { hint?: string }) {
  const id = useId()
  const showHint = !!disabled && !!hint
  return (
    <span className="action-btn">
      <button type="button" {...rest} className={className} disabled={disabled} aria-describedby={showHint ? id : rest['aria-describedby']}>{children}</button>
      {showHint && <small id={id} className="btn-hint">{hint}</small>}
    </span>
  )
}
