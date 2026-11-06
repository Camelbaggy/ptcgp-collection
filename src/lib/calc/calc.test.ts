import { describe, expect, it } from 'vitest';
import type { Card, HistoryEvent, PackSlotRates, Rarity } from '../types';
import {
  analyzeBooster, bestBoosterForCard, expectedPacks, ownedMap, packHitProbability,
  rankBoosters, rankBoostersForWishlist, targetCardProbability, missingCardOdds,
} from './probability';
import {
  collectionTotals, luckStats, completionByBooster, completionByRarity, completionBySet, packsPerMonth,
  shareableDuplicates, tradeableDuplicates,
} from './stats';

const mk = (id: string, rarity: Rarity, boosterIds = ['B1'], setId = 'S'): Card => ({
  id, setId, number: 0, name: id, rarity, boosterIds,
});
// B1 : 4 D1, 2 E2
const cards: Card[] = [
  mk('a', 'D1'), mk('b', 'D1'), mk('c', 'D1'), mk('d', 'D1'), mk('x', 'E2'), mk('y', 'E2'),
  mk('z', 'D1', ['B2']),
];
const rates: PackSlotRates[] = [
  { boosterId: 'B1', packType: 'normal', packTypeRate: 100, slots: [
    { slot: 1, rates: { D1: 100 } },
    { slot: 2, rates: { D1: 50, E2: 50 } },
  ] },
  { boosterId: 'B2', packType: 'normal', packTypeRate: 100, slots: [{ slot: 1, rates: { D1: 100 } }] },
];

describe('packHitProbability', () => {
  it('toutes cartes manquantes : au moins une nouvelle = 1', () => {
    const b = analyzeBooster('B1', cards, rates, ownedMap([]));
    expect(b.pNew).toBeCloseTo(1);
    expect(b.total).toBe(6);
  });
  it('calcul exact sur 2 emplacements', () => {
    // possède a,b,c (D1) ; manque d (D1) et x,y (E2)
    const o = ownedMap([{ cardId: 'a', quantity: 1 }, { cardId: 'b', quantity: 1 }, { cardId: 'c', quantity: 1 }]);
    const b = analyzeBooster('B1', cards, rates, o);
    // slot1 : 1/4 ; slot2 : 0.5*1/4 + 0.5*1 = 0.625 ; P = 1-(0.75*0.375)
    expect(b.pNew).toBeCloseTo(1 - 0.75 * 0.375, 10);
    expect(b.packsNew).toBeCloseTo(1 / b.pNew, 10);
    const e2 = b.byRarity.find((r) => r.rarity === 'E2')!;
    expect(e2.pNew).toBeCloseTo(0.5, 10);
    // 2e copie exactement 1 fois : a,b,c ; slot1 : 3/4 ; slot2 : 0.5*3/4
    expect(b.pSecond).toBeCloseTo(1 - 0.25 * (1 - 0.375), 10);
  });
  it('complet : proba 0 et packs infinis', () => {
    const o = ownedMap(cards.map((c) => ({ cardId: c.id, quantity: 2 })));
    const b = analyzeBooster('B1', cards, rates, o);
    expect(b.pNew).toBe(0);
    expect(b.pMissingSecond).toBe(0);
    expect(b.packsNew).toBe(Infinity);
    expect(b.completion).toBe(1);
    expect(b.completion2).toBe(1);
  });
  it('mélange de types de packs', () => {
    const r: PackSlotRates[] = [
      { boosterId: 'B1', packType: 'normal', packTypeRate: 90, slots: [{ slot: 1, rates: { D1: 100 } }] },
      { boosterId: 'B1', packType: 'rare', packTypeRate: 10, slots: [{ slot: 1, rates: { E2: 100 } }] },
    ];
    const p = packHitProbability(r, cards.filter((c) => c.boosterIds.includes('B1')), (c) => c.rarity === 'E2');
    expect(p).toBeCloseTo(0.1);
  });
  it('taux de type en fraction ou en pourcentage donnent le même résultat', () => {
    const mix = (a: number, b: number): PackSlotRates[] => [
      { boosterId: 'B1', packType: 'normal', packTypeRate: a, slots: [{ slot: 1, rates: { D1: 100 } }] },
      { boosterId: 'B1', packType: 'rare', packTypeRate: b, slots: [{ slot: 1, rates: { E2: 100 } }] },
    ];
    const cs = cards.slice(0, 6);
    const f = (r: PackSlotRates[]) => packHitProbability(r, cs, (c) => c.rarity === 'E2');
    expect(f(mix(0.9, 0.1))).toBeCloseTo(f(mix(90, 10)));
  });
  it('expectedPacks', () => { expect(expectedPacks(0.25)).toBe(4); expect(expectedPacks(0)).toBe(Infinity); });
});

