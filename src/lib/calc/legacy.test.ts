import { describe, expect, it } from 'vitest';
import type { Card, OwnedCard, PackSlotRates } from '../types';
import { analyzeBooster, expectedHits, ownedMap } from './probability';

/**
 * Comparaison avec l'onglet « Probabilités » de l'ancien tableur, booster C1-Mewtwo :
 *   609 cartes (copies), complétion 84,07 %, proba 1ère 3,82 %, packs/1ère 26,16, proba 2e 23,25 %.
 * L'inventaire actuel (owned.json) a bougé depuis cette capture : tolérances en conséquence.
 *
 * Différences expliquées :
 *  - le tableur somme les p par carte (espérance du nombre de nouvelles cartes par pack) ; nous
 *    calculons « au moins une nouvelle » (légèrement plus bas) ; `expectedHits` reproduit le tableur ;
 *  - « Proba 2e » du tableur = cartes à exactement 1 exemplaire => `pSecond` ;
 *  - complétion : le tableur répartit les cartes « Tous » au prorata, nous comptons directement le pool du booster.
 */
const files = import.meta.glob('../../../public/data/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const get = <T,>(n: string): T | undefined => files[`../../../public/data/${n}.json`] as T | undefined;
const ready = !!get('cards') && !!get('rates') && !!get('owned');

describe.skipIf(!ready)('valeurs historiques du tableur', () => {
  it('C1-Mewtwo', () => {
    const cards = get<Card[]>('cards')!;
    const rates = get<PackSlotRates[]>('rates')!;
    const owned = ownedMap(get<OwnedCard[]>('owned')!);
    const id = 'C1-Mewtwo';
    const a = analyzeBooster(id, cards, rates, owned);
    expect(Math.abs(a.completion - 0.8407)).toBeLessThan(0.01);
    expect(Math.abs(a.pNew - 0.0382)).toBeLessThan(0.003);
    expect(Math.abs(a.packsNew - 26.16)).toBeLessThan(3);
    expect(Math.abs(a.pSecond - 0.2325)).toBeLessThan(0.03);
    // méthode du tableur (somme des p) : plus proche, toujours >= « au moins une »
    const bc = cards.filter((c) => c.boosterIds.includes(id));
    const legacyNew = expectedHits(rates.filter((r) => r.boosterId === id), bc, (c) => (owned.get(c.id) ?? 0) === 0);
    expect(legacyNew).toBeGreaterThanOrEqual(a.pNew);
    expect(Math.abs(legacyNew - 0.0382)).toBeLessThan(0.003);
  });
});
