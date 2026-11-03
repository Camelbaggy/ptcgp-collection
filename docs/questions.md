
## Calculs, Accueil, Stats (agent CALC)
- **Définition de la « 2e copie »** : le tableur utilise les cartes à exactement 1 exemplaire (vérifié dans docs/legacy-logic.md) ; l écran suit cette définition (`pSecond`). Le moteur fournit aussi qty<2 (`pMissingSecond`). OK ?
- **Cartes échangeables** : D1–D4 et E1 avec au moins 2 exemplaires (règle du jeu, constante `TRADE_RULES` dans `src/lib/calc/rules.ts`). Les jetons d'échange (D3 120, D4 500, E1 400) sont indicatifs, à vérifier.
- **Cartes partageables** : défaut = toute carte en 2 exemplaires ou plus, toutes raretés. À restreindre ?
- **Priorité de la wishlist** : je considère que le plus petit nombre = le plus prioritaire (1 en tête).
- **Proba par pack** : emplacements indépendants, carte uniforme parmi celles de la rareté dans le booster ; les doublons dans un même pack sont ignorés (approximation du tableur).
- **Chance** : « rares » = E1, E2, E3, S1, S2, C1 (constante `RARE_RARITIES`).

## Questions interface (agent APP)

- **Barre d'onglets mobile** : Accueil, Ajout, Partage, Échange, Collection + « Plus » (Souhaits, Stats, Nouvelle extension, Réglages). Défaut : ainsi. Préférez-vous un autre choix d'onglets principaux ?
- **Ajout booster** : un appui = +1 carte, bouton « − » sur la vignette pour corriger, 5 cartes affichées comme usuel (aucun blocage, on peut valider 6+ pour les packs spéciaux). Défaut : validation toujours permise. Faut-il bloquer à 5 ?
- **Annulation** : après chaque saisie, un message « Annuler » (6 s) ; annulation du dernier évènement aussi dans Réglages. Défaut : seul le dernier évènement est annulable.
- **Partage/Échange** : donner exige au moins 2 exemplaires (la liste masque les autres). Le nom de l'ami est mémorisé d'une saisie à l'autre. Défaut : ainsi.
- **Ajustement manuel (fiche carte, +/−)** : ne crée pas d'entrée d'historique. Défaut : pas d'historique. Voulez-vous un évènement « correction » ?
- **Souhaits** : priorité à 3 niveaux (haute/moyenne/basse), moyenne par défaut. Défaut : 3 niveaux.
- **Nouvelle extension** : 5 slots par défaut, un seul type de pack « normal » à 100 %, possibilité d'ajouter un type « rare ». Les extensions ajoutées à la main sont conservées lors d'une mise à jour des données livrées.
- **Navigation** : liens en `#/` (HashRouter) pour que GitHub Pages marche sans configuration de redirection.

## Saisie rapide et mise à jour en masse (agent APP)

- **Ajout** : trois onglets, « Saisie » (défaut, type-ahead : début du nom FR/EN ou numéro, Entrée ou tap pour ajouter, flèches), « Grille » et « Mise à jour ». Coche « Chercher dans tous les boosters de l'extension » pour les cartes présentes dans plusieurs boosters. Défaut : recherche limitée au booster choisi.
- **Mise à jour en masse** : placée comme onglet dans Ajout (pas dans Collection) pour garder toute la saisie au même endroit. On cherche une carte, on tape la quantité réelle (ou +/−), « Enregistrer » écrit un seul évènement `correction` (annulable avec « Annuler »). Les corrections n'entrent pas dans les statistiques de packs.
- **Fiche carte (Collection)** : quantité modifiable au clavier ; ce réglage direct ne crée pas d'historique.
- **Règles** : partage = D1–D4 ; échange = D1–D4, E1, E2, S1, S2 ; toujours au moins 2 exemplaires (src/lib/calc/rules.ts).
