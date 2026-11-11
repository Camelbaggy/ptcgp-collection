import { useLiveQuery } from 'dexie-react-hooks';
import { useContext, useMemo } from 'react';
import { db } from '../../lib/db';
import { analyzeBooster, type BoosterAnalysis, type OwnedMap } from '../../lib/calc';
import { BoostersContext, CardsContext, OwnedContext, RatesContext, SetsContext, WishlistContext } from '../../lib/dataContext';
import type { Booster, Card, CardSet, HistoryEvent, PackSlotRates, Wishlist } from '../../lib/types';

export interface CalcData {
  loading: boolean;
  sets: CardSet[];
  boosters: Booster[];
  cards: Card[];
  rates: PackSlotRates[];
  owned: OwnedMap;
  wishlist: Wishlist[];
  history: HistoryEvent[];
  cardById: Map<string, Card>;
  boosterById: Map<string, Booster>;
  analyses: BoosterAnalysis[];
}

const NONE: never[] = [];
const NO_MAP = new Map<never, never>();

/**
 * Données des écrans Accueil et Stats, et analyse de chaque booster.
 * Les tables de référence et les quantités viennent du DataProvider partagé ;
 * seul l'historique complet est lu ici (il ne sert qu'à ces deux écrans).
 */
export function useCalcData(): CalcData {
  const sets = useContext(SetsContext);
  const boosters = useContext(BoostersContext);
  const cards = useContext(CardsContext);
  const rates = useContext(RatesContext);
  const owned = useContext(OwnedContext);
  const wishlist = useContext(WishlistContext);
  const history = useLiveQuery(() => db.history.orderBy('date').toArray(), []);

  const loading = !sets || !boosters || !cards || !rates || !owned || !wishlist || !history;

  // Analyse des boosters : ne dépend ni de l'historique ni de la liste de souhaits.
  const analyses = useMemo(() => {
    if (!boosters || !cards || !rates || !owned) return NONE as BoosterAnalysis[];
    // Boosters de saisie seule (promos, SP) ou sans taux : exclus des classements de probabilités.
    return boosters.list.filter((x) => !x.entryOnly && rates.some((q) => q.boosterId === x.id)).map((x) => analyzeBooster(x.id, cards.raw, rates, owned));
  }, [boosters, cards, rates, owned]);

  return useMemo(() => ({
    loading,
    sets: sets ?? NONE,
    boosters: boosters?.list ?? NONE,
    cards: cards?.raw ?? NONE,
    rates: rates ?? NONE,
    owned: owned ?? NO_MAP,
    wishlist: wishlist ?? NONE,
    history: history ?? NONE,
    cardById: cards?.byId ?? NO_MAP,
    boosterById: boosters?.byId ?? NO_MAP,
    analyses: loading ? NONE : analyses,
  }), [loading, sets, boosters, cards, rates, owned, wishlist, history, analyses]);
}
