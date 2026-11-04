import type { Card, HistoryEvent, PackSlotRates, Rarity } from '../types';
import { RARE_RARITIES, RARITY_ORDER } from '../calc/rules';
import { approxVariancePerPack, expectedCountPerPack } from '../calc/probability';
import { type Bucket, addDays, bucketStart, dayKey, diffDays, nextBucket } from './dates';

export type PackEv = Extract<HistoryEvent, { kind: 'pack' }>;
export const onlyPacks = (evs: HistoryEvent[]): PackEv[] => evs.filter((e): e is PackEv => e.kind === 'pack' && !e.deleted);

/** Pack « complet » : au moins 4 cartes (les saisies d'une seule carte sont des ajouts partiels, pas des ouvertures). */
export const FULL_PACK_MIN = 4;
export const isFullPack = (e: PackEv): boolean => e.cardIds.length >= FULL_PACK_MIN;

/** Points de pack gagnés par ouverture (règle du jeu : 5 par pack). */
export const PACK_POINTS_PER_PACK = 5;

export interface CountPoint { start: string; count: number; }

/** Compte d'événements par tranche (jour/semaine/mois), tranches vides comprises, de `from` à `to`. */
export function countByBucket(days: string[], bucket: Bucket, from: string, to: string): CountPoint[] {
  const m = new Map<string, number>();
  for (const d of days) { const k = bucketStart(d, bucket); m.set(k, (m.get(k) ?? 0) + 1); }
  const out: CountPoint[] = [];
  for (let s = bucketStart(from, bucket); s <= to; s = nextBucket(s, bucket)) out.push({ start: s, count: m.get(s) ?? 0 });
  return out;
}

export interface Streaks { current: number; longest: number; activeDays: number; }

/** Séries de jours consécutifs avec au moins une ouverture. `current` ne tombe à 0 que si ni aujourd'hui ni hier n'ont d'ouverture. */
export function packStreaks(days: string[], today: string): Streaks {
  const set = [...new Set(days)].sort();
  let longest = 0, run = 0, prev = '';
  for (const d of set) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }
  let current = 0;
  const has = new Set(set);
  let d = has.has(today) ? today : addDays(today, -1);
  while (has.has(d)) { current++; d = addDays(d, -1); }
  return { current, longest, activeDays: set.length };
}

/** Raretés tirées (compte par rareté, tous packs). */
export function pulledByRarity(packs: PackEv[], cardById: Map<string, Card>): Partial<Record<Rarity, number>> {
  const out: Partial<Record<Rarity, number>> = {};
  for (const e of packs) for (const id of e.cardIds) {
    const r = cardById.get(id)?.rarity;
    if (r) out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

export interface RarityLuck { rarity: Rarity; actual: number; expected: number; ratio: number; variance: number; }
export interface LuckSummary {
  /** Packs pris en compte (avec taux connus). */
  packs: number;
  rows: RarityLuck[];
  /** Réel / attendu pour les raretés « rares ». */
  rareActual: number; rareExpected: number; ratio: number;
  /** Score z cumulé sur les raretés rares. */
  z: number;
  /** Percentile de chance 0..100 : part des joueurs théoriques moins chanceux que vous (approx. normale). */
  percentile: number;
}

/** Fonction de répartition de la loi normale centrée réduite (Abramowitz-Stegun). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * Chance sur les packs complets : tirées vs attendues (taux saisis). Seuls les packs d'un booster avec taux comptent.
 * Le percentile est approximatif (loi normale sur la somme des raretés rares).
 */
export function luckSummary(packs: PackEv[], cardById: Map<string, Card>, rates: PackSlotRates[], rarities: Rarity[] = RARE_RARITIES): LuckSummary {
  const byBooster = new Map<string, PackSlotRates[]>();
  for (const r of rates) (byBooster.get(r.boosterId) ?? byBooster.set(r.boosterId, []).get(r.boosterId)!).push(r);
  const rows: RarityLuck[] = rarities.map((rarity) => ({ rarity, actual: 0, expected: 0, ratio: 0, variance: 0 }));
  let n = 0;
  for (const e of packs) {
    const r = byBooster.get(e.boosterId);
    if (!r || !isFullPack(e)) continue;
    n++;
    for (const row of rows) {
      row.expected += expectedCountPerPack(r, row.rarity);
      row.variance += approxVariancePerPack(r, row.rarity);
      for (const id of e.cardIds) if (cardById.get(id)?.rarity === row.rarity) row.actual++;
    }
  }
  for (const row of rows) row.ratio = row.expected ? row.actual / row.expected : 0;
  const rareActual = rows.reduce((s, r) => s + r.actual, 0);
  const rareExpected = rows.reduce((s, r) => s + r.expected, 0);
  const variance = rows.reduce((s, r) => s + r.variance, 0);
  const z = variance > 0 ? (rareActual - rareExpected) / Math.sqrt(variance) : 0;
  return { packs: n, rows, rareActual, rareExpected, ratio: rareExpected ? rareActual / rareExpected : 0, z, percentile: n && variance > 0 ? normalCdf(z) * 100 : 50 };
}

/** Libellé de chance selon le percentile. */
export function luckVerdict(percentile: number): string {
  if (percentile >= 90) return 'Très chanceux';
  if (percentile >= 65) return 'Chanceux';
  if (percentile > 35) return 'Dans la moyenne';
  if (percentile > 10) return 'Un peu malchanceux';
  return 'Très malchanceux';
}

export interface GodPack { id: string; date: string; boosterId: string; cardIds: string[]; }
/** Pack « god pack » : pack complet dont toutes les cartes sont de rareté rare (☆ et plus). */
export function findGodPacks(packs: PackEv[], cardById: Map<string, Card>): GodPack[] {
  const rare = new Set<Rarity>(RARE_RARITIES);
  return packs
    .filter((e) => isFullPack(e) && e.cardIds.every((id) => { const r = cardById.get(id)?.rarity; return !!r && rare.has(r); }))
    .map((e) => ({ id: e.id, date: e.date, boosterId: e.boosterId, cardIds: e.cardIds }));
}

export interface BestPull { cardId: string; date: string; boosterId: string; rarity: Rarity; }
const rank = (r: Rarity) => RARITY_ORDER.indexOf(r);
/** Meilleures cartes tirées : rareté décroissante puis plus récentes. P exclu. */
export function bestPulls(packs: PackEv[], cardById: Map<string, Card>, limit = 12): BestPull[] {
  const out: BestPull[] = [];
  for (const e of packs) for (const id of e.cardIds) {
    const r = cardById.get(id)?.rarity;
    if (r && r !== 'P' && rank(r) >= rank('E2')) out.push({ cardId: id, date: e.date, boosterId: e.boosterId, rarity: r });
  }
  const weight = (r: Rarity) => (r === 'C1' ? 100 : r === 'E3' ? 90 : r === 'S2' ? 80 : r === 'S1' ? 70 : r === 'E2' ? 60 : rank(r));
  return out.sort((a, b) => weight(b.rarity) - weight(a.rarity) || b.date.localeCompare(a.date)).slice(0, limit);
}

export const packDays = (packs: PackEv[]): string[] => packs.map((e) => dayKey(e.date));