describe('cartes visées et classements', () => {
  it('proba d\'une carte précise', () => {
    // x : slot2 0.5 * 1/2 = 0.25
    expect(targetCardProbability('B1', cards[4], cards, rates)).toBeCloseTo(0.25);
    expect(targetCardProbability('B2', cards[4], cards, rates)).toBe(0);
  });
  it('meilleur booster pour une carte partagée', () => {
    const shared = mk('s', 'D1', ['B1', 'B2']);
    const all = [...cards, shared];
    const best = bestBoosterForCard(shared, all, rates)!;
    expect(best.boosterId).toBe('B2'); // 1/2 contre 1-(1-1/5)(1-0.5/5)...
  });
  it('classement général et wishlist', () => {
    const o = ownedMap([{ cardId: 'z', quantity: 1 }]);
    const ranked = rankBoosters([analyzeBooster('B1', cards, rates, o), analyzeBooster('B2', cards, rates, o)]);
    expect(ranked[0].boosterId).toBe('B1');
    const w = rankBoostersForWishlist(['B1', 'B2'], cards, rates, o, new Set(['x', 'z']));
    expect(w.map((s) => s.boosterId)).toEqual(['B1']); // z déjà possédée
    expect(w[0].p).toBeCloseTo(0.25);
  });
});

describe('boosters sans taux (saisie seule)', () => {
  const promo = [mk('p1', 'P', ['PR'], 'PS')];
  it('exclus du classement wishlist, inclus dans la complétion du set', () => {
    const o = ownedMap([]);
    const w = rankBoostersForWishlist(['B1', 'PR'], [...cards, ...promo], rates, o, new Set(['x', 'p1']));
    expect(w.map((s) => s.boosterId)).toEqual(['B1']);
    expect(completionBySet(promo, ownedMap([{ cardId: 'p1', quantity: 1 }])).PS.owned).toBe(1);
    const h: HistoryEvent[] = [{ id: 'h', kind: 'pack', date: '2026-01-01', boosterId: 'PR', cardIds: ['p1'] }];
    expect(luckStats(h, promo, rates).rareExpected).toBe(0);
  });
});

describe('stats collection', () => {
  const o = ownedMap([
    { cardId: 'a', quantity: 3 }, { cardId: 'x', quantity: 2 }, { cardId: 'b', quantity: 1 }, { cardId: 'z', quantity: 2 },
  ]);
  it('complétion', () => {
    expect(completionBySet(cards, o).S.owned).toBe(4);
    expect(completionByBooster(cards, o).B1.pct).toBeCloseTo(3 / 6);
    expect(completionByBooster(cards, o).B1.pct2).toBeCloseTo(2 / 6);
    expect(completionByRarity(cards, o).E2).toMatchObject({ total: 2, owned: 1, owned2: 1 });
    const t = collectionTotals(cards, o);
    expect(t.copies).toBe(8);
    expect(t.duplicates).toBe(4);
  });
  it('doubles échangeables (raretés éligibles seulement) et partageables', () => {
    const t = tradeableDuplicates(cards, o).map((d) => d.card.id).sort();
    expect(t).toEqual(['a', 'x', 'z']); // x est E2 : échangeable (règle Nicolas)
    expect(shareableDuplicates(cards, o).map((d) => d.card.id).sort()).toEqual(['a', 'z']) // x (E2) non partageable;
    expect(tradeableDuplicates(cards, o)[0].spare).toBeGreaterThan(0);
  });
});

