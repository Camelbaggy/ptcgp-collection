# Holothèque

Suivi de collection Pokémon TCG Pocket, gratuit, hors connexion, sans pub.

**Application : https://camelbaggy.github.io/ptcgp-collection/**

## Fonctionnalités

- Ajout rapide de packs (saisie, grille, mise à jour en masse)
- Import par vidéo et par capture d'écran
- Collection par extension, avec quantités par carte
- Meilleurs boosters à ouvrir (probabilités de nouvelle carte)
- Échanges et partages
- Évènements du jeu
- Tier list méta, avec QR code de deck à scanner dans le jeu
- Pokédex
- Statistiques
- Synchronisation via Google Drive (optionnelle)

## Installation

- **Android** : appli native (fichier `.apk` dans les [Releases](https://github.com/Camelbaggy/ptcgp-collection/releases)) ou, dans Chrome ou Brave, menu ⋮ → « Installer l'application ».
- **iPhone** (Safari) : Partager → « Sur l'écran d'accueil ».
- **PC** (Chrome, Edge, Brave) : icône d'installation dans la barre d'adresse.

## Confidentialité

Vos données restent dans votre navigateur. Si vous activez la synchronisation, elles sont copiées dans le dossier caché de l'application sur **votre propre** Google Drive. Pas de publicité, pas de suivi.

## Développement

```bash
npm ci
npm run dev     # serveur de développement
npm test        # tests unitaires (Vitest)
npm run lint    # oxlint
npm run build   # build de production
```

Les images de cartes sont téléchargées au moment du déploiement (GitHub Actions) et ne sont jamais versionnées dans le dépôt.

## Structure du dépôt

| Dossier | Contenu |
|---|---|
| `src/` | Appli React 19 + TypeScript (`lib/` logique et données, `features/` un dossier par écran, `components/`) |
| `public/data/` | Données de référence (cartes, extensions, boosters, taux) |
| `scripts/` | Scripts Node exécutés au déploiement (images, logos, méta, nouvelles extensions) |
| `android/`, `native/` | Appli Android Capacitor et plugin natif |
| `.github/workflows/` | CI, déploiement, mises à jour automatiques, APK |
| `docs/` | Documentation (voir ci-dessous) |

Pour reprendre le projet : lire d'abord [`CLAUDE.md`](CLAUDE.md) (règles et architecture), puis [`docs/android.md`](docs/android.md) pour Android et [`docs/journal.md`](docs/journal.md) pour l'historique des outils d'import.

## Crédits et avertissement

Projet de fan, non affilié à Nintendo, Creatures, GAME FREAK ni The Pokémon Company. Pokémon et ses personnages sont © Nintendo / Creatures / GAME FREAK / The Pokémon Company ; les images de cartes restent leur propriété.

Sources de données : Pokekalos, Poképédia, Serebii, TCGdex, flibustier/pokemon-tcg-pocket-database, Limitless TCG, PokeAPI.
