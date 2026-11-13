import { describe, expect, it } from 'vitest';
import type { Card, HistoryEvent, PackSlotRates } from '../types';
import {
  addDays, dataStart, bucketFor, bucketStart, completionTimeline, countByBucket, duplicateStock, findGodPacks, bestPulls,
  luckSummary, luckVerdict, normalCdf, onlyPacks, isFullPack, packDays, packsByBooster, packStreaks, pulledByRarity, scopeEvents, typeDistribution, typeFamily, weekStart,
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

describe('dataStart', () => {
  it('commence à la première donnée de la période, jamais avant le début', () => {
    expect(dataStart('2026-01-01', ['2026-09-10', '2026-10-01'], ['2026-08-02'])).toBe('2026-08-02');
    expect(dataStart('2026-09-01', ['2026-08-10'], [])).toBe('2026-09-01');
    expect(dataStart('2026-09-01')).toBe('2026-09-01');
  });
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
  const rates: PackSlotRates[] = [{ boosterId: 'A1-X', packType: 'normal', packTypeRate: 100, slots: [{ slot: 1, rates: { D1: 100 } }, { slot: 2, rates: { D1: 100 } }, { slot: 3, rates: { D1: 100 } }, { slot: 4, rates: { D1: 50, E2: 50 } }] }];
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
  it('stock de doubles selon les règles de l’accueil', () => {
    const s = duplicateStock(cards, new Map([['A1-1', 3], ['A1-2', 1], ['A1-3', 2], ['B1-1', 4]]));
    // D1 : toutes possédées -> plus échangeable ; partage à partir du 3e exemplaire.
    expect(s.find((x) => x.rarity === 'D1')).toMatchObject({ spare: 2, tradeable: 0, shareable: 1 });
    expect(s.find((x) => x.rarity === 'E2')).toMatchObject({ tradeable: 0, shareable: 0 });
    expect(s.find((x) => x.rarity === 'C1')).toMatchObject({ spare: 3, tradeable: 0, shareable: 0 });
    expect(s.find((x) => x.rarity === 'D2')).toBeUndefined();
  });
});

describe('packs complets uniquement', () => {
  const four = ['A1-1', 'A1-1', 'A1-2', 'A1-3'];
  const evs = onlyPacks([
    pack('f1', '2026-11-03T10:00', four), pack('f2', '2026-11-04T10:00', four, 'B1-X'),
    pack('s1', '2026-11-02T10:00', ['A1-1']), pack('s2', '2026-11-04T11:00', ['A1-1', 'A1-2', 'A1-3'], 'B1-X'),
  ]);
  const full = evs.filter(isFullPack);
  it('seuil à 4 cartes', () => expect(full.map((e) => e.id)).toEqual(['f1', 'f2']));
  it('barres par jour', () => {
    const c = countByBucket(packDays(full), 'day', '2026-11-02', '2026-11-04');
    expect(c.map((x) => x.count)).toEqual([0, 1, 1]);
  });
  it('séries et jours actifs', () => {
    expect(packStreaks(packDays(full), '2026-11-04')).toEqual({ current: 2, longest: 2, activeDays: 2 });
    expect(packStreaks(packDays(evs), '2026-11-04').activeDays).toBe(3);
  });
  it('par booster', () => expect(packsByBooster(full)).toHaveLength(2));
  it('les cartes partielles comptent toujours pour la rareté tirée', () => expect(pulledByRarity(evs, byId).D1).toBe(6));
});

import { byCardOrder, calendarWeeks, friendStats, luckSeries, missingCards, newCardEvents, pulledCards, streakRuns, weekdayHourGrid, duplicateCards } from './index';

describe('détails : cartes', () => {
  it('missingCards filtre rareté / extension / booster', () => {
    const owned = new Map([['A1-1', 1]]);
    expect(missingCards(cards, owned).map((c) => c.id)).toEqual(['A1-2', 'A1-3', 'B1-1']);
    expect(missingCards(cards, owned, { rarity: 'E2' }).map((c) => c.id)).toEqual(['A1-3']);
    expect(missingCards(cards, owned, { setId: 'B1' }).map((c) => c.id)).toEqual(['B1-1']);
    expect(missingCards(cards, owned, { boosterId: 'nope' })).toEqual([]);
  });
  it('byCardOrder trie par numéro', () => {
    expect([card('A1-2', 'D1', { number: 2 }), card('A1-1', 'D1', { number: 1 })].sort(byCardOrder).map((c) => c.id)).toEqual(['A1-1', 'A1-2']);
  });
  it('newCardEvents : première copie seulement, récents d\'abord', () => {
    const owned = new Map([['A1-1', 2], ['A1-2', 1]]);
    const h = [pack('p1', '2026-11-01T10:00', ['A1-1']), pack('p2', '2026-11-02T10:00', ['A1-2', 'A1-1']), pack('p3', '2026-11-03T10:00', ['A1-1'])];
    // A1-1 : 0 -> 1 (p1) -> 2 (p2) -> 3 ? l'état actuel vaut 2, donc avant p3=1, avant p2=0 ; p1 non pris en compte (-1 -> 0 hors borne)
    const r = newCardEvents(owned, h);
    expect(r.map((x) => x.cardId)).toEqual(['A1-2', 'A1-1']);
    expect(newCardEvents(owned, h, { from: '2026-11-02' }).length).toBe(2);
    expect(newCardEvents(owned, h, { from: '2026-11-03' })).toEqual([]);
    expect(newCardEvents(owned, h, { ids: new Set(['A1-2']) }).map((x) => x.cardId)).toEqual(['A1-2']);
  });
  it('duplicateCards : échangeable / partageable', () => {
    const o = new Map([['A1-1', 3], ['A1-2', 1], ['A1-3', 2], ['B1-1', 2]]);
    const r = duplicateCards(cards, o);
    // A1-1 (D1, 3 ex.) : partageable au-delà de 2 ; E2 complète -> non échangeable ; C1 jamais.
    expect(r.map((x) => [x.card.id, x.spare, x.tradeable, x.shareable])).toEqual([['A1-1', 2, false, true], ['A1-3', 1, false, false], ['B1-1', 1, false, false]]);
  });
  it('pulledCards compte et filtre', () => {
    const ps = onlyPacks([pack('a', '2026-11-01T10:00', ['A1-1', 'A1-1', 'A1-2']), pack('b', '2026-11-02T10:00', ['A1-1'])]);
    const r = pulledCards(ps, byId);
    expect(r[0]).toMatchObject({ count: 3, last: '2026-11-02T10:00' });
    expect(pulledCards(ps, byId, (c) => c.rarity === 'D2').map((x) => x.card.id)).toEqual(['A1-2']);
  });
});

describe('détails : activité', () => {
  it('weekdayHourGrid : lundi = 0 et heure', () => {
    const g = weekdayHourGrid(['2026-11-02T08:15', '2026-11-02T08:50', '2026-11-04T20:00', '2026-11-05']);
    expect(g.byWeekday).toEqual([2, 0, 1, 1, 0, 0, 0]);
    expect(g.grid[0][8]).toBe(2); expect(g.byHour[20]).toBe(1);
    expect(g).toMatchObject({ max: 2, total: 4, withTime: 3 });
  });
  it('calendarWeeks : semaines complètes lundi→dimanche', () => {
    const w = calendarWeeks(['2026-11-04', '2026-11-04'], '2026-11-04', '2026-11-10');
    expect(w).toHaveLength(2);
    expect(w[0][0]).toMatchObject({ day: '2026-11-02', inRange: false });
    expect(w[0][2]).toMatchObject({ day: '2026-11-04', count: 2, inRange: true });
  });
  it('streakRuns : plus longues d\'abord', () => {
    const r = streakRuns(['2026-10-01', '2026-10-02', '2026-10-03', '2026-11-03', '2026-11-04', '2026-11-04']);
    expect(r).toEqual([{ start: '2026-10-01', end: '2026-10-03', length: 3 }, { start: '2026-11-03', end: '2026-11-04', length: 2 }]);
  });
  it('friendStats ignore les saisies sans ami', () => {
    const h: HistoryEvent[] = [
      { id: '1', kind: 'share', date: '2026-11-01T10:00', cardId: 'A1-1', direction: 'given', friend: 'Léa' },
      { id: '2', kind: 'trade', date: '2026-11-02T10:00', given: 'A1-1', received: 'A1-2', friend: ' Léa ' },
      { id: '3', kind: 'trade', date: '2026-11-02T11:00', given: 'A1-1', received: 'A1-2', friend: 'Tom' },
      { id: '4', kind: 'share', date: '2026-11-02T12:00', cardId: 'A1-1', direction: 'received' },
    ];
    expect(friendStats(h)).toEqual([{ friend: 'Léa', shares: 1, trades: 1, total: 2 }, { friend: 'Tom', shares: 0, trades: 1, total: 1 }]);
  });
});

describe('détails : chance dans le temps', () => {
  const rates: PackSlotRates[] = [{ boosterId: 'A1-X', packType: 'normal', packTypeRate: 100, slots: [{ slot: 1, rates: { D1: 100 } }, { slot: 2, rates: { D1: 100 } }, { slot: 3, rates: { D1: 100 } }, { slot: 4, rates: { D1: 50, E2: 50 } }] }];
  it('cumule pack après pack, ignore les packs partiels', () => {
    const ps = onlyPacks([
      pack('b', '2026-11-02T10:00', ['A1-3', 'A1-1', 'A1-1', 'A1-1']),
      pack('a', '2026-11-01T10:00', ['A1-1', 'A1-1', 'A1-1', 'A1-1']),
      pack('c', '2026-11-03T10:00', ['A1-3']),
    ]);
    const s = luckSeries(ps, byId, rates);
    expect(s.map((p) => p.packs)).toEqual([1, 2]);
    expect(s.map((p) => p.actual)).toEqual([0, 1]);
    expect(s[1].date).toBe('2026-11-02T10:00');
    expect(s[1].percentile).toBeGreaterThan(0);
  });
});
