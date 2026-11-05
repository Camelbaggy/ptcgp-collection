# Méta (tier list)

Source : API publique Limitless (`play.limitlesstcg.com/api`), jeu `POCKET`. Rafraîchie chaque jour à 7h (Paris) par `deploy.yml` (crons 05:00 et 06:00 UTC), via `scripts/fetch-meta.mjs`. Le calcul pur est dans `src/lib/meta/compute.ts` (testé avec `src/lib/meta/fixtures`). `public/data/meta.json` est généré en CI (ignoré par git) ; en cas d'échec, l'ancien fichier déployé est récupéré, et l'app affiche un état vide s'il n'y en a aucun.

## Données retenues (méthode alignée sur PocketMads « MADs »)
- Tournois des 14 derniers jours (fenêtres 3 j / 7 j / 14 j, par date du tournoi, défaut 7 j), **sans effectif minimum**, commencés depuis ≥ 8 h (« terminés »), 200 max. Exclus : `format` = `CUSTOM`, nom contenant custom / banned / no ex, et tout tournoi dont le détail (`GET /tournaments/{id}`) liste des `bannedCards`. Les tournois sans deck dans les standings (double deck) ne comptent pas.
- `scripts/fetch-meta.mjs` : 3 requêtes par tournoi (détail, standings, pairings), ~250 ms entre requêtes ; un échec de pairings n'est pas fatal. Option `--fixture-dir` : relit une capture (`list*.json`, `<id>.details|standings|pairings.json`) ; `--prev` : meta.json précédent pour la variation sur 24 h (sinon le fichier déployé, s'il date de ≥ 12 h).
- Archétype = nom de deck Limitless (les variantes d'un même nom sont fusionnées ; id = la plus jouée). Joueurs sans deck ou `other` ignorés. Part = participations du deck / participations avec deck.
- **Matchs décidés** : uniquement depuis les pairings (swiss + phase finale), joints aux standings par `player` (nom d'utilisateur). `winner` = nom d'utilisateur, `0` = égalité, `-1` = bye / pas de résultat / double défaite (avec `player2` : double défaite ; sans `player2` : bye). Exclus : miroirs, égalités, byes, adversaire ou deck inconnu, double défaites. Taux de victoire = victoires / matchs décidés ; « Matchs » = matchs décidés du deck.
- Positionnement : même taux, mais contre les seuls adversaires ayant ≥ 3 % de part.

- **Matchups** (fiche d'un deck, entre la liste type et le QR code) : pour chaque fenêtre, les 20 archétypes les plus joués (par participations, miroir exclu), avec victoires / matchs décidés du deck contre chacun (`DeckStats.matchups`, mêmes règles que ci-dessus). Ces archétypes sont toujours inclus dans `decks` (pour leur nom et icône), même hors tier. Affichage : barre centrée sur 50 %, favorable ≥ 55 %, défavorable ≤ 45 %, grisé sous 10 matchs ; 10 lignes puis « Voir les 20 adversaires » ; toucher une ligne ouvre la fiche de l'adversaire.

## Score (0–100) et tiers
Trois signaux, combinés linéairement (constantes dans `SCORE_PARAMS`, `src/lib/meta/compute.ts`), ajustés par moindres carrés sur le classement PocketMads du 2026-11-04 (7 j) :

`score = clamp(40 + 1,5 × min(part %, 10) + 1,7 × (WR_perf − 50) + 1,4 × (WR_pos − 50), 0, 100)`

- Popularité : part en points, plafonnée à 10 %.
- Performance : `WR_perf = 100 × (V + 1) / (matchs + 2)` (a priori de 2 matchs fictifs à 50 %).
- Positionnement : `WR_pos = 100 × (V_pos + 12,5) / (matchs_pos + 25)`.
Sur le snapshot : erreur absolue moyenne ≈ 2,9 points, corrélation de rang de Spearman ≈ 0,91 (36 decks communs).

Tiers (decks ≥ 100 matchs décidés) : **Tier 0** score ≥ 80 et ≥ 8 points d'avance sur le suivant (« incontournable » ; aucun ce jour-là, comme chez PocketMads) · **Tier 1** ≥ 67 · **Tier 2** ≥ 50 · **Tier 3** sinon. **Outsiders prometteurs** : < 100 matchs, score ≥ 55 et ≥ 10 victoires. Les autres decks < 100 matchs ne sont pas affichés. Variation sur 24 h : écart de score avec le meta.json publié la veille.

## Liste type
Les impressions d'une même carte sont fusionnées par nom. Pour chaque carte : inclusion = listes qui la jouent / listes ; quantité = valeur modale parmi ces listes. La liste de 20 cartes est remplie par inclusion décroissante. « Flex » = cartes hors liste jouées par 30–70 % des listes. Calculé sur les listes de la fenêtre 14 j.
Les noms français viennent de `cards.json` (`nameEn` → `name`, « ex » → « -ex »).

## QR code de deck (jeu)
Format communautaire : Base64 de `u8 nb_dresseurs, nb × u24be (id entité + 10 000 000), u8 nb_pokémon, nb × u24be id entité, u8 nb_énergies, nb × u8 type` (1 Plante, 2 Feu, 3 Eau, 4 Électrique, 5 Psy, 6 Combat, 7 Obscurité, 8 Métal). Chaque exemplaire est une entrée. L'id d'entité vient du nom de fichier d'illustration de la base communautaire (`cPK_10_018340_…` → Pokémon 18340, `cTR_20_000040_…` → Dresseur 40) ; il est stocké dans `Card.entityId/entityKind` (`scripts/add-entity-ids.mjs`, complété par `update-sets.mjs`). Les alt arts partagent l'entité. Énergies : types des Pokémon de la liste (ex ×2), ≥ 30 % du poids, 3 au plus. QR généré seulement si la liste type compte exactement 20 cartes, toutes avec un id (`src/lib/deckcode.ts`, `src/features/meta/DeckQr.tsx`).
