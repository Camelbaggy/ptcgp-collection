import { RARITY_LABEL } from '../lib/useData'
import type { Rarity as R } from '../lib/types'

const NAME: Record<R, string> = {
  D1: '1 losange', D2: '2 losanges', D3: '3 losanges', D4: '4 losanges (ex)',
  E1: '1 étoile', E2: '2 étoiles', E3: '3 étoiles', S1: '1 étoile brillante', S2: '2 étoiles brillantes', C1: 'Couronne', P: 'Promo',
}

/** Rendu unique d'une rareté : symboles pleins, nom complet pour les lecteurs d'écran. */
export function Rarity({ r, className }: { r: R; className?: string }) {
  return <span className={'rarity rarity-' + r + (className ? ' ' + className : '')} role="img" aria-label={NAME[r]} title={NAME[r]}>{RARITY_LABEL[r]}</span>
}
