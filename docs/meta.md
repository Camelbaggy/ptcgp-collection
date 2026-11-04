# Méta (tier list)

Source : API publique Limitless (`play.limitlesstcg.com/api`), jeu `POCKET`. Rafraîchie chaque jour à 7h (Paris) par `deploy.yml` (crons 05:00 et 06:00 UTC), via `scripts/fetch-meta.mjs`. Le calcul pur est dans `src/lib/meta/compute.ts` (testé avec `src/lib/meta/fixtures`). `public/data/meta.json` est généré en CI (ignoré par git) ; en cas d'échec, l'ancien fichier déployé est récupéré, et l'app affiche un état vide s'il n'y en a aucun.

## Données retenues
- Tournois des 14 derniers jours, ≥ 16 joueurs, commencés depuis ≥ 8 h (« terminés »), format différent de `CUSTOM`, 200 max.
- Archétype = `deck.id` Limitless ; joueurs sans deck ou `other` ignorés. Fenêtres 3 j / 7 j / 14 j (date du tournoi).
- Part = joueurs du deck / joueurs avec un deck. Taux de victoire = V / (V + D + N) (comme Limitless et PocketMads : une égalité compte comme une non-victoire) ; joueurs sans `record` exclus des V/D/N. Top 8 = joueurs avec `placing` ≤ 8 (`topCut` = tous ceux qui ont un placing). Seuls les decks ≥ 0,5 % sont listés.

## Tier
`score = ln(1 + part en %) × (borne basse de Wilson du taux de victoire / 0,5)^4` (z = 1,28). La part pèse peu (log), la performance beaucoup, et la borne de Wilson pénalise les petits échantillons. Seuils : S ≥ 2,0 · A ≥ 1,4 · B ≥ 0,9 · C ≥ 0,5 · sinon D.

## Liste type
Les impressions d'une même carte sont fusionnées par nom. Pour chaque carte : inclusion = listes qui la jouent / listes ; quantité = valeur modale parmi ces listes. La liste de 20 cartes est remplie par inclusion décroissante. « Flex » = cartes hors liste jouées par 30–70 % des listes. Calculé sur les listes de la fenêtre 14 j.
Les noms français viennent de `cards.json` (`nameEn` → `name`, « ex » → « -ex »).

## QR code de deck (jeu)
Format communautaire : Base64 de `u8 nb_dresseurs, nb × u24be (id entité + 10 000 000), u8 nb_pokémon, nb × u24be id entité, u8 nb_énergies, nb × u8 type` (1 Plante, 2 Feu, 3 Eau, 4 Électrique, 5 Psy, 6 Combat, 7 Obscurité, 8 Métal). Chaque exemplaire est une entrée. L'id d'entité vient du nom de fichier d'illustration de la base communautaire (`cPK_10_018340_…` → Pokémon 18340, `cTR_20_000040_…` → Dresseur 40) ; il est stocké dans `Card.entityId/entityKind` (`scripts/add-entity-ids.mjs`, complété par `update-sets.mjs`). Les alt arts partagent l'entité. Énergies : types des Pokémon de la liste (ex ×2), ≥ 30 % du poids, 3 au plus. QR généré seulement si la liste type compte exactement 20 cartes, toutes avec un id (`src/lib/deckcode.ts`, `src/features/meta/DeckQr.tsx`).
