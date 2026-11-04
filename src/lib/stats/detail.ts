/** Agrégations pour les fiches de détail (drill-down) des statistiques. Fonctions pures, sans accès à la base. */
import type { Card, HistoryEvent, PackSlotRates, Rarity } from '../types';
import { RARITY_ORDER, TRADE_RULES, type TradeRules } from '../calc/rules';
import { expectedCountPerPack, approxVariancePerPack } from '../calc/probability';
import { RARE_RARITIES } from '../calc/rules';
import { addDays, dayKey, dayToMs, weekStart } from './dates';
import { effects } from './timeline';
import { type PackEv, isFullPack, normalCdf } from './packs';

/** Ordre naturel des cartes : extension puis numéro, puis identifiant. */
export const byCardOrder = (a: Card, b: Card): number => a.setId.localeCompare(b.setId) || a.number - b.number || a.id.localeCompare(b.id);

/** Cartes jamais possédées (quantité 0), triées par rareté décroissante d'intérêt puis ordre naturel. */
export function missingCards(cards: Card[], owned: Map<string, number>, opts: { rarity?: Rarity | null; setId?: string | null; boosterId?: string | null } = {}): Card[] {
  return cards
    .filter((c) => (owned.get(c.id) ?? 0) <= 0 && (!opts.rarity || c.rarity === opts.rarity) && (!opts.setId || c.setId === opts.setId) && (!opts.boosterId || c.boosterIds.includes(opts.boosterId)))
    .sort(byCardOrder);
}

export interface NewCard { cardId: string; date: string; }
/**
 * Cartes devenues « nouvelles » (première copie) au fil de l'historique, de la plus récente à la plus ancienne.
 * Remonte depuis l'état actuel comme completionTimeline : fiable sans connaître l'inventaire initial.
 */
export function newCardEvents(owned: Map<string, number>, history: HistoryEvent[], opts: { from?: string | null; ids?: Set<string> | null } = {}): NewCard[] {
  const qty = new Map(owned);
  const evs = history.filter((e) => !e.deleted).sort((a, b) => b.date.localeCompare(a.date));
  const out: NewCard[] = [];
  for (const e of evs) {
    for (const [id, d] of effects(e)) {
      if (opts.ids && !opts.ids.has(id)) continue;
      const after = qty.get(id) ?? 0, before = after - d;
      qty.set(id, before);
      if (before <= 0 && after > 0 && (!opts.from || dayKey(e.date) >= opts.from)) out.push({ cardId: id, date: e.date });
    }
  }
  return out; // déjà du plus récent au plus ancien
}

export interface WeekdayHour { grid: number[][]; byWeekday: number[]; byHour: number[]; max: number; total: number; withTime: number; }
/** Ouvertures de packs par jour de semaine (lundi = 0) et par heure. `withTime` = événements dont l'heure est connue. */
export function weekdayHourGrid(dates: string[]): WeekdayHour {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const byWeekday = new Array<number>(7).fill(0), byHour = new Array<number>(24).fill(0);
  let withTime = 0;
  for (const date of dates) {
    const wd = (new Date(dayToMs(dayKey(date))).getUTCDay() + 6) % 7;
    byWeekday[wd]++;
    const h = date.length >= 13 ? Number(date.slice(11, 13)) : NaN;
    if (Number.isInteger(h) && h >= 0 && h < 24) { grid[wd][h]++; byHour[h]++; withTime++; }
  }
  return { grid, byWeekday, byHour, max: Math.max(0, ...grid.flat()), total: dates.length, withTime };
}

export interface CalDay { day: string; count: number; inRange: boolean; }
/** Calendrier façon GitHub : colonnes = semaines (lundi→dimanche) couvrant [from, to]. */
export function calendarWeeks(days: string[], from: string, to: string): CalDay[][] {
  const counts = new Map<string, number>();
  for (const d of days) counts.set(d, (counts.get(d) ?? 0) + 1);
  const weeks: CalDay[][] = [];
  for (let s = weekStart(from); s <= to; s = addDays(s, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => { const day = addDays(s, i); return { day, count: counts.get(day) ?? 0, inRange: day >= from && day <= to }; }));
  }
  return weeks;
}

