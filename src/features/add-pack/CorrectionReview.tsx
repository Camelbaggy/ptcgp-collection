import { useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import type { ImportPhase } from '../../lib/videoScan/browser'
import { modifiedLabel, type QtyRow } from '../../lib/correctionReview'
import type { CorrectionEdits } from './correctionEdits'

/**
 * Écran de revue commun aux importeurs qui enregistrent une `correction`
 * (vidéo, lecture d'écran en masse, Pokémon-Zone, saisie en masse) :
 * ligne de carte, liste, barre d'actions et progression. État et enregistrement : `correctionEdits.ts`.
 */

export interface ReviewThumb { src: string; title?: string; lazy?: boolean }

/** Une carte à revoir, prête à afficher. */
export interface ReviewItem extends QtyRow {
  key?: string
  name: string
  /** sous-titre (numéro, rareté) */
  sub: ReactNode
  thumbs: ReviewThumb[]
  doubt?: boolean
}

/** Vignette de revue ; si l'image manque, tuile de secours avec l'identifiant de la carte. */
function ReviewThumbImg({ thumb, label }: { thumb: ReviewThumb; label: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <span className="vimp-thumb vimp-thumb-fb" title={thumb.title}>{label}</span>
  return <img className="vimp-thumb" src={thumb.src} alt="" loading={thumb.lazy ? 'lazy' : undefined} title={thumb.title} onError={() => setBroken(true)} />
}

/** Ligne de revue : vignette(s), nom, « avant → » et quantité modifiable. */
export function ReviewLine({ item, review }: { item: ReviewItem; review: CorrectionEdits }) {
  const v = review.valueOf(item)
  return (
    <div className={'vimp-line' + (item.doubt ? ' doubt' : '') + (v !== item.cur ? ' changed' : '')}>
      {item.thumbs.map((t, i) => <ReviewThumbImg key={i} thumb={t} label={item.cardId} />)}
      <span className="grow vimp-name">
        <span className="nm">{item.name}</span>
        <span className="muted small">{item.sub}{item.doubt && <b className="vimp-flag"> · à vérifier</b>}</span>
      </span>
      <span className="vimp-from mono">{item.cur} →</span>
      <input className="bulk-input" inputMode="numeric" autoComplete="off" aria-label={`Quantité ${item.name}`}
        value={review.edits[item.cardId] ?? String(v)} onFocus={(e) => e.target.select()}
        onChange={(e) => review.edit(item.cardId, e.target.value)} />
    </div>
  )
}

/** Liste de revue ; `empty` s'affiche quand elle est vide, `children` à la suite. */
export function CorrectionList({ items, review, empty, children }: {
  items: ReviewItem[]
  review: CorrectionEdits
  empty?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="bulklist">
      {items.map((it) => <ReviewLine key={it.key ?? it.cardId} item={it} review={review} />)}
      {!items.length && empty ? <p className="muted vimp-none">{empty}</p> : null}
      {children}
    </div>
  )
}

/** Case « Afficher toutes les cartes ». */
export function ShowAllToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="vimp-all"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />Afficher toutes les cartes</label>
}

/** Barre du bas : nombre de cartes modifiées, Annuler, Enregistrer. */
export function ReviewActionBar({ count, onCancel, onSave, cancelLabel = 'Annuler', saveLabel = 'Enregistrer', cancelDisabled, saveDisabled }: {
  count: number
  onCancel: () => void
  onSave: () => void
  cancelLabel?: string
  saveLabel?: string
  cancelDisabled?: boolean
  /** par défaut : rien à enregistrer */
  saveDisabled?: boolean
}) {
  return (
    <div className="actionbar">
      <span>{modifiedLabel(count)}</span>
      <button className="btn ghost" disabled={cancelDisabled} onClick={onCancel}>{cancelLabel}</button>
      <button className="btn primary" disabled={saveDisabled ?? !count} onClick={onSave}>{saveLabel}</button>
    </div>
  )
}

const PHASE_LABEL: Record<ImportPhase, string> = {
  scroll: 'Lecture du défilement',
  cards: 'Lecture des cartes',
  refs: 'Identification des cartes',
}

/** Progression de la lecture d'une vidéo du jeu. */
export function ScanProgress({ phase, done, total }: { phase: ImportPhase; done: number; total: number }) {
  return (
    <div className="card vimp-busy" role="status" aria-live="polite">
      <h3><Icon name="sync" />{PHASE_LABEL[phase]}…</h3>
      <div className="bar"><i style={{ width: `${Math.round((100 * done) / Math.max(1, total))}%` }} /></div>
      <p className="muted">Garde l'appli ouverte pendant l'analyse.</p>
    </div>
  )
}
