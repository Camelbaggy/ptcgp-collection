import { describe, expect, it } from 'vitest';
import type { Card, HistoryEvent, PackSlotRates } from '../types';
import {
  addDays, bucketFor, bucketStart, completionTimeline, countByBucket, duplicateStock, findGodPacks, bestPulls,
  luckSummary, luckVerdict, normalCdf, onlyPacks, packStreaks, pulledByRarity, scopeEvents, typeDistribution, typeFamily, weekStart,
} from './index';

const card = (id: string, rarity: Card['rarity'], extra: Partial<Card> = {}): Card =>
  ({ id, setId: id.split('-')[0], number: 1, name: id, rarity, boosterIds: ['A1-X'], ...extra });
const cards = [card('A1-1', 'D1', { type: 'Feu' }), card('A1-2', 'D2', { type: 'Eau' }), card('A1-3', 'E2', { type: 'Supporter' }), card('B1-1', 'C1', { type: 'Psy Combat' })];
const byId = new Map(cards.map((c) => [c.id, c]));
const pack = (id: string, date: string, cardIds: string[], boosterId = 'A1-X'): HistoryEvent => ({ id, kind: 'pack', date, boosterId, cardIds });

describe('dates', () => {
  it('semaine commence le lundi', () => {
    expect(weekStart('2026-11-04')).toBe('2026-11-02'); // mercredi
    expect(weekStart('2026-11-01')).toBe('2026-10-26'); // dimanche
  });
  it('tranches', () => {
    expect(bucketFor(30)).toBe('day'); expect(bucketFor(90)).toBe('week'); expect(bucketFor(400)).toBe('month');
    expect(bucketStart('2026-11-20', 'month')).toBe('2026-11-01');
  });
  it('addDays traverse les mois', () => expect(addDays('2026-01-30', 3)).toBe('2026-02-02'));
});

describe('countByBucket', () => {
  it('inclut les tranches vides', () => {
    const r = countByBucket(['2026-11-01', '2026-11-01', '2026-11-03'], 'day', '2026-11-01', '2026-11-04');
    expect(r.map((p) => p.count)).toEqual([2, 0, 1, 0]);
  });
});

describe('packStreaks', () => {
  it('série courante et plus longue', () => {
    const s = packStreaks(['2026-10-01', '2026-10-02', '2026-10-03', '2026-11-03', '2026-11-04'], '2026-11-04');
    expect(s).toEqual({ current: 2, longest: 3, activeDays: 5 });
  });
  it('série encore vivante si ouverture hier', () => expect(packStreaks(['2026-11-03'], '2026-11-04').current).toBe(1));
  it('série rompue', () => expect(packStreaks(['2026-11-01'], '2026-11-04').current).toBe(0));
});

describe('completionTimeline', () => {
  it('remonte depuis l\'état actuel', () => {
    const owned = new Map([['A1-1', 1], ['A1-2', 1], ['A1-3', 1]]);
    const h = [pack('p1', '2026-11-02T10:00', ['A1-1', 'A1-2']), pack('p2', '2026-11-04T10:00', ['A1-3'])];
    const t = completionTimeline(cards, owned, h, '2026-11-04');
    expect(t.map((p) => p.owned)).toEqual([2, 2, 3]);
    expect(t[2].total).toBe(4);
  });
  it('échange, partage et correction', () => {
    const owned = new Map([['A1-2', 1]]);
    const h: HistoryEvent[] = [
      { id: 't', kind: 'trade', date: '2026-11-03T10:00', given: 'A1-1', received: 'A1-2' },
      { id: 'c', kind: 'correction', date: '2026-11-04T09:00', changes: [{ cardId: 'A1-3', from: 1, to: 0 }] },
    ];
    // avant la correction A1-3 était possédée (+1) ; avant l'échange A1-1 possédée, A1-2 non
    const t = completionTimeline(cards, owned, h, '2026-11-04');
    expect(t.map((p) => p.owned)).toEqual([2, 1]); // 3/11 : A1-2 + A1-3 ; 4/11 : A1-2
  });
  it('filtre par extension et par début', () => {
    const owned = new Map([['A1-1', 1], ['B1-1', 1]]);
    const h = [pack('p', '2026-11-01T10:00', ['A1-1', 'B1-1'])];
    const t = completionTimeline(cards, owned, h, '2026-11-04', { setId: 'B1', from: '2026-11-03' });
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ owned: 1, total: 1, pct: 1 });
  });
  it('vide si pas d\'historique : un point aujourd\'hui', () => {
    expect(completionTimeline(cards, new Map([['A1-1', 1]]), [], '2026-11-04')).toHaveLength(1);
  });
});

