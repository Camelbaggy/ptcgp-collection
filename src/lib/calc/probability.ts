import type { Card, PackSlotRates, Rarity } from '../types';
import { RARITY_ORDER } from './rules';

/** Quantités possédées par id de carte (absent = 0). */
export type OwnedMap = Map<string, number>;

export function ownedMap(rows: { cardId: string; quantity: number }[]): OwnedMap {
  const m: OwnedMap = new Map();
  for (const r of rows) m.set(r.cardId, (m.get(r.cardId) ?? 0) + r.quantity);
  return m;
}

/** Proba (0..1) de tirer au moins une carte vérifiant `pred` dans un pack du booster. */
export function packHitProbability(
  rates: PackSlotRates[],
  boosterCards: Card[],
  pred: (c: Card) => boolean,
): number {
  const total = rates.reduce((s, r) => s + r.packTypeRate, 0);
  if (!rates.length || total <= 0 || !boosterCards.length) return 0;
  // effectif par rareté et nombre de cartes « cibles » par rareté
  const n = new Map<Rarity, number>();
  const k = new Map<Rarity, number>();
  for (const c of boosterCards) {
    n.set(c.rarity, (n.get(c.rarity) ?? 0) + 1);
    if (pred(c)) k.set(c.rarity, (k.get(c.rarity) ?? 0) + 1);
  }
  let p = 0;
  for (const pt of rates) {
    let miss = 1;
    for (const slot of pt.slots) {
      let q = 0;
      for (const [r, pct] of Object.entries(slot.rates) as [Rarity, number][]) {
        const nr = n.get(r) ?? 0;
        if (!nr || !pct) continue;
        q += (pct / 100) * ((k.get(r) ?? 0) / nr);
      }
      miss *= 1 - Math.min(1, q);
    }
    p += (pt.packTypeRate / total) * (1 - miss);
  }
  return p;
}

/** Nombre de packs attendus pour un succès de proba p par pack (loi géométrique). */
export const expectedPacks = (p: number): number => (p > 0 ? 1 / p : Infinity);

/** Espérance du nombre de cartes de rareté r par pack. */
export function expectedCountPerPack(rates: PackSlotRates[], rarity: Rarity): number {
  const total = rates.reduce((s, r) => s + r.packTypeRate, 0);
  if (total <= 0) return 0;
  let e = 0;
  for (const pt of rates) {
    let s = 0;
    for (const slot of pt.slots) s += (slot.rates[rarity] ?? 0) / 100;
    e += (pt.packTypeRate / total) * s;
  }
  return e;
}

/** Variance approchée (somme de Bernoulli par emplacement, mélange de types négligé). */
export function approxVariancePerPack(rates: PackSlotRates[], rarity: Rarity): number {
  const total = rates.reduce((s, r) => s + r.packTypeRate, 0);
  if (total <= 0) return 0;
  let v = 0;
  for (const pt of rates)
    for (const slot of pt.slots) {
      const p = (slot.rates[rarity] ?? 0) / 100;
      v += (pt.packTypeRate / total) * p * (1 - p);
    }
  return v;
}

export interface RarityAnalysis {
  rarity: Rarity;
  total: number;
  owned: number; // au moins 1 copie
  owned2: number; // au moins 2 copies
  pNew: number;
  pSecond: number; // carte possédée exactement 1 fois
  pMissingSecond: number; // carte possédée < 2 fois (1ère ou 2e copie manquante)
}

export interface BoosterAnalysis {
  boosterId: string;
  total: number;
  owned: number;
  owned2: number;
  completion: number; // 0..1
  completion2: number; // 0..1
  /** P(au moins une nouvelle carte (1ère copie) dans un pack). */
  pNew: number;
  packsNew: number;
  /** P(au moins une carte possédée exactement 1 fois). */
  pSecond: number;
  packsSecond: number;
  /** P(au moins une carte dont la 2e copie manque : qty<2) — définition du tableur. */
  pMissingSecond: number;
  packsMissingSecond: number;
  byRarity: RarityAnalysis[];
}

