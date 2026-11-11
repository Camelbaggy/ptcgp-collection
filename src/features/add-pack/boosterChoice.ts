import { useMemo } from 'react'
import { splitSets, useBoosters, useCards, usePersisted, useSets } from '../../lib/useData'

/** Extension et booster choisis (partagés par toutes les méthodes d'ajout de boosters). */
export function useBoosterChoice() {
  const sets = useSets()
  const boosters = useBoosters()
  const cards = useCards()
  const [setId, setSetId] = usePersisted('add.setId', '')
  const [boosterId, setBoosterId] = usePersisted('add.boosterId', '')
  const withBoosters = useMemo(() => sets.filter((s) => boosters.some((b) => b.setId === s.id)), [sets, boosters])
  const grouped = useMemo(() => splitSets(withBoosters), [withBoosters])
  const curSet = withBoosters.find((s) => s.id === setId) ?? grouped.regular[grouped.regular.length - 1] ?? withBoosters[withBoosters.length - 1]
  const setBoosters = boosters.filter((b) => b.setId === curSet?.id)
  const curBooster = setBoosters.find((b) => b.id === boosterId) ?? setBoosters[0]
  // cartes de l'extension, plus les rééditions d'autres extensions vendues dans ses boosters (packs Deluxe)
  const setCards = useMemo(() => {
    const ids = new Set(boosters.filter((b) => b.setId === curSet?.id).map((b) => b.id))
    return cards.filter((c) => c.setId === curSet?.id || c.boosterIds.some((b) => ids.has(b)))
  }, [cards, boosters, curSet])
  /** Passe sur un booster (et son extension) d'après les cartes reconnues. */
  const switchBooster = (id: string) => {
    const b = boosters.find((x) => x.id === id)
    if (!b) return
    if (b.setId !== curSet?.id && withBoosters.some((s) => s.id === b.setId)) setSetId(b.setId)
    setBoosterId(b.id)
  }
  return { sets, boosters, cards, grouped, curSet, setBoosters, curBooster, setCards, setSetId, setBoosterId, switchBooster }
}
export type BoosterChoice = ReturnType<typeof useBoosterChoice>
