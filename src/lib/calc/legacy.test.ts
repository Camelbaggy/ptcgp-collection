import { describe, expect, it } from 'vitest';
import type { Card, OwnedCard, PackSlotRates } from '../types';
import { analyzeBooster, ownedMap } from './probability';

/**
 * Comparaison avec l'onglet « Probabilités » de l'ancien tableur (booster A1-Mewtwo) :
 *   609 cartes possédées, complétion 84,07 %, proba 1ère 3,82 %, packs/1ère 26,16, proba 2e 23,25 %.
 * Test ignoré tant que public/data/{cards,rates,owned}.json n'existent pas (livrés par l'agent DATA).
 * `owned.json` doit être l'inventaire du tableur au moment de la capture des valeurs ci-dessus.
 */
const files = import.meta.glob('../../../public/data/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const get = <T,>(n: string): T | undefined => files[`../../../public/data/${n}.json`] as T | undefined;
const ready = !!get('cards') && !!get('rates') && !!get('owned');

describe.skipIf(!ready)('valeurs historiques du tableur', () => {
  it('A1-Mewtwo', () => {
    const cards = get<Card[]>('cards')!;
    const rates = get<PackSlotRates[]>('rates')!;
    const owned = ownedMap(get<OwnedCard[]>('owned')!);
    const a = analyzeBooster('A1-Mewtwo', cards, rates, owned);
    // Tolérances larges : l'inventaire peut avoir bougé depuis la capture des valeurs.
    expect(a.completion).toBeCloseTo(0.9444, 2);
    expect(a.pNew).toBeCloseTo(0.0182, 2);
    expect(a.packsNew).toBeGreaterThan(10);
    expect(a.pSecond).toBeCloseTo(0.0660, 2);
  });
});