export function analyzeBooster(
  boosterId: string,
  allCards: Card[],
  rates: PackSlotRates[],
  owned: OwnedMap,
): BoosterAnalysis {
  const cards = allCards.filter((c) => c.boosterIds.includes(boosterId));
  const qty = (c: Card) => owned.get(c.id) ?? 0;
  const predNew = (c: Card) => qty(c) === 0;
  const predSecond = (c: Card) => qty(c) === 1;
  const predMiss2 = (c: Card) => qty(c) < 2;
  const r = rates.filter((x) => x.boosterId === boosterId);
  const total = cards.length;
  const ow = cards.filter((c) => qty(c) >= 1).length;
  const ow2 = cards.filter((c) => qty(c) >= 2).length;
  const pNew = packHitProbability(r, cards, predNew);
  const pSecond = packHitProbability(r, cards, predSecond);
  const pMissingSecond = packHitProbability(r, cards, predMiss2);
  const byRarity: RarityAnalysis[] = [];
  for (const rar of RARITY_ORDER) {
    const rc = cards.filter((c) => c.rarity === rar);
    if (!rc.length) continue;
    const only = (f: (c: Card) => boolean) => (c: Card) => c.rarity === rar && f(c);
    byRarity.push({
      rarity: rar,
      total: rc.length,
      owned: rc.filter((c) => qty(c) >= 1).length,
      owned2: rc.filter((c) => qty(c) >= 2).length,
      pNew: packHitProbability(r, cards, only(predNew)),
      pSecond: packHitProbability(r, cards, only(predSecond)),
      pMissingSecond: packHitProbability(r, cards, only(predMiss2)),
    });
  }
  return {
    boosterId, total, owned: ow, owned2: ow2,
    completion: total ? ow / total : 0,
    completion2: total ? ow2 / total : 0,
    pNew, packsNew: expectedPacks(pNew),
    pSecond, packsSecond: expectedPacks(pSecond),
    pMissingSecond, packsMissingSecond: expectedPacks(pMissingSecond),
    byRarity,
  };
}

/** Proba par pack d'obtenir précisément la carte `card` dans le booster. */
export function targetCardProbability(
  boosterId: string,
  card: Card,
  allCards: Card[],
  rates: PackSlotRates[],
): number {
  if (!card.boosterIds.includes(boosterId)) return 0;
  const cards = allCards.filter((c) => c.boosterIds.includes(boosterId));
  return packHitProbability(rates.filter((x) => x.boosterId === boosterId), cards, (c) => c.id === card.id);
}

export interface TargetOption { boosterId: string; p: number; packs: number; }

/** Pour une carte visée : probas par booster, triées de la meilleure à la pire. */
export function targetCardOptions(card: Card, allCards: Card[], rates: PackSlotRates[]): TargetOption[] {
  return card.boosterIds
    .map((boosterId) => {
      const p = targetCardProbability(boosterId, card, allCards, rates);
      return { boosterId, p, packs: expectedPacks(p) };
    })
    .filter((o) => o.p > 0)
    .sort((a, b) => b.p - a.p);
}

/** Meilleur booster pour une carte visée (proba la plus haute) ou undefined. */
export function bestBoosterForCard(card: Card, allCards: Card[], rates: PackSlotRates[]): TargetOption | undefined {
  return targetCardOptions(card, allCards, rates)[0];
}

export interface WishlistBoosterScore { boosterId: string; p: number; packs: number; targets: number; }

/** Classement des boosters selon la proba d'obtenir au moins une carte de la wishlist manquante. */
export function rankBoostersForWishlist(
  boosterIds: string[],
  allCards: Card[],
  rates: PackSlotRates[],
  owned: OwnedMap,
  wishlistIds: Set<string>,
): WishlistBoosterScore[] {
  const pred = (c: Card) => wishlistIds.has(c.id) && (owned.get(c.id) ?? 0) === 0;
  return boosterIds
    .map((boosterId) => {
      const cards = allCards.filter((c) => c.boosterIds.includes(boosterId));
      const p = packHitProbability(rates.filter((x) => x.boosterId === boosterId), cards, pred);
      return { boosterId, p, packs: expectedPacks(p), targets: cards.filter(pred).length };
    })
    .filter((s) => s.targets > 0)
    .sort((a, b) => b.p - a.p);
}

/** Classement général : par proba de 1ère copie (défaut) ou autre critère. */
export function rankBoosters(
  analyses: BoosterAnalysis[],
  key: 'pNew' | 'pSecond' | 'pMissingSecond' = 'pNew',
): BoosterAnalysis[] {
  return [...analyses].sort((a, b) => b[key] - a[key]);
}