describe('historique', () => {
  const h: HistoryEvent[] = [
    { id: '1', kind: 'pack', date: '2025-01-03', boosterId: 'B1', cardIds: ['a', 'b', 'c', 'd', 'x'] },
    { id: '2', kind: 'pack', date: '2025-01-20', boosterId: 'B1', cardIds: ['a', 'b', 'c', 'd', 'a'] },
    { id: '3', kind: 'pack', date: '2025-02-01', boosterId: 'B1', cardIds: ['x', 'y'] },
    { id: '4', kind: 'share', date: '2025-02-01', cardId: 'a', direction: 'given' },
  ];
  it('packs par mois', () => {
    expect(packsPerMonth(h)).toEqual([{ month: '2025-01', count: 2 }, { month: '2025-02', count: 1 }]);
  });
  it('chance : réel vs espéré', () => {
    const l = luckStats(h, cards, rates, ['E2']);
    expect(l.packs).toBe(3);
    expect(l.rows[0].actual).toBe(3);
    expect(l.rows[0].expected).toBeCloseTo(1.5); // 0.5 par pack
    expect(l.ratio).toBeCloseTo(2);
  });
});

describe('finitions, pool et exclusions', () => {
  const f = (id: string, rarity: Rarity, finish?: string): Card => ({ ...mk(id, rarity), finish });
  const cs = [f('n1', 'D1'), f('n2', 'D1'), f('s1', 'D1', 'Brillante'), f('e1', 'E1')];
  const r = (slot: PackSlotRates['slots'][number]): PackSlotRates[] => [{ boosterId: 'B1', packType: 'normal', packTypeRate: 100, slots: [slot] }];
  it('byFinish : tirage dans le pool (rareté, finition)', () => {
    const rr = r({ slot: 1, rates: { D1: 100 }, byFinish: { Brillante: { D1: 100 } } });
    expect(packHitProbability(rr, cs, (c) => c.id === 's1')).toBeCloseTo(1);
    expect(packHitProbability(rr, cs, (c) => c.id === 'n1')).toBe(0);
    const norm = r({ slot: 1, rates: { D1: 100 }, byFinish: { Normale: { D1: 100 } } });
    expect(packHitProbability(norm, cs, (c) => c.id === 'n1')).toBeCloseTo(0.5);
  });
  it('poolCardIds et excludeCardIds', () => {
    expect(packHitProbability(r({ slot: 1, rates: { D1: 100 }, excludeCardIds: ['n1'] }), cs, (c) => c.id === 'n2')).toBeCloseTo(0.5);
    expect(packHitProbability(r({ slot: 1, rates: { D1: 100 }, poolCardIds: ['n2'] }), cs, (c) => c.id === 'n2')).toBeCloseTo(1);
  });
});

describe('missingCardOdds', () => {
  it('ne garde que les cartes manquantes du booster, triées par proba décroissante', () => {
    const res = missingCardOdds('B1', cards, rates, ownedMap([{ cardId: 'a', quantity: 1 }]));
    expect(res.map((x) => x.card.id)).not.toContain('a');
    expect(res.map((x) => x.card.id)).not.toContain('z');
    expect(res).toHaveLength(5);
    // D1 : slot 1 (1/4) + slot 2 (0,5/4) ; E2 : 0,5/2 = 0,25
    const pD = 1 - (1 - 0.25) * (1 - 0.125);
    expect(res[0].card.rarity).toBe('D1');
    expect(res[0].p).toBeCloseTo(pD, 6);
    expect(res[res.length - 1].p).toBeCloseTo(0.25, 6);
    for (let i = 1; i < res.length; i++) expect(res[i - 1].p).toBeGreaterThanOrEqual(res[i].p);
  });
});

describe('cartes non tirables', () => {
  it("une carte sans booster (récompense de mission) ne dilue pas la proba des autres", () => {
    const r: PackSlotRates[] = [{ boosterId: 'P', packType: 'normal', packTypeRate: 100, slots: [{ slot: 1, rates: { E3: 1 } }] }];
    const pika = mk('pika', 'E3', ['P']);
    const mewInPack = mk('mew', 'E3', ['P']);
    const mewReward = mk('mew', 'E3', []);
    expect(targetCardProbability('P', pika, [pika, mewInPack], r)).toBeCloseTo(0.005, 6);
    expect(targetCardProbability('P', pika, [pika, mewReward], r)).toBeCloseTo(0.01, 6);
    expect(targetCardProbability('P', mewReward, [pika, mewReward], r)).toBe(0);
  });
});
