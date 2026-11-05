import { describe, expect, it } from 'vitest';
import type { Card, Rarity } from '../types';
import { completeRarities, keepCount, shareOffers, tradeOffers } from './offers';

const card = (id: string, rarity: Rarity, finish?: string): Card =>
  ({ id, setId: id.split('-')[0], number: Number(id.split('-')[1]), name: id, nameEn: id, type: 'Grass', rarity, boosterIds: [], finish } as Card);

describe('règles Échange/Partage', () => {
  const cards = [
    card('A1-1', 'D1'), card('A1-2', 'D1'), card('A4b-3', 'D1', 'Brillante'),
    card('A1-4', 'D4'), card('A1-5', 'E1'), card('A1-6', 'E3'), card('A1-7', 'C1'), card('A1-8', 'S2'), card('A1-9', 'E1'),
  ];

  it('garde 2 exemplaires des D1–D4, 1 pour les brillantes et les étoiles', () => {
    expect(keepCount(cards[0])).toBe(2);
    expect(keepCount(cards[2])).toBe(1);
    expect(keepCount(cards[4])).toBe(1);
  });

  it('échange : seuils, E3/C1 exclues, tri rareté puis exemplaires', () => {
    const owned = new Map([['A1-1', 3], ['A1-2', 0], ['A4b-3', 2], ['A1-4', 2], ['A1-5', 2], ['A1-6', 5], ['A1-7', 4], ['A1-8', 0]]);
    const t = tradeOffers(cards, owned);
    expect(t.map((x) => x.card.id)).toEqual(['A1-5', 'A1-1', 'A4b-3']);
    expect(t.find((x) => x.card.id === 'A1-1')!.spare).toBe(1);
  });

  it("échange : une rareté complète n'est plus proposée", () => {
    const owned = new Map([['A1-1', 5], ['A1-2', 1], ['A4b-3', 3], ['A1-5', 3]]);
    expect(completeRarities(cards, owned).has('D1')).toBe(true);
    expect(tradeOffers(cards, owned).map((x) => x.card.id)).toEqual(['A1-5']);
  });

  it('partage : D1–D4 seulement, sans filtre de complétion, tri par exemplaires', () => {
    const owned = new Map([['A1-1', 5], ['A1-2', 1], ['A4b-3', 2], ['A1-4', 2], ['A1-5', 3]]);
    expect(shareOffers(cards, owned).map((x) => [x.card.id, x.spare])).toEqual([['A1-1', 3], ['A4b-3', 1]]);
  });
});
