import { describe, expect, it } from 'vitest';
import type { Card, PackSlotRates, Rarity } from '../types';
import { DEFAULT_POINT_COSTS, packsForPoints, planSet } from './boosterPoints';

const card = (n: number, rarity: Rarity, boosterIds = ['A1-X']): Card =>
  ({ id: `A1-${n}`, setId: 'A1', number: n, name: `c${n}`, nameEn: `c${n}`, rarity, boosterIds } as Card);

const cards = [card(1, 'D1'), card(2, 'D4'), card(3, 'E1'), card(4, 'C1'), card(5, 'D2')];
// Un seul emplacement : 90 % D1, 0,5 % E1 -> D2/D4/C1 jamais tirées.
const rates: PackSlotRates[] = [{ boosterId: 'A1-X', packType: 'normal', packTypeRate: 100, slots: [{ slot: 1, rates: { D1: 90, E1: 0.5 } }] }];

describe('planificateur de points Booster', () => {
  it('ignore les cartes possédées, les couronnes et calcule le total', () => {
    const p = planSet('A1', cards, ['A1-X'], rates, new Map([['A1-5', 1]]), 100);
    expect(p.items.map((i) => i.card.id)).toEqual(['A1-2', 'A1-3', 'A1-1']);
    expect(p.totalCost).toBe(500 + 400 + 35);
    expect(p.shortfall).toBe(835);
    expect(p.packsToEarnShortfall).toBe(167);
    expect(p.byRarity.map((r) => [r.rarity, r.missing, r.total])).toEqual([['D1', 1, 35], ['D4', 1, 500], ['E1', 1, 400]]);
  });

  it('acheter si la carte est trop rare à tirer, ouvrir sinon', () => {
    const p = planSet('A1', cards, ['A1-X'], rates, new Map(), 0);
    const v = Object.fromEntries(p.items.map((i) => [i.card.id, i.verdict]));
    expect(v['A1-1']).toBe('open'); // ~1,1 pack contre 7 packs de points
    expect(v['A1-2']).toBe('buy'); // jamais tirée
    expect(v['A1-3']).toBe('buy'); // 200 packs contre 80
    expect(p.items.find((i) => i.card.id === 'A1-2')!.packsToOpen).toBe(Infinity);
  });

  it('achats conseillés bornés par le solde', () => {
    const p = planSet('A1', cards, ['A1-X'], rates, new Map(), 700);
    // D2 (jamais tirée, 70) puis D4 (jamais tirée, 500) ; E1 (400) ne rentre plus.
    expect(p.recommended.map((i) => i.card.id)).toEqual(['A1-5', 'A1-2']);
    expect(p.spent).toBe(570);
    expect(p.leftover).toBe(130);
    const rich = planSet('A1', cards, ['A1-X'], rates, new Map(), 5000);
    expect(rich.shortfall).toBe(0);
    expect(rich.recommended).toHaveLength(3);
  });

  it('prix personnalisés et packs gagnés', () => {
    const p = planSet('A1', cards, ['A1-X'], rates, new Map(), 0, { ...DEFAULT_POINT_COSTS, D4: 600 });
    expect(p.totalCost).toBe(600 + 400 + 35 + 70);
    expect(packsForPoints(11)).toBe(3);
  });
});
