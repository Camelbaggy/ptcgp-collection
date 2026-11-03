# Sources publiques PTCGP

Évaluation faite depuis un bac à sable dont le réseau n'autorisait que `raw.githubusercontent.com` et `registry.npmjs.org` :
`api.tcgdex.net`, `assets.tcgdex.net`, `pocket.limitlesstcg.com`, `api.github.com`, jsDelivr et les autres hôtes étaient bloqués (403).
Ce qui suit est donc **vérifié** pour le dépôt GitHub (données lues en direct), et **non vérifié en direct** pour TCGdex (API et images) : voir "À valider".

## Recommandation

| Besoin | Source | Pourquoi |
|---|---|---|
| Liste des cartes, rareté, boosters, dates, types (app + import "Nouvelle extension") | **pokemon-tcg-pocket-database** (`flibustier/pokemon-tcg-pocket-database`, licence MIT) via `raw.githubusercontent.com/.../main/dist/` | Un seul fichier JSON pour tout (4577 cartes, 27 extensions : A1…A4b, B1…B4b, C1, SP1, PROMO-A/B/C), mis à jour par la communauté pour chaque nouvelle extension (C1 du 2026-10-29 déjà présent), CORS ouvert (utilisable dans la PWA), versionné (tags), miroir npm. Pas de clé, pas de quota annoncé. |
| Noms français, nom FR de l'extension | **TCGdex** `https://api.tcgdex.net/v2/fr/sets/<id>` (open source, MIT pour la base `tcgdex/cards-database`) | Seule source avec les noms FR des cartes (`cards.fr.json` du dépôt ci-dessus est encore en anglais) ; les noms d'extensions FR sont dans `sets.json` du dépôt. |
| Images | **TCGdex assets** `https://assets.tcgdex.net/{fr\|en}/tcgp/<set>/<NNN>/high.webp` | URL prévisible, webp, fr puis repli en. Le script `scripts/fetch-images.mjs` s'en sert. |

Écartés : Limitless (`pocket.limitlesstcg.com`, pas d'API publique documentée, scraping, CGU restrictives), sites de fansites (Pokémon-Zone, Game8, Serebii : scraping, pas de licence). Le dépôt `flibustier` scrape lui-même un de ces sites pour ses images ; elles ne sont pas redistribuées sur GitHub (`dist/images` est dans `.gitignore`).

Licences : les *données* (noms, numéros, raretés) sont des faits publics ; les *images* des cartes restent © The Pokémon Company / Creatures / DeNA. Usage personnel hors-ligne = acceptable ; ne pas republier publiquement les images (GitHub Pages public inclus : à garder en tête, voir questions). 

## Formats des sources

`dist/sets.json` : `{ "A": [ { code, releaseDate, count, name:{en,fr,de,...}, packs:["Charizard","Mewtwo","Pikachu"] } ], "B": [...], "C": [...], "Special": [...] }`

`dist/cards.json` (et `cards.extra.json`, plus riche) : `{ set, number, name (EN), rarity, image, packs[], element, type, stage, health, retreatCost, weakness }`

Raretés de la source : `C U R RR` (1 à 4 losanges) · `AR` (1 étoile) · `SR`, `SAR` (2 étoiles) · `IM` (3 étoiles) · `S`, `SSR` (chromatique) · `UR` (couronne) · `AN` (Mew SP1).

## Correspondance des identifiants

Notre id carte : `<setId>-<numéro>`, numéro **sans zéro de tête** (`A1-1`, `A4b-12`, `B4b-429`).

| Source | Set | Carte | Notre id |
|---|---|---|---|
| flibustier | `A1`, `B4b`, `C1`, `SP1` | `number: 12` | `A4b-12` |
| flibustier | `PROMO-A` | `number: 5` | **`P-A-5`** (promos : `P-A`, `P-B`, `P-C`) |
| TCGdex | `A1`, `P-A` | id `A1-001`, `localId: "001"` | `A1-1` (retirer le padding) ; `P-A-001` → `P-A-5` |
| images TCGdex | | `.../tcgp/A1/001/high.webp` | `public/cards/A1/A1-1.webp` |

Autres règles de conversion (`src/lib/importers/`) :
- Rareté : `C→D1, U→D2, R→D3, RR→D4, AR→E1, SR→E2, SAR→E2, IM→E3, S→S1, SSR→S2, UR→C1`, `AN` et toute carte de promo → `P`.
- Booster : id `<setId>-<nom du pack>` (ex. `A1-Mewtwo`). Les noms viennent de la source en anglais. Une carte sans `packs` est rattachée à tous les boosters de l'extension (sauf promos : aucun).
- `SP1` : cartes numérotées -1, -2, -3 conservées telles quelles (ids `SP1--1`…), rareté `P`, aucun booster (comme `public/data/cards.json`).
- `A4b` et `B4b` : une réimpression (même fichier d'illustration `image` qu'une carte d'une extension antérieure) n'est PAS recréée : la carte existante garde son id et reçoit le booster (`updatedCards`, option `existingCards`). Vérifié : 4577 - 451 réimpressions = 4126 cartes = `public/data/cards.json`. Les variantes brillantes sont de vraies nouvelles cartes.
- `Card.image` = `cards/<setId>/<cardId>.webp` (chemin relatif à la base du site).

## Nouvelle extension

1. Source publique : `fetchPublicSet("C2")` charge `sets.json` + `cards.extra.json` (~1,5 Mo) et les noms FR de TCGdex (optionnels).
2. Hors ligne ou source en retard : coller la liste de cartes (texte tolérant) : `importFromText`.
3. Images : `node scripts/fetch-images.mjs C2` puis commit de `public/cards/C2/`.
Les taux d'obtention ne sont dans aucune source fiable : saisie manuelle (le dépôt a un `pullRates.json` agrégé, à ne pas utiliser tel quel).

## À valider (réseau complet)

- `curl https://api.tcgdex.net/v2/fr/sets/A1` : confirmer que `cards[].localId` correspond à nos numéros (`A1` = 286 cartes côté source).
- `node scripts/fetch-images.mjs --all` : nombre/poids réels. Estimation à 300 px, qualité 60 : 15 à 25 Ko/carte, soit 70 à 115 Mo pour ~4 600 images. Si > 150 Mo : `--quality 50 --width 260`.
- Délai de mise à jour de TCGdex pour une nouvelle extension (en général quelques jours à 2 semaines) ; le dépôt flibustier est en général plus rapide pour la liste de cartes.
