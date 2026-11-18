import type { ReactNode } from 'react'
import { Sheet } from './Sheet'

/** Un bloc de la feuille d'aide : intertitre facultatif et texte (déplacé tel quel depuis l'écran). */
export interface HelpBlock {
  title?: string
  text: ReactNode
}

/**
 * Feuille d'aide d'un écran (bouton « ? » de `PageHeader`) : les explications de plus de 8 mots
 * y vont au lieu de rester dans la page. Fermeture par la croix, en glissant ou avec Échap ;
 * le focus revient au bouton « ? » (géré par `Sheet`).
 */
export function HelpSheet({ page, blocks, onClose }: { page: string; blocks: HelpBlock[]; onClose: () => void }) {
  return (
    <Sheet title={page ? `Aide · ${page}` : 'Aide'} onClose={onClose}>
      <div className="help-sheet">
        {blocks.map((b, i) => (
          <section key={i}>
            {b.title && <h3>{b.title}</h3>}
            {typeof b.text === 'string' ? <p>{b.text}</p> : b.text}
          </section>
        ))}
      </div>
    </Sheet>
  )
}
