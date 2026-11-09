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

- **Android** (Chrome ou Brave) : menu ⋮ → « Installer l'application ».
- **iPhone** (Safari) : Partager → « Sur l'écran d'accueil ».
- **PC** (Chrome, Edge, Brave) : icône d'installation dans la barre d'adresse.

## Confidentialité

Vos données restent dans votre navigateur. Si vous activez la synchronisation, elles sont copiées dans le dossier caché de l'application sur **votre propre** Google Drive. Pas de publicité, pas de suivi.

## Développement

```bash
npm ci
npm run dev     # serveur de développement
npm test        # tests unitaires (Vitest)
npm run build   # build de production
```

Les images de cartes sont téléchargées au moment du déploiement (GitHub Actions) et ne sont jamais versionnées dans le dépôt.

## Crédits et avertissement

Projet de fan, non affilié à Nintendo, Creatures, GAME FREAK ni The Pokémon Company. Pokémon et ses personnages sont © Nintendo / Creatures / GAME FREAK / The Pokémon Company ; les images de cartes restent leur propriété.

Sources de données : Pokekalos, Poképédia, Serebii, TCGdex, flibustier/pokemon-tcg-pocket-database, Limitless TCG, PokeAPI.
