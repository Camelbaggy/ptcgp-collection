import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../../lib/db';
import { ownedMap, analyzeBooster, type BoosterAnalysis } from '../../lib/calc';
import type { Booster, Card, CardSet, HistoryEvent, PackSlotRates, Wishlist } from '../../lib/types';

export interface CalcData {
  loading: boolean;
  sets: CardSet[];
  boosters: Booster[];
  cards: Card[];
  rates: PackSlotRates[];
  owned: ReturnType<typeof ownedMap>;
  wishlist: Wishlist[];
  history: HistoryEvent[];
  cardById: Map<string, Card>;
  boosterById: Map<string, Booster>;
  analyses: BoosterAnalysis[];
}

/** Lit toutes les tables utiles aux écrans Accueil et Stats, et calcule l'analyse de chaque booster. */
export function useCalcData(): CalcData {
  const sets = useLiveQuery(() => db.sets.orderBy('order').toArray());
  const boosters = useLiveQuery(() => db.boosters.toArray());
  const cards = useLiveQuery(() => db.cards.toArray());
  const rates = useLiveQuery(() => db.rates.toArray());
  const ownedRows = useLiveQuery(() => db.owned.toArray());
  const wishlist = useLiveQuery(() => db.wishlist.toArray());
  const history = useLiveQuery(() => db.history.orderBy('date').toArray());

  const loading = !sets || !boosters || !cards || !rates || !ownedRows || !wishlist || !history;
  return useMemo(() => {
    const c = cards ?? [];
    const b = boosters ?? [];
    const owned = ownedMap(ownedRows ?? []);
    const r = rates ?? [];
    return {
      loading,
      sets: sets ?? [],
      boosters: b,
      cards: c,
      rates: r,
      owned,
      wishlist: wishlist ?? [],
      history: history ?? [],
      cardById: new Map(c.map((x) => [x.id, x])),
      boosterById: new Map(b.map((x) => [x.id, x])),
      // Boosters de saisie seule (promos, SP) ou sans taux : exclus des classements de probabilités.
      analyses: loading ? [] : b.filter((x) => !x.entryOnly && r.some((q) => q.boosterId === x.id)).map((x) => analyzeBooster(x.id, c, r, owned)),
    };
  }, [loading, sets, boosters, cards, rates, ownedRows, wishlist, history]);
}
