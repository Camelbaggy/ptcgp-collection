# Legacy Google Sheet logic (PTCGP)

Source: spreadsheet `1PVpPwx8N_jqjekd5rL1yGWCXcgockLVuxPcW34nhD90` plus 4 Apps Script files in the same Drive folder.
Everything below was read from the sheet formulas, not guessed, except where marked **(assumption)**.
Rates in `public/data/rates.json` are in **percent (0-100)**, both `packTypeRate` and slot `rates`.
Rarity naming: the sheet writes `EX` where the app uses `D4`, and `Promo` / empty where the app uses `P`.

## 1. Tabs

| Tab | Content |
|---|---|
| `Ajout`, `Partage`, `Échange` | Entry forms (button cells + dropdowns) driven by the Apps Scripts below. |
| `Cards list` | Master list, A:J = Set, Deck, #, Nom, Nom EN, Type, Niveau, Rareté, ID_Carte, Finition. 4577 rows, 4126 distinct ID_Carte. |
| `Inventaire` | A:D = ID_Carte, Nom, Rareté, Quantité (one row per distinct card, 4126 rows). `H1` = grand total (36565), `G:H` = totals per set. Row 1 col A is a `#REF!` leftover. |
| `Probabilités` | One row per set + booster (31 rows), sorted by "Proba 1ère" desc. Summary of the `Calculs <set>` tabs (section 3). |
| `Calculs <set>` (22 tabs, most hidden) | Per-card probability of appearing in one pack, per deck. Holds the rate tables (section 2). |
| `Collection` | 192 columns: one block of 7 columns per set (`Deck`, `#`, `Nom`, `Rareté`, `Quantité`, `Carte`...) listing every card of the set with its owned quantity (`Calculs` column F reads it). Left columns (A:C) = totals per rarity (cards owned, completion %). |
| `1ères manquantes` | Same block layout as `Collection`, but only cards with quantity 0 (first copies still missing), with a `% Obt.` column (the per-pack probability of that card). Header cell shows the number of missing cards per set (`Total`). |
| `2e manquantes` | Same, cards with quantity 1 (second copy missing, i.e. nothing to trade yet). |
| `Pokédex` | One row per Pokémon (dex #, FR/EN name), counts of owned/available versions per rarity column and total, "Raretés différentes". Used to chase every version of a Pokémon. |
| `Decks` (hidden) | Per set/deck, the list of dex No. + English names of the cards in each deck (`A1 - Tous`, `A1 - Dracaufeu`, ...). Reference lists used to fill `Cards list.Deck`. |
| `Traduction` (hidden) | Ndex / English / French Pokémon names (FR<->EN name lookup). |
| `Listes` | Dropdown sources: set ids (col A, I), set slugs (col K, e.g. `A1` ... `puissance-genetique`), unique Pokémon names, "Version disponibles" per name (e.g. `1 (D1)`). |
| `ID PokeAPI` (hidden) | name -> PokeAPI id, for sprites. |
| `Historique ajout/partage/échange` | Append-only logs written by the scripts, newest first, date format `dd/mm HH:MM` (no year). |

`Cards list.Deck`: `Tous` = card present in every booster of the set; a deck name (e.g. `Mewtwo`) = only that booster; `Unique` = the set has one booster; empty (3 rows of C1: Miel #152, Pikachu #183, Méga-Mewtwo X #185) = treated as shared by all boosters of the set. Promo sets `P-A`, `P-B`, `P-C`, `SP1` have no booster.

Reprints: A4b and B4b (Deluxe packs) re-list cards of other sets with their **original ID_Carte** (e.g. A4b #1 = `A1-1`, B4b #1 = `B1a-1`). The same ID therefore appears in several rows; in the app this is one card with several `boosterIds`. New Deluxe-only versions have an ID of the deluxe set (`A4b-2`, `B4b-...`) and are the "Brillante" finish.

## 2. Pack model (from the `Calculs` tabs)

A booster opening = one **pack type** drawn with probability `P_t`, then each slot draws a **rarity** with the slot's rate table, then a **card uniformly among the cards of that rarity in the booster pool** (the pool = deck cards + `Tous` cards of the set; pool size per rarity is `COUNTIF` over the tab, shown in the "Pool <deck>" table).

Per-card probability (what the `Calculs` columns hold, one column per deck):

```
p(card, deck) = sum over pack types t of  P_t * ( sum over slots s of  rate[t][s][rarity] ) / Pool[rarity]
```
(rates as fractions; `Pool[rarity]` = number of cards of that rarity in the deck pool; 0 when the card is not in this deck.) This is the *expected number of copies of that card per pack*, used as if it were a probability (it ignores that the same card could be drawn twice in a pack; the error is negligible).

Pack types by set family (all numbers in percent):

* **A1, A1a, A2, A2a, A2b, A3, A3a, A3b**: `Commun` 99.95 (5 cards), `Rare` 0.05 (5 cards, the "god pack"-style rare pack).
* **A4, A4a** (Wisdom of Sea and Sky, Secluded Springs): `Commun` 91.62 (5 cards), `Commun +1` 8.33 (6 cards, 6th slot is a *baby Pokémon* pool), `Rare` 0.05.
* **B1 ... B4a, C1**: `Commun` 94.711 (B2b, B3a, B3b: 94.706), `Commun +1` 5.238 (6 cards), `Rare` 0.05. B2b adds `Rare S2` 0.005 (S2 only). The 6th slot of `Commun +1` is S1 68.18 / S2 31.82.
* **A4b, B4b** (Deluxe packs, 4 cards, finish matters): special, see below.

### Standard slots (non deluxe)
* `Commun`: slots 1, 2, 3 are **always D1** (100 %). Slot 4 and slot 5 use the two tables "Proba Slot 4 (Commun)" / "Proba Slot 5 (Commun)" (the formula adds `3` for D1 = the three guaranteed D1 slots, then `slot4 + slot5` for every rarity).
* `Commun +1`: slots 1-5 as `Commun`; slot 6 uses "Proba Slot 6" table. In B-series and C1 the S1/S2 rarities have **0 % in slots 4-5** and appear only in slot 6 (68.18 / 31.82). A4/A4a slot 6 draws D3 87.1 % / E1 12.9 % but only among the baby Pokémon of the deck (Magby, Pichu, Elekid, Smoochum, Cleffa, Tyrogue for A4; Igglybuff, Azurill, Mantyke for A4a); these babies are **excluded from slots 1-5** (flag `exclu` in column G of `Calculs A4`/`A4a`, regex on names).
* `Rare`: 5 slots, each draws a rarity with the "Proba Booster Rare" column (only E1, E2, E3, C1, plus S1/S2 in A2b-A4a). Formula `P_rare = 5 * rate / Pool` (A-series: any rarity with non-zero rate; B-series/C1: D1-D3, EX(D4), S1, S2 forced to 0).
* Rate tables per set are in `public/data/rates.json` (generated from `scripts/extract-rates-spec.json`). Slot 4/5 presets: A1-A2a `D2 90/60, D3 5/20, D4 1.666/6.664, E1 2.572/10.288, E2 .5/2, E3 .222/.888, C1 .04/.16`; A2b-A4a add `S1 .714/2.857, S2 .333/1.333` and lower D2/D3 (89/56, 4.952/19.81); B-series `D2 89.999/59.998, D3 5/20, D4 1.667/6.667, E1 2.572/10.286, E2 .5/2, E3 .222/.889, C1 .04/.16`.
* The rare-pack rarity split differs per booster (depends on how many E1/E2/E3/S/C1 cards exist) and is stored per booster in `rates.json`.

### Deluxe packs (B4b "Booster de luxe Méga", A4b "Booster de luxe EX")
4-card packs. Cards have a **finish**: `Normale` or `Brillante` (sheet code `Nor` / `BP`). Pool is by (rarity, finish).
B4b (`Calculs B4b`, authoritative): `Commun` 98.283, `Commun +1` 1.666 (5 cards, 5th slot = S2 100 %), `Rare` 0.05.
* slot 1: D1 Normale 100; slot 2: D1 Normale 17.73 / D2 Normale 82.27;
* slot 3: D1 Brillante 21.385, D2 Brillante 19.578, D3 Normale 33.97, D3 Brillante 9.036, E1 12.858, E2 2.125, E3 .889, C1 .158;
* slot 4: D4 99.363, E2 .375, E3 .222, C1 .04;
* rare pack: slots 1-3 E1 24 / E2 64 / E3 4 / C1 8, slot 4 E2 80 / E3 6.666 / C1 13.333.
`P_commun = (slot1+slot2+slot3+slot4)/Pool`, `P_commun+1 = P_commun + slot5/Pool`, `P_rare = (3*rare123 + rare4)/Pool`.
A4b: the `Calculs A4b` tab is half-broken (finish column empty so every probability shows 0 %). The formulas it contains give slot 1 D1 Nor 100; slot 2 D1 Nor 17.73 / D2 Nor 82.27; slot 3 D1 BP 23.021, D2 BP 17.985, D3 40.659, E1 12.858, E2 2.5, E3 1.111, S2 1.667, C1 .198; slot 4 D4 100. These are what `rates.json` contains for `A4b-Unique`. The rare table (E1 23.076, E2 61.538, E3 3.846, S2 7.692, C1 3.846) is applied to 4 slots **(assumption)**.

`rates.json` extras (superset of `PackSlotRates`, see "Type changes" below): slot `byFinish` (finish-specific rates; `rates` is their sum per rarity), `poolCardIds` (the slot draws only among these cards), `excludeCardIds` (these cards cannot be drawn in this slot).

## 3. The `Probabilités` columns (per set + deck)

All formulas look at tab `Calculs <set>`; `F` = owned quantity of the card, `E` = rarity, `B` = deck (`Tous` rows count for every deck of the set), `<deck column>` = per-card probability for the deck.

| Column | Header | Formula |
|---|---|---|
| E | Cartes | `ROUND( sum(F for deck-specific cards) + sum(F for "Tous" cards) * (#deck-specific cards / #cards of the set that are not "Tous") )` : owned copies attributed to this booster (Tous cards split proportionally). A4b: sum of F where finish ≠ Nor. |
| F | % complét. | `( #cards of deck with F>0 + #Tous cards with F>0 ) / ( #cards of deck + #Tous cards )` |
| G | Proba 1ère | `SUM of p(card, deck) over deck + Tous cards with F = 0`: the expected number of **new** cards (never owned) per pack. |
| H | Packs / 1ère | `1 / G` : packs to open on average to get a new card. |
| I | Proba 2e | same sum over cards with `F = 1` (owned once, a second copy would be tradeable/shareable). |
| J | Packs / 2e | `1 / I`. |
| K..T | `D1 1ère` ... `C1 1ère` | for the rarity: `"n (x%)"` with `n` = number of deck+Tous cards of that rarity with F = 0 and `x` = sum of their `p` ; empty if n = 0. (header cell `EX 1ère` is rarity D4.) |
| U..AD | `D1 2e` ... `C1 2e` | same for cards with F = 1. |

The sheet never uses F>=2 in probability formulas: cards with 2+ copies are surplus (tradeable / shareable), cards with 1 copy are "keep, need a 2nd for trading" (the `2e manquantes` tab).
Best-booster-to-open ranking = sort by Proba 1ère desc (`Probabilités` is sorted that way).

## 4. Apps Script files

All use fixed cell addresses, `Cards list` (A:I) to map `Set_#` -> `ID_Carte` (last row wins if duplicated), and `Inventaire` A:D (ID in col A, quantity col D).
Version strings look like `227 (E1)`; the card number = `parseInt(version.split(" ")[0])`.

* **Déclencheur.gs**: single `onEdit(e)` router. Sheet `Ajout`: B3 (set) changes -> `miseAJourAffichageAjout`; checkbox A1 true -> reset, checkbox D1 true -> add (checkbox is set back to false). Sheets `Partage` and `Échange`: checkbox A1 = reset, D1 = execute.
* **Ajout.gs** (`ajouterCartes`): set in B3; up to 6 card slots, name at `B5+3i`, version at `B6+3i` (i = 0..5). For each filled slot: resolve ID, `Inventaire[ID].quantity += 1`, collect history row `[now, set, name, version]`. Writes inventory back in one go, inserts the history rows at row 2 of `Historique ajout` (so newest first), clears the card inputs but **keeps the set**, toast "n carte(s) ajoutée(s)". `miseAJourAffichageAjout` shows 5 slots (rows 17-22 -> hide the 6th block) for sets A1, A1a, A2, A2a, A2b, A3, A3a, A3b, B4b; 4 slots for A4b (hides last 2 blocks); 6 slots for all others (the 5 + baby/6th card sets). The script's hard-coded set list is outdated (e.g. B4b listed as 5 cards although it is 4/5).
* **Partage.gs** (`partagerCarte`): set B3, card name B5, version B6. If stock > 0: quantity -= 1, one row `[now, set, name, version]` in `Historique partage`, clears B5:B6, keeps set. Otherwise toast "Stock déjà à 0". "Share" = giving a card away (a friend gets it); nothing is received.
* **Échange.gs** (`executerEchange`): outgoing set B3, name B5, version B6; incoming set B10, name B12, version B13. Checks outgoing stock > 0 (else error toast), `out.quantity -= 1`, `in.quantity += 1`, one row in `Historique échange` (cols A-D outgoing, H-J incoming; E-G are formulas). Tokens/friends are not tracked in the sheet.

## 5. Data quirks seen while extracting
* Dates in the history tabs have no year: the extraction assumes the newest row is in the current year (2026) and decrements the year when going back across December/January (ajout log spans 2025-10-31 -> 2026-11-03).
* The Ajout log records cards individually; packs were rebuilt by grouping consecutive rows with the same minute + set (max 6 per group). Deck of the pack is inferred from the cards' boosters (ambiguous -> first booster of the set). Treat as approximate.
* `Cards list` rarity `EX` -> `D4`; `Promo`/empty -> `P`. `SP1` numbers are negative (`SP1--1`).
* Sheet totals: `Inventaire!H1` = 36565 = sum of quantities (matches).
* `Probabilités` header says "EX 1ère" for D4.
