import { createContext, useContext } from 'react'

/** Ouvre la recherche globale (feuille de recherche de cartes) depuis n'importe quel écran. */
export const GlobalSearchContext = createContext<() => void>(() => {})
export const useOpenSearch = () => useContext(GlobalSearchContext)
