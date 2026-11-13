/** Calculs de l'écran Statistiques (période et extension appliquées), partagés par les trois onglets. */
import { collectionTotals, completionByRarity, completionBySet } from '../../lib/calc';
import {
  type Period, bestPulls, bucketFor, completionTimeline, correctionDays, countByBucket, dataStart, dayKey, diffDays, duplicateStock, findGodPacks,
  gainsBySource, isFullPack, journalCoverage, luckSummary, newCardEvents, onlyPacks, packDays, packStreaks, packsByBooster, periodStart,
  pulledByRarity, scopeEvents, sharesOf, tradesOf, typeDistribution,
} from '../../lib/stats';
import { setIdOf } from '../../lib/setId';
import type { CalcData } from '../dashboard/useCalcData';

export function buildStatsView(d: CalcData, period: Period, setId: string, today: string) {
  const sid = setId && d.sets.some((s) => s.id === setId) ? setId : null;
  const boosterSet = (id: string) => d.boosterById.get(id)?.setId ?? setIdOf(id);
  const lk = { cardById: d.cardById, boosterSet };
  const cards = sid ? d.cards.filter((c) => c.setId === sid) : d.cards;
  const ids = new Set(cards.map((c) => c.id));
  const coverage = journalCoverage(d.history);
  const firstDay = coverage.since ?? today;
  const pStart = periodStart(period, today);
  const from = pStart && pStart > firstDay ? pStart : firstDay;
  const span = Math.max(1, diffDays(from, today) + 1);
    const bucket0 = bucketFor(span);
  const evs = scopeEvents(d.history, { from: pStart, setId: sid }, lk);
  const entries = onlyPacks(evs);
  // Une seule définition du pack partout : saisie de 4 cartes ou plus.
  const fullPacks = entries.filter(isFullPack);
  const shares = sharesOf(evs), trades = tradesOf(evs);
  const news = newCardEvents(d.owned, d.history, { from: pStart, ids });
  const shareDays = shares.map((e) => dayKey(e.date)), tradeDays = trades.map((e) => dayKey(e.date)), fullDays = packDays(fullPacks);
  // Axe du temps : de la première donnée de la période, pas du début du journal (T17).
  const chartFrom = dataStart(from, fullDays, shareDays, tradeDays);
  const bucket = chartFrom === from ? bucket0 : bucketFor(Math.max(1, diffDays(chartFrom, today) + 1));
  const allPackDays = packDays(onlyPacks(scopeEvents(d.history, { from: null, setId: sid }, lk)).filter(isFullPack));
  return {
    sid, cards, from, bucket, span, coverage, fullPacks, partial: entries.length - fullPacks.length, shares, trades,
    timeline: completionTimeline(d.cards, d.owned, d.history, today, { setId: sid, from }),
    packBuckets: countByBucket(fullDays, bucket, chartFrom, today),
    shareBuckets: countByBucket(shareDays, bucket, chartFrom, today),
    tradeBuckets: countByBucket(tradeDays, bucket, chartFrom, today),
    streaks: packStreaks(allPackDays, today),
    luck: luckSummary(fullPacks, d.cardById, d.rates),
    pulled: pulledByRarity(fullPacks, d.cardById),
    gains: gainsBySource(news),
    importDays: correctionDays(d.history, from),
    totals: collectionTotals(cards, d.owned),
    byRarity: completionByRarity(cards, d.owned),
    bySet: completionBySet(d.cards, d.owned),
    boosters: packsByBooster(fullPacks),
    best: bestPulls(fullPacks, d.cardById, 14),
    niceCount: bestPulls(fullPacks, d.cardById, Number.MAX_SAFE_INTEGER).length,
    god: findGodPacks(fullPacks, d.cardById),
    stock: duplicateStock(cards, d.owned, d.cards),
    types: typeDistribution(cards, d.owned),
    allPackDays,
  };
}
export type StatsView = ReturnType<typeof buildStatsView>;
