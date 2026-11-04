import type { Card, HistoryEvent, PackSlotRates, Rarity } from '../types';
import type { OwnedMap } from './probability';
import { approxVariancePerPack, expectedCountPerPack } from './probability';
import { RARE_RARITIES, RARITY_ORDER, TRADE_RULES, type TradeRules } from './rules';

export interface Completion { total: number; owned: number; owned2: number; pct: number; pct2: number; }

function completion(cards: Card[], owned: OwnedMap): Completion {
  const total = cards.length;
  const o1 = cards.filter((c) => (owned.get(c.id) ?? 0) >= 1).length;
  const o2 = cards.filter((c) => (owned.get(c.id) ?? 0) >= 2).length;
  return { total, owned: o1, owned2: o2, pct: total ? o1 / total : 0, pct2: total ? o2 / total : 0 };
}

export const completionOf = completion;

function groupBy<T>(items: T[], key: (t: T) => string[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) for (const k of key(it)) (m.get(k) ?? m.set(k, []).get(k)!).push(it);
  return m;
}

export function completionBySet(cards: Card[], owned: OwnedMap): Record<string, Completion> {
  return Object.fromEntries([...groupBy(cards, (c) => [c.setId])].map(([k, v]) => [k, completion(v, owned)]));
}
export function completionByBooster(cards: Card[], owned: OwnedMap): Record<string, Completion> {
  return Object.fromEntries([...groupBy(cards, (c) => c.boosterIds)].map(([k, v]) => [k, completion(v, owned)]));
}
export function completionByRarity(cards: Card[], owned: OwnedMap): Partial<Record<Rarity, Completion>> {
  const g = groupBy(cards, (c) => [c.rarity]);
  const out: Partial<Record<Rarity, Completion>> = {};
  for (const r of RARITY_ORDER) if (g.has(r)) out[r] = completion(g.get(r)!, owned);
  return out;
}

export interface CollectionTotals extends Completion { copies: number; duplicates: number; }

export function collectionTotals(cards: Card[], owned: OwnedMap): CollectionTotals {
  const ids = new Set(cards.map((c) => c.id));
  let copies = 0, duplicates = 0;
  for (const [id, q] of owned) if (ids.has(id) && q > 0) { copies += q; duplicates += Math.max(0, q - 1); }
  return { ...completion(cards, owned), copies, duplicates };
}

export interface DuplicateEntry { card: Card; quantity: number; spare: number; }

/** Cartes échangeables : rareté éligible et quantité ≥ minQuantityToOffer. `spare` = exemplaires en trop (qty-1). */
export function tradeableDuplicates(cards: Card[], owned: OwnedMap, rules: TradeRules = TRADE_RULES): DuplicateEntry[] {
  return cards
    .filter((c) => rules.tradableRarities.includes(c.rarity) && (owned.get(c.id) ?? 0) >= rules.minQuantityToOffer)
    .map((c) => ({ card: c, quantity: owned.get(c.id)!, spare: owned.get(c.id)! - 1 }));
}

/** Cartes partageables (doubles, selon rules.shareableRarities). */
export function shareableDuplicates(cards: Card[], owned: OwnedMap, rules: TradeRules = TRADE_RULES): DuplicateEntry[] {
  return cards
    .filter(
      (c) =>
        (rules.shareableRarities === 'all' || rules.shareableRarities.includes(c.rarity)) &&
        (owned.get(c.id) ?? 0) >= 2,
    )
    .map((c) => ({ card: c, quantity: owned.get(c.id)!, spare: owned.get(c.id)! - 1 }));
}

// ---------- historique ----------

export type PackEvent = Extract<HistoryEvent, { kind: 'pack' }>;
export const packEvents = (h: HistoryEvent[]): PackEvent[] => h.filter((e): e is PackEvent => e.kind === 'pack' && !e.deleted);

export const monthOf = (date: string): string => date.slice(0, 7);

/** Nombre de packs par mois (clé AAAA-MM), trié chronologiquement. */
export function packsPerMonth(history: HistoryEvent[]): { month: string; count: number }[] {
  const m = new Map<string, number>();
  for (const e of packEvents(history)) m.set(monthOf(e.date), (m.get(monthOf(e.date)) ?? 0) + 1);
  return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
}

/** Nombre de packs par extension (setId déduit de l'id du booster via boosterSet). */
export function packsPerSet(history: HistoryEvent[], boosterSet: (boosterId: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of packEvents(history)) {
    const s = boosterSet(e.boosterId);
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

export interface LuckRow { rarity: Rarity; actual: number; expected: number; ratio: number; z: number; }
export interface LuckStats { packs: number; rows: LuckRow[]; rareActual: number; rareExpected: number; ratio: number; }

/** Chance : cartes de rareté r réellement tirées vs espérance selon les taux saisis. */
export function luckStats(
  history: HistoryEvent[],
  cards: Card[],
  rates: PackSlotRates[],
  rarities: Rarity[] = RARE_RARITIES,
): LuckStats {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const packs = packEvents(history);
  const rows: LuckRow[] = rarities.map((rarity) => {
    let actual = 0, expected = 0, variance = 0;
    for (const e of packs) {
      const r = rates.filter((x) => x.boosterId === e.boosterId);
      if (!r.length) continue;
      expected += expectedCountPerPack(r, rarity);
      variance += approxVariancePerPack(r, rarity);
      for (const id of e.cardIds) if (byId.get(id)?.rarity === rarity) actual++;
    }
    return { rarity, actual, expected, ratio: expected ? actual / expected : 0, z: variance ? (actual - expected) / Math.sqrt(variance) : 0 };
  });
  const rareActual = rows.reduce((s, r) => s + r.actual, 0);
  const rareExpected = rows.reduce((s, r) => s + r.expected, 0);
  return { packs: packs.length, rows, rareActual, rareExpected, ratio: rareExpected ? rareActual / rareExpected : 0 };
}