describe('scopeEvents', () => {
  const h: HistoryEvent[] = [
    pack('p1', '2026-11-01T10:00', ['A1-1']), pack('p2', '2026-11-03T10:00', ['B1-1'], 'B1-X'),
    { id: 's', kind: 'share', date: '2026-11-03T11:00', cardId: 'B1-1', direction: 'given' },
    { id: 'x', kind: 'pack', date: '2026-11-03T12:00', boosterId: 'A1-X', cardIds: [], deleted: true },
  ];
  const lk = { cardById: byId, boosterSet: (b: string) => b.split('-')[0] };
  it('période', () => expect(scopeEvents(h, { from: '2026-11-02', setId: null }, lk).map((e) => e.id)).toEqual(['p2', 's']));
  it('extension', () => expect(scopeEvents(h, { from: null, setId: 'B1' }, lk).map((e) => e.id)).toEqual(['p2', 's']));
});

describe('chance', () => {
  const rates: PackSlotRates[] = [{ boosterId: 'A1-X', packType: 'normal', packTypeRate: 100, slots: [{ slot: 1, rates: { E2: 50 } }] }];
  const mk = (n: number, hit: boolean) => Array.from({ length: n }, (_, i) => pack('k' + i + hit, '2026-11-01', hit ? ['A1-3', 'A1-1', 'A1-1', 'A1-1'] : ['A1-1', 'A1-1', 'A1-1', 'A1-1'])) as ReturnType<typeof onlyPacks>;
  it('attendu vs réel', () => {
    const l = luckSummary([...mk(10, true), ...mk(10, false)], byId, rates);
    expect(l.packs).toBe(20);
    expect(l.rareExpected).toBeCloseTo(10);
    expect(l.rareActual).toBe(10);
    expect(l.percentile).toBeCloseTo(50, 0);
  });
  it('chanceux si beaucoup de hits', () => {
    const l = luckSummary(mk(20, true), byId, rates);
    expect(l.percentile).toBeGreaterThan(95);
    expect(luckVerdict(l.percentile)).toBe('Très chanceux');
  });
  it('ignore packs partiels et sans taux', () => {
    const p = [pack('a', '2026-11-01', ['A1-3']), pack('b', '2026-11-01', ['A1-3', 'A1-3', 'A1-3', 'A1-3'], 'Z-X')];
    expect(luckSummary(onlyPacks(p), byId, rates).packs).toBe(0);
  });
  it('normalCdf', () => { expect(normalCdf(0)).toBeCloseTo(0.5, 3); expect(normalCdf(1.96)).toBeCloseTo(0.975, 2); expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2); });
});

describe('tirages', () => {
  it('raretés tirées', () => {
    expect(pulledByRarity(onlyPacks([pack('a', '2026-11-01', ['A1-1', 'A1-1', 'A1-3'])]), byId)).toEqual({ D1: 2, E2: 1 });
  });
  it('god pack : 4+ cartes toutes rares', () => {
    const p = onlyPacks([pack('g', '2026-11-01', ['A1-3', 'A1-3', 'B1-1', 'A1-3', 'A1-3']), pack('n', '2026-11-01', ['A1-3', 'A1-1', 'A1-3', 'A1-3']), pack('s', '2026-11-01', ['A1-3'])]);
    expect(findGodPacks(p, byId).map((g) => g.id)).toEqual(['g']);
  });
  it('meilleurs tirages triés par rareté', () => {
    const p = onlyPacks([pack('a', '2026-11-01', ['A1-3', 'A1-1']), pack('b', '2026-11-02', ['B1-1', 'A1-3'])]);
    expect(bestPulls(p, byId).map((b) => b.cardId)).toEqual(['B1-1', 'A1-3', 'A1-3']);
    expect(bestPulls(p, byId, 1)).toHaveLength(1);
  });
});

describe('collection', () => {
  it('familles de type', () => {
    expect(typeFamily('Psy Combat')).toBe('Psy'); expect(typeFamily('Supporter')).toBe('Dresseur'); expect(typeFamily(undefined)).toBeNull();
  });
  it('répartition par type', () => {
    const d = typeDistribution(cards, new Map([['A1-1', 2], ['A1-3', 1]]));
    expect(d.find((x) => x.type === 'Feu')).toMatchObject({ owned: 1, total: 1 });
    expect(d.find((x) => x.type === 'Eau')).toMatchObject({ owned: 0, total: 1 });
    expect(d[0].owned).toBe(1);
  });
  it('stock de doubles selon TRADE_RULES', () => {
    const s = duplicateStock(cards, new Map([['A1-1', 3], ['A1-2', 1], ['A1-3', 2], ['B1-1', 4]]));
    expect(s.find((x) => x.rarity === 'D1')).toMatchObject({ spare: 2, tradeable: 2, shareable: 2, otherSpare: 0 });
    expect(s.find((x) => x.rarity === 'E2')).toMatchObject({ tradeable: 1, shareable: 0, otherSpare: 0 });
    expect(s.find((x) => x.rarity === 'C1')).toMatchObject({ tradeable: 0, shareable: 0, otherSpare: 3 });
    expect(s.find((x) => x.rarity === 'D2')).toBeUndefined();
  });
});
