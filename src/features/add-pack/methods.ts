import type { IconName } from '../../components/Icon'

/**
 * Organisation de l'onglet Ajout : 4 catégories (selon ce que l'on a ouvert dans le jeu), chacune
 * avec ses méthodes, la recommandée en premier. Les méthodes qui lisent l'écran du téléphone
 * n'existent que dans l'appli Android.
 */
export type AddCat = 'booster' | 'boosters' | 'set' | 'mass'
export type AddMethod = 'shot' | 'manual' | 'screen' | 'shots' | 'video' | 'pz'

export const CATS: { id: AddCat; label: string; icon: IconName; sub: string }[] = [
  { id: 'booster', label: '1 booster', icon: 'pack', sub: 'Note les cartes du booster que tu viens d\'ouvrir' },
  { id: 'boosters', label: '10 boosters', icon: 'layers', sub: 'Ajoute d\'un coup une ouverture de plusieurs boosters' },
  { id: 'set', label: '1 extension', icon: 'book', sub: 'Remets à jour les quantités de toute une extension' },
  { id: 'mass', label: 'MAJ massive', icon: 'sync', sub: 'Remets à jour plusieurs extensions d\'un coup' },
]

export const METHOD_LABEL: Record<AddMethod, { label: string; icon: IconName }> = {
  shot: { label: 'Capture d\'écran', icon: 'upload' },
  manual: { label: 'Saisie manuelle', icon: 'search' },
  screen: { label: 'Lecture d\'écran', icon: 'video' },
  shots: { label: 'Captures', icon: 'cards' },
  video: { label: 'Vidéo', icon: 'video' },
  pz: { label: 'Pokémon-Zone', icon: 'sync' },
}

const ANDROID: Record<AddCat, AddMethod[]> = {
  booster: ['shot', 'manual'],
  boosters: ['screen', 'shots', 'video', 'manual'],
  set: ['pz', 'screen', 'video', 'manual'],
  mass: ['pz'],
}
/** Sur le web : pas de lecture de l'écran du téléphone. */
const WEB: Record<AddCat, AddMethod[]> = {
  booster: ['shot', 'manual'],
  boosters: ['shots', 'video', 'manual'],
  set: ['pz', 'video', 'manual'],
  mass: ['pz'],
}

/** Méthodes d'une catégorie, la recommandée en premier. */
export const methodsFor = (cat: AddCat, native: boolean): AddMethod[] => (native ? ANDROID : WEB)[cat]

/** Méthode affichée : la dernière choisie si elle existe ici, sinon la recommandée. */
export function pickMethod(cat: AddCat, native: boolean, saved: string | undefined): AddMethod {
  const list = methodsFor(cat, native)
  return list.includes(saved as AddMethod) ? (saved as AddMethod) : list[0]
}

/**
 * Anciennes adresses (`#/ajout?onglet=…`) et nouvelles (`onglet=booster|boosters|extension|massive`).
 * `pz` : retour du favori ou de la synchro, `pz1` : synchro d'une seule extension.
 */
export function fromOnglet(onglet: string | null): { cat: AddCat; method?: AddMethod; grid?: boolean } | null {
  switch (onglet) {
    case 'saisie': return { cat: 'booster', method: 'manual', grid: false }
    case 'grille': return { cat: 'booster', method: 'manual', grid: true }
    case 'booster': return { cat: 'booster' }
    case 'boosters': case 'recap': return { cat: 'boosters' }
    case 'maj': return { cat: 'set', method: 'manual' }
    case 'video': return { cat: 'set', method: 'video' }
    case 'lecture': return { cat: 'set', method: 'screen' }
    case 'import': case 'pz1': return { cat: 'set', method: 'pz' }
    case 'extension': return { cat: 'set' }
    case 'pz': case 'massive': return { cat: 'mass', method: 'pz' }
    default: return null
  }
}
