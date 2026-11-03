# PTCGP Collection — CLAUDE.md

Application personnelle de suivi de collection Pokémon TCG Pocket (PTCGP) pour Nicolas.
Elle remplace un Google Sheet devenu lent et rigide. Interface **en français**.

## Objectifs
- **PWA installable** (Android + PC), **100 % hors connexion** (données + images embarquées), **gratuite** (hébergement GitHub Pages).
- La **saisie** est le cœur : ajout d'un booster ouvert, partage, échange, en quelques touches.
- **Dashboard** : meilleurs boosters à ouvrir, cartes visées, cartes échangeables/partageables, beaucoup de statistiques.
- **Ajouter une nouvelle extension doit être trivial** : importer une liste de cartes (collée depuis un site communautaire, fichier, ou source publique) + saisir les taux d'obtention dans un formulaire. Aucun calcul spécifique à une extension : tout est générique et dérivé des données.
- Plus tard (hors périmètre actuel) : import de la collection via captures d'écran (OCR). Pas de datamining du jeu ni d'interception du compte Nintendo (CGU).

## Stack
- Vite + React 19 + TypeScript, React Router.
- Persistance locale : IndexedDB via **Dexie** (`dexie-react-hooks` pour l'UI réactive).
- PWA : `vite-plugin-pwa` (precache de l'app et des images).
- Tests : `vitest` pour la logique pure (`src/lib`).
- Pas de backend. Sauvegarde = export/import JSON ; synchro PC/Android plus tard (fichier sur Google Drive).
- Mobile-first, thème clair/sombre, cibles tactiles ≥ 44 px.

## Source historique (Google Sheet "PTCGP")
Spreadsheet id `1PVpPwx8N_jqjekd5rL1yGWCXcgockLVuxPcW34nhD90`. Onglets clés :
- `Cards list` : Set, Deck (booster), #, Nom, Nom EN, Type, Niveau, Rareté, ID_Carte (`A1-1`), Finition.
- `Inventaire` : ID_Carte, Nom, Rareté, Quantité.
- `Probabilités` : par set+booster, % complétion, proba d'obtenir une 1ère / 2e copie manquante, packs attendus, détail par rareté.
- `Calculs <set>` : calculs de probas par extension (logique à généraliser).
- `Collection`, `1ères manquantes`, `2e manquantes`, `Pokédex`, `Decks`, `Traduction`, `Historique ajout/partage/échange`, `Listes`, `ID PokeAPI`.
- Scripts Apps Script dans le même dossier Drive : `Ajout.gs`, `Partage.gs`, `Échange.gs`, `Déclencheur.gs`.

Raretés : `D1`–`D4` (losanges, D4 = EX), `E1`–`E3` (étoiles), `S1`–`S2` (chromatiques), `C1` (couronne). "1ère" = 1re copie (pour compléter), "2e" = 2e copie (pour échanger/partager).

## Modèle de données (contrat partagé — `src/lib/types.ts`)
```ts
type Rarity = 'D1'|'D2'|'D3'|'D4'|'E1'|'E2'|'E3'|'S1'|'S2'|'C1'|'P'; // P = promo / sans rareté
interface CardSet  { id: string; name: string; nameEn?: string; releaseDate?: string; order: number; }
interface Booster  { id: string; setId: string; name: string; }            // id ex. "A1-Mewtwo", "B3-Unique"
interface Card     { id: string; setId: string; number: number; name: string; nameEn?: string;
                     type?: string; stage?: string; rarity: Rarity; boosterIds: string[];
                     finish?: string; image?: string; /* chemin relatif public/cards/... */ }
// Taux d'obtention par emplacement de booster (données saisies, pas de logique en dur)
interface PackSlotRates { boosterId: string; packType: 'normal'|'rare'|string; packTypeRate: number; // proba du type de pack
                          slots: { slot: number; rates: Partial<Record<Rarity, number>> }[]; }      // % par rareté
interface OwnedCard { cardId: string; quantity: number; }
interface Wishlist   { cardId: string; priority: number; }
type HistoryEvent =
  | { id: string; kind: 'pack'; date: string; boosterId: string; cardIds: string[] }
  | { id: string; kind: 'share'; date: string; cardId: string; direction: 'given'|'received'; friend?: string }
  | { id: string; kind: 'trade'; date: string; given: string; received: string; friend?: string; tokens?: number };
```
Tables Dexie : `sets`, `boosters`, `cards`, `rates`, `owned`, `wishlist`, `history`, `meta`.
Les données de référence sont livrées en JSON dans `public/data/` et importées au premier lancement / à chaque mise à jour.

## Organisation du code
- `src/lib/types.ts` — types ci-dessus (seule source de vérité).
- `src/lib/db.ts` — schéma Dexie, chargement initial des JSON.
- `src/lib/calc/` — moteur pur et testé : probas 1ère/2e copie par booster, packs attendus, meilleurs boosters, stats.
- `src/lib/importers/` — import d'une nouvelle extension (texte collé / JSON / source publique).
- `src/features/<écran>/` — un dossier par écran : `dashboard`, `add-pack`, `share`, `trade`, `collection`, `wishlist`, `new-set`, `stats`, `settings`.
- `scripts/` — scripts Node one-shot (extraction GSheet, téléchargement d'images).
- `public/data/*.json`, `public/cards/<setId>/<id>.webp` (images ≤ 300 px de large, webp).
- `docs/` — notes (logique héritée, sources publiques).

## Règles de travail
- Lancer `npm run build` et `npx vitest run` avant de considérer une tâche finie.
- Chaque agent ne modifie que les dossiers de son lot ; `types.ts` et `package.json` ne changent qu'avec accord du chef de projet.
- Les choix de fonctionnalités ou d'interface qui ne sont pas évidents sont remontés à Nicolas (le noter dans `docs/questions.md`).
- Textes UI en français ; code et noms de variables en anglais.