export interface Run { start: string; end: string; length: number; }
/** Séries de jours consécutifs actifs, les plus longues d'abord (à égalité, les plus récentes). */
export function streakRuns(days: string[]): Run[] {
  const set = [...new Set(days)].sort();
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (const d of set) {
    if (cur && addDays(cur.end, 1) === d) { cur.end = d; cur.length++; } else { cur = { start: d, end: d, length: 1 }; runs.push(cur); }
  }
  return runs.sort((a, b) => b.length - a.length || b.end.localeCompare(a.end));
}

export interface FriendStat { friend: string; shares: number; trades: number; total: number; }
/** Amis les plus actifs (partages + échanges). Les saisies sans ami sont ignorées. */
export function friendStats(evs: HistoryEvent[]): FriendStat[] {
  const m = new Map<string, FriendStat>();
  for (const e of evs) {
    if ((e.kind !== 'share' && e.kind !== 'trade') || !e.friend?.trim()) continue;
    const f = e.friend.trim();
    const s = m.get(f) ?? { friend: f, shares: 0, trades: 0, total: 0 };
    if (e.kind === 'share') s.shares++; else s.trades++;
    s.total++;
    m.set(f, s);
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.friend.localeCompare(b.friend));
}

export interface StockCard { card: Card; qty: number; spare: number; tradeable: boolean; shareable: boolean; }
/** Cartes en double (quantité >= 2) avec leur statut d'échange / de partage (TRADE_RULES). Rareté décroissante dans RARITY_ORDER, puis ordre naturel. */
export function duplicateCards(cards: Card[], owned: Map<string, number>, rules: TradeRules = TRADE_RULES): StockCard[] {
  const out: StockCard[] = [];
  for (const card of cards) {
    const qty = owned.get(card.id) ?? 0;
    if (qty < 2) continue;
    out.push({
      card, qty, spare: qty - 1,
      tradeable: rules.tradableRarities.includes(card.rarity) && qty >= rules.minQuantityToOffer,
      shareable: rules.shareableRarities === 'all' || rules.shareableRarities.includes(card.rarity),
    });
  }
  return out.sort((a, b) => RARITY_ORDER.indexOf(a.card.rarity) - RARITY_ORDER.indexOf(b.card.rarity) || byCardOrder(a.card, b.card));
}

export interface PulledCard { card: Card; count: number; last: string; }
/** Cartes distinctes tirées dans les packs (filtrables), avec nombre de tirages et dernière date. Plus tirées d'abord. */
export function pulledCards(packs: PackEv[], cardById: Map<string, Card>, filter: (c: Card) => boolean = () => true): PulledCard[] {
  const m = new Map<string, PulledCard>();
  for (const e of packs) for (const id of e.cardIds) {
    const card = cardById.get(id);
    if (!card || !filter(card)) continue;
    const s = m.get(id) ?? { card, count: 0, last: '' };
    s.count++;
    if (e.date > s.last) s.last = e.date;
    m.set(id, s);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
}

export interface LuckPoint { date: string; packs: number; actual: number; expected: number; ratio: number; percentile: number; }
/** Chance cumulée pack après pack (packs complets d'un booster avec taux), ordre chronologique. */
export function luckSeries(packs: PackEv[], cardById: Map<string, Card>, rates: PackSlotRates[], rarities: Rarity[] = RARE_RARITIES): LuckPoint[] {
  const byBooster = new Map<string, PackSlotRates[]>();
  for (const r of rates) (byBooster.get(r.boosterId) ?? byBooster.set(r.boosterId, []).get(r.boosterId)!).push(r);
  const rs = new Set<Rarity>(rarities);
  let n = 0, actual = 0, expected = 0, variance = 0;
  const out: LuckPoint[] = [];
  for (const e of [...packs].sort((a, b) => a.date.localeCompare(b.date))) {
    const r = byBooster.get(e.boosterId);
    if (!r || !isFullPack(e)) continue;
    n++;
    for (const rar of rarities) { expected += expectedCountPerPack(r, rar); variance += approxVariancePerPack(r, rar); }
    for (const id of e.cardIds) { const x = cardById.get(id)?.rarity; if (x && rs.has(x)) actual++; }
    const z = variance > 0 ? (actual - expected) / Math.sqrt(variance) : 0;
    out.push({ date: e.date, packs: n, actual, expected, ratio: expected ? actual / expected : 0, percentile: variance > 0 ? normalCdf(z) * 100 : 50 });
  }
  return out;
}
