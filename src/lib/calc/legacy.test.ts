import { describe, expect, it } from 'vitest';
import type { Card, OwnedCard, PackSlotRates } from '../types';
import { analyzeBooster, ownedMap } from './probability';

/**
 * Comparaison avec l'onglet « Probabilités » de l'ancien tableur (31 lignes copiées ci-dessous :
 * boosterId, complétion, proba 1ère, proba 2e). Inventaire : private-data/owned.json (ignoré par git ;
 * test sauté s'il est absent). L'inventaire a un peu bougé depuis la capture : tolérances en points.
 *
 * Correspondance avec le tableur :
 *  - « Proba 1ère » = somme des p par carte jamais possédée (espérance)  => `legacyNew`
 *  - « Proba 2e »  = somme des p par carte possédée exactement 1 fois     => `legacySecond`
 *  - les emplacements à finition (B4b/A4b) tirent dans le pool (rareté, finition), pas dans toute la rareté.
 */
const pub = import.meta.glob('../../../public/data/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const priv = import.meta.glob('../../../private-data/owned.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const cards = pub['../../../public/data/cards.json'] as Card[] | undefined;
const rates = pub['../../../public/data/rates.json'] as PackSlotRates[] | undefined;
const ownedRows = priv['../../../private-data/owned.json'] as OwnedCard[] | undefined;
const ready = !!cards && !!rates && !!ownedRows;

// [boosterId, complétion %, proba 1ère %, proba 2e %]

const LEGACY: [string, number, number, number][] = [
  ['C1-Mewtwo', 84.07, 3.82, 23.25], ['C1-Pikachu', 83.19, 3.63, 21.30], ['B3-Unique', 93.59, 2.25, 14.45],
  ['B2a-Unique', 93.89, 2.23, 6.59], ['B1-Altaria', 93.53, 2.17, 18.60], ['B1-Braségali', 93.53, 2.17, 7.53],
  ['B1a-Unique', 92.23, 2.13, 9.24], ['A3b-Unique', 91.59, 2.12, 6.00], ['B2-Unique', 93.59, 2.11, 18.32],
  ['A3a-Unique', 91.26, 2.09, 6.04], ['A1a-Unique', 90.70, 2.06, 2.95], ['A2a-Unique', 89.58, 2.05, 8.50],
  ['A3-Solgaleo', 92.86, 2.04, 5.70], ['B3a-Unique', 95.41, 2.03, 7.19], ['A4a-Unique', 92.38, 2.02, 7.79],
  ['A2b-Unique', 90.09, 1.95, 5.19], ['B4a-Unique', 91.82, 1.95, 8.68], ['A4-Lugia', 94.12, 1.94, 7.39],
  ['B1-Léviator', 94.24, 1.93, 12.72], ['A4-Ho-Oh', 92.65, 1.92, 13.83], ['B4-Unique', 93.99, 1.90, 19.80],
  ['B2b-Unique', 88.89, 1.86, 6.52], ['A3-Lunala', 93.57, 1.85, 13.04], ['A1-Mewtwo', 94.44, 1.82, 6.60],
  ['B3b-Unique', 92.45, 1.81, 5.44], ['A2-Palkia', 92.86, 1.73, 14.71], ['A1-Pikachu', 95.28, 1.68, 4.06],
  ['A2-Dialga', 93.65, 1.52, 6.71], ['A1-Dracaufeu', 96.06, 1.12, 9.48], ['B4b-Unique', 98.60, 0.93, 49.28],
  ['A4b-Unique', 98.94, 0.67, NaN], // 2e : onglet Calculs A4b cassé dans le tableur (finition vide), valeur non fiable
];

describe.skipIf(!ready)('valeurs historiques du tableur', () => {
  const owned = ownedMap(ownedRows ?? []);
  for (const [id, compl, p1, p2] of LEGACY) {
    it(id, () => {
      const a = analyzeBooster(id, cards!, rates!, owned);
      expect(a.total).toBeGreaterThan(0);
      // complétion : le tableur répartit les cartes « Tous » au prorata
      expect(Math.abs(a.completion * 100 - compl)).toBeLessThan(2);
      expect(Math.abs(a.legacyNew * 100 - p1)).toBeLessThan(0.3);
      if (!Number.isNaN(p2)) expect(Math.abs(a.legacySecond * 100 - p2)).toBeLessThan(Math.max(2.5, p2 * 0.2));
      // « au moins une » est toujours <= somme des p
      expect(a.pNew).toBeLessThanOrEqual(a.legacyNew + 1e-12);
    });
  }
});
