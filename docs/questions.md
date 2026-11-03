
## Calculs, Accueil, Stats (agent CALC)
- **Définition de la « 2e copie »** : le tableur semble compter les cartes à moins de 2 exemplaires (donc inclut les 1ères manquantes). Défaut : l'écran affiche « 2e » = au moins une carte avec qty < 2 (comme le tableur) ; le moteur fournit aussi « possédée exactement 1 fois ». Tu préfères laquelle ?
- **Cartes échangeables** : D1–D4 et E1 avec au moins 2 exemplaires (règle du jeu, constante `TRADE_RULES` dans `src/lib/calc/rules.ts`). Les jetons d'échange (D3 120, D4 500, E1 400) sont indicatifs, à vérifier.
- **Cartes partageables** : défaut = toute carte en 2 exemplaires ou plus, toutes raretés. À restreindre ?
- **Priorité de la wishlist** : je considère que le plus petit nombre = le plus prioritaire (1 en tête).
- **Proba par pack** : emplacements indépendants, carte uniforme parmi celles de la rareté dans le booster ; les doublons dans un même pack sont ignorés (approximation du tableur).
- **Chance** : « rares » = E1, E2, E3, S1, S2, C1 (constante `RARE_RARITIES`).
