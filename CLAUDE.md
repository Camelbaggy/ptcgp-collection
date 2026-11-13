# PTCGP Collection — CLAUDE.md

This is Nicolas's personal app **Holothèque** (renamed from "PTCGP Collection" on 2026-11-05; logo = dark card with rainbow frame on an iridescent background, `public/icons/icon.svg`; repo, URL, Android package id and storage keys unchanged) for tracking his **Pokémon TCG Pocket** collection. It is a PWA that replaces his Google Sheet "PTCGP", which had become slow and rigid.
- **UI text is in French, in the informal "tu" everywhere** (never "vous"; harmonised 2026-11-12), and Nicolas is spoken to in French.
- Code, identifiers and commits are in English or French as already present.

This file is the entry point for resuming the project with no history. Read it fully before working.

## 1. Essentials

| | |
|---|---|
| Repo | https://github.com/Camelbaggy/ptcgp-collection (public, default branch `main`) |
| Live | https://camelbaggy.github.io/ptcgp-collection/ (GitHub Pages, "GitHub Actions" source) |
| Owner | Nicolas, GitHub `Camelbaggy`. Was new to GitHub, so explain the steps on his side simply. |
| Cost | **Free only** (GitHub Pages and Actions, his own Google Cloud project for sync) |
| Personal data | **Never in the repo.** Initial backup: `/mnt/project-files/ptcgp-app/sauvegarde-initiale.json`, imported via Réglages. `private-data/` is git-ignored. |
| Mockups and screenshots | `/mnt/project-files/ptcgp-app/maquettes/` (B direction chosen), `impl/`, `impl2/` |

### Working with Nicolas
- **Project manager role:** Claude coordinates and delegates the work to **Sonnet sub-agents in parallel**, one per git worktree (for example `git worktree add /home/claude/<x>-wt -b feat/<x> origin/main`). Each agent runs `npm ci` and must not commit; the manager reviews, commits, opens the PR and merges.
- **Ask Nicolas** about feature and UI choices that are not obvious, using a decision card with a recommendation. He likes being shown 2 or 3 visual options (static HTML mockups plus screenshots).
- He tests mostly on **Android (Brave)** and on PC.
- **After each deploy:** the PWA shows an "Nouvelle version disponible → Recharger" banner. If he says "I don't see anything", he needs to reload or close and reopen the app.
- Before declaring a task done, run `npx tsc -b`, `npx vitest run` and `npm run build`. For UI work, also take a Playwright screenshot at 412×900 and 1280×800 (Chromium is preinstalled in the sandbox; import the backup through the file input in `#/reglages`).
- **Commits** end with the attribution trailers given by the environment.
- **PR body** starts with `<!-- claude-projects-attribution: {"github_login":"Camelbaggy"} -->` followed by the "Requested by Nicolas" line.
- **PR flow:** open → merge (merge commit) → watch the deploy with `gh run watch <id> -R Camelbaggy/ptcgp-collection`.

### Hard constraints (ToS and ethics)
- **DeNA authorization (written reply to Nicolas, 2026-11-11; DeNA legal & operations, in partnership with The Pokémon Company).** Limited, non-exclusive, revocable permission to inspect, access and parse account and card-collection data, whatever the technical method, for his own account and for friends, family and household members who gave explicit consent. Conditions: (1) strictly personal/household and non-commercial, with no public redistribution of extracted data or of the scripts/tools; (2) only those accounts, never other players'; (3) no flooding or unreasonable load on their servers; (4) read-only: no packet tampering, client-memory modification, spoofed purchases or automated gameplay (account termination). Endpoints and formats may change without notice. Consequences for this repo: any code that reads the game account must not live in this public repo or public bundle (decision pending with Nicolas: private repo or APK distributed only to his circle); tokens, cookies and captured traffic are never committed or pasted; friends consent in their own app, on their own device and account. The ban on write access, other players' data and automating gameplay stays.
- Otherwise: no datamining of the game and no interception of the Nintendo account outside that authorization. Do not reproduce Pokemon-Zone's account sync as a service.
- Do not bypass anti-bot protections (Cloudflare, Bunny Shield), and respect robots.txt:
  - PocketMads disallows `/meta-game` and `/api` (and `/account`, `/auth/`, `/tournaments/*/matchups/`); `/tier-list` is allowed (checked 2026-11-10), terms have no scraping clause.
  - ptcgpocket.gg blocks AI bots.
  - Pokekalos allows everything except `/contributions`.
  - **Pokémon-Zone** (probe 2026-11-10, branch `debug/pz-probe`): `robots.txt` disallows `/players/*/*/` (so `sets/`, `stats/`, `themed-collections/`, `wishlist/`; the bare profile `/players/<id>/` is allowed), and Cloudflare answers **403 `cf-mitigated: challenge`** to any server-side request (identified User-Agent, GitHub Actions), even on the profile page. Nicolas says he has a **written authorization** from Pokémon-Zone to scrape the « Collection Tracker » pages for non-commercial use; it does not lift the Cloudflare challenge by itself. Server-side scraping needs a technical means agreed with them (key, header, allowed agent, IPs); until then only the in-browser bookmarklet works (it runs in Nicolas's own browser). Never commit PZ pages; probe output is status lines only.
- **Never commit Pokemon-Zone HTML or excerpts of it.** Nicolas saves the pages himself and imports them inside the app.
- Card images remain © TPC. They are downloaded at build time in CI and **must never be committed** (`public/cards`, `packs`, `emblems`, `logos` are generated; do not `git add` them).

### Sandbox network
The sandbox only reaches GitHub (raw, api, gh) and npm. Pokekalos, Serebii, Limitless, github.io and similar sites are blocked.
- Everything that fetches from outside runs **in GitHub Actions** at deploy time.
- To probe a site, use the probe branch `debug/pocketmads` in worktree `/home/claude/probe-wt`, if it still exists. Its workflow `probe-pm.yml` runs a script on push and **commits the output to the branch**; then run `git pull`. GitHub logs truncate output and artifacts cannot be downloaded, so the commit is the only way to get results back.
- Debug branches still to clean up some day: `debug/emblems`, `debug/eventpages`, `debug/pocketmads`, `debug/pz-probe`, `debug/raenonx`, `debug/schedule`, `debug/upcoming`, `debug/video-fp` (also in `git branch -r`; keep `data`). Notes: `debug/pz-probe` has `probe-pz.yml` (status lines only); `debug/video-fp` (its `probe-fp.yml` prints card fingerprints of chosen sets to the job log; read with `get_job_logs`, the session cannot delete branches).

## 2. Stack
- Vite 8, React 19, TypeScript 7 (`tsc -b`), React Router 7 **HashRouter** (`#/…` links, so GitHub Pages needs no config), oxlint.
- IndexedDB through **Dexie 4** and `dexie-react-hooks`.
- PWA with `vite-plugin-pwa`:
  - `registerType: 'prompt'`.
  - `src/lib/pwaUpdate.ts` checks for updates every 30 min and on `visibilitychange`.
  - `src/components/UpdateBanner.tsx` shows the "new version" banner.
  - Version: `__APP_BUILD__` (short SHA) and `__APP_BUILD_DATE__`, injected by `define`, shown in Réglages.
- `qrcode-generator` (lazy-loaded) for in-game deck QR codes.
- `sharp` (dev) for image resizing in the scripts.
- Vitest for the pure logic (`src/lib/**.test.ts`, about 176 tests).
- **Chargement à la demande (2026-11-11):** chaque écran sauf l'accueil est un `React.lazy` dans `App.tsx` (un `Suspense` autour des routes), les importeurs d'Ajout (`BulkUpdate`, `PzCollectionImport`, `RecapImport`, `ScreenMass`, `VideoImport`), `EventDetail`, `NewCardReveal` et `SyncController` aussi. Fichier principal ≈ 340 Ko (contre 849 Ko). Garder un nouvel écran en `lazy`.
- Vitest for the pure logic (`src/lib/**.test.ts`) plus `db.ts` and the Drive sync engine against `fake-indexeddb` (`db.test.ts`, `sync/snapshot.test.ts`, `sync/engine.test.ts` with an in-memory fake Drive; helpers in `src/lib/testUtils.ts`; two devices are simulated with `useDevice`). Coverage (2026-11-11, `@vitest/coverage-v8`): db.ts 91 % statements, sync/snapshot.ts 100 %, sync/engine.ts 66 %, sync/merge.ts 94 %.
- **Android app:** Capacitor 8 (`android/`, `capacitor.config.ts`, local plugin `native/holo-native`, JS side `src/lib/native/`), with over-the-air web updates through `@capgo/capacitor-updater`. See `docs/android.md`.
- No backend. Sync uses the user's Google Drive (see §6).

## 3. Code layout
```
src/
  App.tsx            nav (desktop sidebar grouped ≥900 px, mobile bottom bar with central +), routes, More page
  styles.css         design tokens (dark B theme by default) + shared components
  lib/
    types.ts         data contract (see §4)
    db/              Dexie, split by role (import from `lib/db`, `index.ts` re-exports): `schema.ts` (tables v1→v3, `db`, `cardImageUrl`), `seed.ts` (shipped JSON loading, `seedIfNeeded`), `events.ts` (add/undo/applyCorrections/setOwned with reveal, imported events), `backup.ts` (export/import)
    storage.ts       localStorage registry: `ptcgp:` prefs (in the backup, `settings` field) vs `ptcgp.` device state (never exported); `lsGet/lsSet`, `prefGet/prefSet`
    useData.ts       hooks, RARITY_LABEL, usePersisted (localStorage with try/catch)
    DataProvider.tsx shared data (lot C2, 2026-11-11), mounted once in main.tsx: one Dexie query per table
                     (sets, boosters, cards, rates, owned, wishlist), re-run only when that table changes; one
                     context per table (dataContext.ts). useCards/useOwned/useSets/… and useCalcData read it;
                     useCardById/useBoosterById give shared indexes. Never mutate what these hooks return.
    ops.ts           business operations (add/undo events)
    calc/            probabilities: P(new card)/P(2nd copy) per booster, best boosters, targetCardOptions, rules.ts (TRADE_RULES, RARE_RARITIES)
    stats/           pure aggregation for the Stats page (dates, filter, timeline, packs: isFullPack, collection, detail)
    pokedex/         match (card → species/form), aggregate, sort
    events/          pokemonZone.ts (PZ HTML parser), translate.ts (EN→FR), itemIcons.ts, releaseWindow.ts
    meta/compute.ts  MADS-like tier score (see docs/meta.md)
    deckcode.ts      in-game deck QR encoding
    importers/       new set import (text, JSON, public source), entityIds, updateSets
    sync/            Google Drive sync (gis.ts OAuth, drive.ts, engine.ts, merge.ts LWW + tombstones, snapshot.ts)
    videoScan/       in-game video import (scroll, lattice, digits, fingerprint, align; browser.ts = video/canvas glue)
    reveal.ts        detects newly owned cards (0 → ≥1) + emitter for the animation
    theme.ts         dark (default) / light / auto
    assets.ts        URLs of images, logos, emblems, packs, sprites
  components/        Brand (SetLogo, BoosterEmblem, BoosterBadge, BoosterPackImage), CardTile, CardDetail, Sheet,
                     Icon (inline SVG line-icon set), PageHeader/SectionHead/EmptyState, TypeAhead, Toast,
                     NewCardReveal, UpdateBanner, Filters, CardPicker, EventBadge
  lib/native/        Android only: holoNative.ts (plugin contract), platform.ts, appUpdate.ts (OTA), boot.ts, autoReads.ts, capture/recording queues
  lib/pzSync/, pzProfile/, pocketMads/  hidden-WebView reads (Pokémon-Zone, PocketMads) and their parsers
  features/<screen>/ one folder per screen (see §5)
scripts/             Node build-time scripts (fetch-*.mjs, update-sets, build-pokedex, add-entity-ids), lib/common.mjs
public/data/         reference JSON (cards, sets, boosters, rates, releases, set-slugs, pokedex); meta.json generated
android/, native/    Capacitor project and the holo-native plugin (Kotlin); capacitor.config.ts at the root
docs/                journal.md (dated history moved out of this file), android.md, legacy-logic.md (sheet logic), public-sources.md, meta.md (tier-list score), questions.md
```

## 4. Data model (`src/lib/types.ts`)
- **Rarities:**
  - `D1`–`D4`: diamonds; D4 = ex.
  - `E1`–`E3`: stars.
  - `S1`–`S2`: shiny.
  - `C1`: crown.
  - `P`: promo.
- **Copy terms:** "1ère" = first copy (to complete the collection). "2e" = second copy (to trade or share).
- **Entities:**
  - `CardSet {id, name, nameEn, releaseDate, order}`
  - `Booster {id: "A1-Mewtwo" | "B3-Unique", setId, name}`
  - `Card {id: "A1-1", setId, number, name, nameEn, type, stage, rarity, boosterIds[], entityId?, entityKind?}`
  - `PackSlotRates {boosterId, packType, packTypeRate, slots[{slot, rates: {rarity: %}}]}`
  - `OwnedCard {cardId, quantity}`
  - `Wishlist {cardId, priority}` (1 = highest)
- **HistoryEvent kinds:**
  - `pack {boosterId, cardIds}`
  - `share {cardId, direction, friend}`
  - `trade {given, received, friend, tokens}`
  - `correction {changes[{cardId, from, to}]}`
- **Dexie tables:** `sets, boosters, cards, rates, owned, wishlist, history, meta`, plus `tombstones` (v2, sync) and `importedEvents` (v3, Pokemon-Zone events).
- **Sync stamps:** each row gets `updatedAt` and `by` (device).
- **Shipped vs. user data:** reference data ships in `public/data/` and is reloaded on update. At startup `seedIfNeeded` reads the small `data/version.json` (hash of sets/boosters/cards/rates, emitted at build by the `data-version` plugin in `vite.config.ts`) and only re-reads the big files when it differs from `meta.dataVersion`. If a reference file fails to load, existing data is kept (error only on a first install with no cards). Dev fixtures (`src/lib/fixtures`) are used only under `import.meta.env.DEV`, so they are not in the production bundle. Sets added by hand are kept (`meta.shippedSetIds`).
- **SP1 Mew:** uses negative numbers −1..−3.

## 5. Screens and business rules
Routes: `/`, `/profil` (redirige vers `/stats?onglet=vie`), `/profils` (redirige vers `/reglages?onglet=profil&ouvrir=foyer`), `/collections-a-theme`, `/guide-pokemon-zone`, `/ajout`, `/echange-partage` (onglets `?onglet=echange|partage|ami`; `/echange` et `/partage` y redirigent), `/collection`, `/evenements`, `/meta`, `/pokedex`, `/souhaits`, `/stats`, `/extension/nouvelle`, `/extension/:setId/taux`, `/reglages`, `/plus`.

- **Game rules** (`calc/rules.ts`):
  - Tradeable: D1–D4, E1, E2, S1, S2.
  - Shareable: D1–D4.
  - The game itself allows giving any card owned in 2+ copies (`ops.ts` `canTradeCard`/`canShareCard`, used to record a trade or share).
- **Nicolas's offer rules** (`calc/offers.ts`, home "Échange/Partage" card, 2026-11-05):
  - Trades are only between cards of the same rarity, and only to complete the collection: a rarity whose cards are all owned (≥1, all sets) is no longer counted as tradeable.
  - D1–D4: keep 2 copies (offer from the 3rd), except **brillantes** (`finish: 'Brillante'`, deluxe boosters A4b/B4b…): keep 1.
  - E1, E2, S1, S2: keep 1 (offer from the 2nd). E3, C1 and promos: never tradeable.
  - Share: D1–D4 only, same thresholds, no "complete rarity" filter.
  - Lists sorted by rarity desc, then copies desc. Stats still uses the plain ≥2 rule (`TRADE_RULES`).
- **Packs:** an entry with **fewer than 4 cards** (`FULL_PACK_MIN`, `isFullPack`) is not counted as a pack (promos, single additions). This applies to the home page and to Stats.
  - God pack = every card is ★ or better.
  - Pack Points = 5 per pack.
- **Accueil (home)**, layout B:
  - Gradient hero: % collected, x/y cards, pills for "avec 2e copie" and packs.
  - "Ajouter un pack" card.
  - "À ouvrir en premier": real pack image plus 2 alternatives.
  - "Mes cartes visées".
  - Next event card.
  - "Échange/Partage": counts of échangeables / partageables (Nicolas's offer rules); each count opens a sheet (`OfferSheet.tsx`) grouped by rarity; the rarest tradeable cards are shown as thumbnails with their copy count.
  - Links to Méta, Stats and Pokédex.
- **Ajout layout (2026-11-11, Nicolas ; épuré lot L05, 2026-11-12):** en-tête « Ajouter » + aide « ? » ; deux `SegTabs` sur une ligne : catégories (libellés courts `CATS.short` « 1 booster · Pioche · 10 boosters · Extension · Tout », nom complet en `aria-label`), puis méthodes (`METHOD_LABEL.short`, la recommandée en premier avec une étoile). **Toutes les explications** (sous-titres, « Le plus pratique », consignes Pokémon-Zone, enregistrement d'écran, autorisation Android) sont dans `features/add-pack/addHelp.tsx` (feuille « ? », par catégorie et méthode, web/Android) : n'en remettre aucune dans le flux. Extension/booster : ligne `ChangeLine` + feuille (`SetChoice.tsx` : `BoosterLine`, `SetLine`, `SetGrid` en 3 colonnes logo + code). Pokémon-Zone : un bouton principal, le reste (pages enregistrées, favori, guide, changer de profil) sous « Autres moyens » ; MAJ massive Android : « Extensions n / N · Changer » ouvre la grille à cocher. Clavier ouvert (`data-kb`) : en-tête et sélecteurs masqués, seule la ligne « Changer » reste au-dessus du champ. Defined in `features/add-pack/methods.ts` (Android vs web lists; native-only « Lecture d'écran » hidden on web; old `?onglet=` values mapped by `fromOnglet`, `pz`/payload → MAJ massive, `pz1` → 1 extension):
  - **1 booster**: Capture d'écran (rec.) · Saisie · Grille (méthodes sœurs depuis L05 ; `?onglet=grille` → `grid` ; l'ancienne préférence `add.grid` est reprise par `pickMethod`) — `PackEntry.tsx`, shared set/booster choice `boosterChoice.ts`.
  - **10 boosters**: Lecture d'écran (rec., Android) · Captures · Vidéo · Saisie manuelle (booster after booster) — `RecapImport source=…`.
  - **1 extension**: Pokémon-Zone (rec.; Android: `PzSyncOne`, sync mode `sets` with one set; web: bookmarklet) · Lecture d'écran (Android, `VideoImport source="screen"`) · Vidéo · Saisie manuelle (`BulkUpdate`).
  - **MAJ massive**: Lecture d'écran (Android, second choice since Nicolas kept Pokémon-Zone recommended; first real test 2026-11-11 showed a badly shifted reading, under investigation, `ScreenMass.tsx` + `screenMassStore.ts`: one screen recording of « Échange de points Booster » per expansion; `importVideoAuto` guesses the expansion from the cards seen via `videoScan/detectSet.ts` (votes of nearest reference fingerprints), reads are kept in memory for the session, one combined review and one `correction` event; deluxe sets listed as not readable) · Pokémon-Zone (recommended; Android: `PzSyncMass`, checklist of sets, Tout cocher/décocher, unchecked ids persisted in `pz.massOff`, optional profile pages; web: bookmarklet « Tout » + saved pages).
  - **Shared correction review** (lot C4, 2026-11-11): importers that save a `correction` (Vidéo, MAJ massive Lecture d'écran, Pokémon-Zone, Saisie manuelle `BulkUpdate`, and the « Aligner sur le jeu » step of the récap) share `features/add-pack/CorrectionReview.tsx` (`ReviewLine`, `CorrectionList`, `ReviewActionBar`, `ShowAllToggle`, `ScanProgress`), `correctionEdits.ts` (`useCorrectionEdits`, `saveCorrections` with the « Annuler » toast) and the pure `lib/correctionReview.ts` (tested). Change the review there, not in each importer.
  - **Pioche miracle** (lot F13, 2026-11-12, 2e catégorie juste après « 1 booster », `WonderPick.tsx`): recherche de la carte gagnée (`lib/search.ts`), un toucher l'ajoute via `db.addWonderPick` = évènement `pack` à **une carte** marqué `wonder: true` (donc jamais compté comme booster, `isFullPack`), synchro/modification/annulation comme tout évènement ; libellé « Pioche miracle » dans Historique. `?onglet=pioche`.
  - **Sélecteurs** (L05, remplace les puces `.add-methods` du 2026-11-12) : `SegTabs` (`.add-pick`), une ligne, défilement horizontal si besoin ; test `e2e/ajout.spec.mjs` (champ de saisie < 300 px, 4 résultats visibles à 500 px de haut, aucun libellé sur deux lignes à 360 px, méthodes atteignables).
  - The sections below describe the underlying tools (former tab names).
- **Ajout, anciens onglets** (Saisie, Grille, Mise à jour, Import) : toujours là sous les 4 catégories. Résumé : *Saisie* = recherche par nom/numéro, Entrée pour ajouter ; *Grille* ; *Mise à jour* = quantités réelles, écrit un évènement `correction` ; *Import* = page Pokémon-Zone d'une extension (`importers/pzCollection.ts`), marque-page « Envoyer vers Holothèque » (`importers/pzBookmarklet.ts`, charge `pz-favori.js`), pages de profil (`lib/pzProfile`), synchro intégrée Android (`lib/pzSync`, `PzWebView.kt`), vidéo (`lib/videoScan`), capture d'écran (`videoScan/screenshot.ts`). Les empreintes de référence viennent de `scripts/build-fingerprints.mjs` (étape de déploiement, `public/data/fingerprints.json` généré). Un toast propose « Annuler » 6 s. **Détails, mesures et décisions : `docs/journal.md`.**
- **Fiche carte (L12, 2026-11-12):** image sur 55 % de la largeur ; un appui l'ouvre en plein écran (`.card-zoom`, portail, Échap/appui ferme). **Rareté : un seul rendu**, `components/Rarity.tsx` (`<Rarity r=…/>`, symboles pleins ◆ ★ ✦ ♛, nom complet en `aria-label`) ; `RARITY_LABEL` (useData et calc) n'a plus de symboles creux. À utiliser pour toute rareté affichée.
- **"Nouvelle carte !" animation** (`NewCardReveal`):
  - Triggers: any save that takes a card from 0 to ≥1 (pack, share, trade, correction, +/− on the card sheet). Undo and sync/import do not trigger it.
  - Display: opens the expansion grid, and the new card lights up with a holo effect and sparkles.
  - L12 (2026-11-12): après l'illumination, la carte grandit au centre ~1 s (`.rv-zoom`, rien en `prefers-reduced-motion`) ; titre en `--fs-5`.
  - Setting: "Animation des nouvelles cartes" in Réglages (`ptcgp:reveal.enabled`).
  - Respects `prefers-reduced-motion`.
- **Recherche globale (lot E2, 2026-11-12):** `components/GlobalSearch.tsx` (lazy, feuille), `lib/search.ts` (`searchCards`, testé : nom FR/EN sans accents, numéro, identifiant `A1-12`), ouverte par la barre « Rechercher une carte » de l'accueil, le bouton « Rechercher » du menu latéral, Ctrl/Cmd+K ou « / » (`globalSearchContext.ts`, `useOpenSearch`) ; un résultat ouvre `CardDetail`.
- **Collection** (épurée 2026-11-12, lot L06): en-tête avec icônes (rechercher = déplie le champ, grille/liste) et « ? » ; `ChangeLine` extension (« Toutes les extensions » ou une seule, avec x / y) qui ouvre une feuille de choix ; puces Toutes / Manquantes / Doublons + `FilterButton` (feuille : Possédées, Échangeables, 11 raretés). Une extension choisie n'a plus d'en-tête de groupe ; pas de nom sous une tuile dont l'image est chargée (la tuile de secours le garde). Clés persistées inchangées (`col.setId`, `col.view`). Grid or list per expansion, card sheet with an editable quantity.
- **Évènements:**
  - **Écran épuré (lot L07, 2026-11-12):** en-tête avec icônes « synchroniser » (Android) / liste↔calendrier / « ? » (l'aide contient la synchro, l'import manuel .html et la source) ; état « à jour · il y a N min » à droite de « En cours » (`PzImport.tsx`: `useEventsSyncUi`, `SyncStatus`, `SyncHelp`, `FileImport`) ; prochaine extension sur une ligne ; une `ListRow` par évènement (vignette image/première carte/icône, nom sans préfixe `shortEventName`, temps restant, catégorie à droite, plus de pastille de source) ; fiche : missions groupées quand seule la valeur change et la récompense est la même (`groupMissions`), dates exactes et source ; calendrier : une pastille par catégorie, repère carré les jours de début ou de fin (`edgeOn`). Logique pure testée : `lib/events/display.ts`.
  - Only source is **Pokemon-Zone**. **Android app (2026-11-11):** synced automatically at app open/resume (at most once per hour, retry ≥30 min, hidden `PzWebView`, silent abort on a security check) plus a « Synchroniser avec Pokémon-Zone » button (`lib/events/sync.ts` reads `<main>` of `/schedule/` and `/schedule/upcoming/` with absolute links, `autoSync.ts` store, `db.syncImportedEvents` writes only changed rows and tombstones not-yet-started events that disappeared; last sync in `meta` `events.syncedAt`). Auto reads run one after the other (`native/autoReads.ts`: events then PocketMads); the shared window is reserved through `pzSync/window.ts` (a user-started read cancels an auto one). Web: Nicolas saves the "schedule" and "upcoming" pages (Ctrl+S) and imports them with the **"Import .html Pokemon-Zone"** button (under « Import manuel » on Android).
  - **Detailed rewards** (`events/rewardInfo.ts`, `features/events/RewardItem.tsx`): each reward/shop item keeps its PZ link (`/cards/…`, `/sets/<set>/packs/<pack>/`) and asset path (`src`). Cards → our card image + owned count; packs → our booster (pack image, set logo, emblem; « 1 carte ★★ garantie »; promo packs « Booster promo série C vol. 1 »); cosmetics (playmat, sleeves, coin, emblem, profile icon, backdrop, binder cover) named after the Pokémon in the file name via `public/data/jp-names.json` (JP asset token → FR card name, `scripts/build-jp-names.mjs`, refreshed by `update-sets.yml`). Images we do not ship are shown from `assets.pokemon-zone.com/game-assets/<src>?width=160` (no-referrer, SW cache `pz-assets`), falling back to the built-in icon if blocked; not verifiable from the sandbox.
  - The parser uses `data-start`/`data-end` and `/cards/<slug>/<n>/` links. Text is translated to French.
  - PROMO reissues are merged, and all Poké Gold offers are grouped into one event.
  - Every event opens a detail sheet (cards, missions, rewards with item icons). There is a list/calendar toggle.
  - The next expansion date comes from `releases.json` / `releaseWindow.ts`.
- **Méta:** since 2026-11-10 the **tiers come from PocketMads** (`app.pocketmads.com/tier-list`, robots.txt allows it, never call their `/api`), read in a real browser: Android app button (hidden `PzWebView`, now also allowed on `app.pocketmads.com`, needs an APK newer than 1.4.0) or the Holothèque bookmarklet run on the tier list (`#/meta?pm=`). `lib/pocketMads/` (extract, parse, match, sync, store `meta` `pm.tierlist`). Nicolas asked to drop the Holothèque-computed tiers from the UI; **since 2026-11-12 they are back as a fallback** (PocketMads offline): when the PocketMads read is older than 48 h, missing or failed, Méta shows the home tiers (7 d of `meta.json`) with a banner and a « Source : … » line, plus PocketMads / Calcul Holothèque chips (`lib/meta/source.ts`, tested). Limitless data (`meta.json`) still gives French names, icons, deck lists, matchups (7 d) and QR, matched by deck id then name. All PocketMads tiers are shown, even empty. Android: automatic hidden read at app open/resume, at most every 6 h (`pocketMads/auto.ts`, `pzOpen({hidden})` since the APK after 1.5.0; silent abort on a security check). `meta.json` is computed by **`update-meta.yml`** every hour (was 6 h; GitHub skips scheduled runs, a 6 h cron gave files up to 15 h old), separate from app deploys, and published alone on branch **`data`**; the app reads `raw.githubusercontent.com/Camelbaggy/ptcgp-collection/data/meta.json` first (SW NetworkFirst, not precached), else the offline copy bundled at deploy. See `docs/meta.md`.
- **Decks jouables (lot F3, 2026-11-12):** Méta a des filtres « Tous / Je peux le monter / Il manque ≤ 3 cartes » (`meta.build`, pastille « Complet / Manque N » par ligne) et la fiche d'un deck indique le booster à ouvrir en priorité. Logique pure et testée : `lib/meta/buildable.ts` (comptage par nom de carte toutes impressions confondues, booster qui maximise la chance d'obtenir au moins une carte manquante via `packHitProbability`).
- **Limitless data:** computed from the **public Limitless API** every 6 h by `update-meta.yml` (branch `data`).
  - Score fitted on PocketMads; method in `docs/meta.md`.
  - Deck detail shows the consensus list, **matchups vs the 20 most played archetypes** (`Matchups.tsx`, `DeckStats.matchups`, 2026-11-05) and an **in-game QR code** (`deckcode.ts`).
  - QR format: base64 of `u8 nbTrainers + u24be(entityId+10 000 000)…, u8 nbPokémon + u24be…, u8 nbEnergies + u8 type…`.
  - Energy codes: 1 Grass, 2 Fire, 3 Water, 4 Lightning, 5 Psychic, 6 Fighting, 7 Darkness, 8 Metal.
  - `entityId` comes from the flibustier `image` file names (`cPK_10_xxxxxx` / `cTR_20_xxxxxx`), stored in cards.json.
  - The QR round-trip was checked against one of Nicolas's real QR codes. **An in-game scan has not been confirmed by him.**
- **Pokédex** (épuré 2026-11-12, lot L06): ligne résumé « x / y espèces · % » → feuille Détail (trois compteurs + totaux par rareté) ; puces de génération défilantes + `FilterButton` (formes, type, Dans TCG Pocket / Pas encore / Manquants, tri et sens) ; recherche par l'icône de l'en-tête ; clés `dex.*` inchangées.
  - `pokedex.json` covers gens 1–9 plus Mega and regional forms (1179 entries), built from PokeAPI CSVs (GitHub raw), with PokeAPI sprites.
  - Sprites are cropped to their non-transparent bounding box by `fetch-sprites.mjs` (also in place for cached files) and scaled up to fill the tile with `image-rendering: pixelated`; `spriteUrl` carries `?v=2` (CacheFirst cache).
  - Filters: generation, form, type, "Dans TCG Pocket" / "Pas encore dans le jeu" (exclusive), "Manquants".
  - Sorts: number, name, distinct cards, owned, missing, %, rarities, generation; ↑/↓ toggle; persisted.
  - Card → species matching is in `pokedex/match.ts` and covers 100 % of cards (aliases for typos in names).
- **Stats** (redesigned 2026-11-11): three tabs (`stats.tab`), each with a « Source » line, so numbers never mix sources:
  - **Collection** (`CollectionTab.tsx`): current state, exact; échangeables/partageables use the **same rules as home** (`calc/offers` via `duplicateStock`/`duplicateCards`); note explaining why PZ rarity totals are bigger (deluxe reprints counted apart).
  - **Activité** (`ActivityTab.tsx`): app journal only (starts 31/10/2025), period 7/30/90 j/Tout (« depuis le … »). One pack definition everywhere (`isFullPack`, ≥4 cards): pulls, best pulls, luck and boosters all use full packs. Luck: unconditional mixture of the booster's pack types, packs whose card count is outside the booster's slot-count range are skipped (`packTypesFor`; journal 6-card entries are often not real bonus packs, so the count is not used to guess the type). New cards split by source (`gainsBySource`: packs / échanges / partages / corrections = imports PZ). Coverage vs PZ lifetime packs.
  - **À vie** (`LifetimeTab.tsx`, `lib/stats/lifetime.ts`): PZ stats snapshot + full packs entered after `fetchedAt`; packs by set/booster (`pzPackToBoosterId`: `PACK_ICON_AN005_…` = 5th set of series A, booster by mascot name), rarities obtained (SR+SAR merged), types/trainers/special (FR labels), real booster points, other counters with ranks (`PZ_COUNTER_FR`). Empty state links the PZ guide. Top card `PzStatsSync.tsx`: on Android, « Mettre à jour » runs the in-app sync in mode **`stats`** (home + stats pages only, no sets; snapshots saved directly by `savePzStatsResult`, no review); on the web, a link to the guide. Home « packs ouverts » pill uses PZ lifetime when a snapshot exists.
  - Shared calc in `features/stats/view.ts`; hand-written SVG charts (`features/stats/charts.tsx`, Okabe-Ito palette).
  - Every tile and section opens a detail sheet (`details.tsx`), and sheets can be stacked with "‹ Retour".
  - Luck: "rare" = E1+ (`RARE_RARITIES`). Pack points are no longer estimated (packs × 5 summed across sets was meaningless).
- **Échange / Partage pages** (écran unique `features/exchange/Exchange.tsx` à deux onglets depuis 2026-11-12, onglet « Échanges » dans la barre mobile; panneaux `TradePanel`/`SharePanel`, champ Ami commun) (2026-11-05): below the form, `history/RecentHistory.tsx` lists the last 10 trades/shares (thumbnails, date, friend), each opens `HistorySheet`; « Tout l'historique » links to `#/historique?type=trade|share` (History reads the `type` param; `useHistory(limit, kind)` filters in the query).
- **Points Booster (lot F2, 2026-11-12):** `#/points-booster` (`features/points/PackPoints.tsx`, logique pure testée `lib/calc/boosterPoints.ts`). Par extension : solde (instantané PZ + 5 pts/pack saisi, ou saisi à la main, pref `points.manual`), prix en points par rareté (`DEFAULT_POINT_COSTS`, **à vérifier dans le jeu**, modifiables, pref `points.costs`), cartes manquantes achetables (ni ♛ ni promos), « acheter ou ouvrir » (prix ÷ 5 packs contre packs attendus pour la tirer), achats conseillés avec le solde (glouton par gain de packs par point).
- **Échanges entre amis (lot F1, 2026-11-12):** 3e onglet « Avec un ami » (`?onglet=ami`) de `Exchange.tsx` (`FriendPanel.tsx`, `friends.css`). Sans serveur : « Mon code d'échange » = mes doubles selon les règles de `calc/offers` + mes cartes manquantes des raretés échangeables, texte `H1|pseudo|date|doubles|manquantes` (listes `A1:1~4.7;…`), deflate brut puis base64url (`lib/calc/friendTrades.ts`, testé). Partagé en lien `REMOTE_BASE#/echange-partage?onglet=ami&code=…` ou QR (`components/Qr.tsx`, partagé avec `DeckQr`). Le code d'un ami (lien ou code collé) est comparé à ma collection : par rareté, « Tu reçois » (ses doubles qui me manquent) / « Tu donnes » (mes doubles qui lui manquent), nombre d'échanges = min ; choisir une carte de chaque côté → « Préparer » ouvre l'onglet Échange pré-rempli (`donne`, `recoit`, ami). Codes d'amis gardés sur l'appareil seulement (`ptcgp.friendCodes`, 12 max, `friendStore.ts`) ; pseudo dans la préférence `friend.myName` ; les deux par profil (`profileDeviceKey`, `profilePrefName`). **Mise à jour automatique (2026-11-12, choix de Nicolas : Google Drive)** : « Activer » publie mon code dans un fichier JSON public (lecture par lien) de mon propre Drive, scope `drive.file` demandé à part (`requestToken({scope: FRIEND_SCOPE})`, jeton séparé de la synchro), contenu `{app, v, name, date, code}` seulement (`lib/sync/friendShare.ts`, testé) ; republié si le code a changé après chaque synchro (`onSyncDone` dans `engine.ts`, branché par `SyncController`), à l'ouverture de l'appli et de l'onglet (`features/exchange/friendAuto.ts`). Le lien porte alors `&f=<fileId>` ; l'appli d'un ami relit ce fichier sans connexion avec la **clé API publique** `VITE_GOOGLE_API_KEY` / `GOOGLE_API_KEY` (restreinte aux référents `camelbaggy.github.io` et `localhost`, API Drive seule), au plus une fois par heure par ami à l'ouverture de l'onglet ; la liste des amis montre le nombre d'échanges possibles. « Désactiver » supprime le fichier. Clé API codée en dur dans `friendShare.ts` (comme le client OAuth), surchargeable par `VITE_GOOGLE_API_KEY`.
- **Souhaits** (wishlist): 3 priority levels.
- **Nouvelle extension:** import a card list plus enter pull rates (generic model, no per-expansion logic).
- **v1.0.0 (2026-11-05, « amis »):** version in `package.json` → `__APP_VERSION__`. Welcome card on home when 0 cards owned (`dashboard/Welcome.tsx`, dismiss `ptcgp:welcome.dismissed`; since 2026-11-11: « Tout synchroniser depuis Pokémon-Zone » highlighted first (Android → `#/ajout?onglet=massive`, web → PZ guide), then « extension par extension » chips: Lecture d'écran (Android, `onglet=lecture`), Vidéo, Saisie manuelle), `/aide` (Help), `/a-propos` (fan disclaimer, credits, privacy), install button (`lib/install.ts`, `InstallButton`), `#/ajout?onglet=video|saisie|grille|maj`. Card/pack/sprite/item/event images are no longer precached: Workbox runtime CacheFirst `ptcgp-images`, plus « Télécharger toutes les images » in Réglages (`lib/offlineImages.ts`). Release plan for friends/public: https://claude.ai/artifact/DJTo8CKn5CN7qmBo8fSEXC
- **Sauvegarde et annulation (lot A4, 2026-11-11):** `lib/backupValidate.ts` refuse tout fichier dont une ligne est invalide (ids texte, quantités entières ≥ 0…) avant tout effacement ; Réglages télécharge une copie `ptcgp-avant-import-…json` avant d'écraser ; l'import ne vide plus la table `meta` (instantanés PZ, tier list conservés). `undoLast` n'annule que les évènements de cet appareil (`pickUndoable`) et lève `UndoError` (message clair) ; les appelants utilisent `.catch(onUndoError(toast))`. `#/meta?pm=` demande confirmation avant d'écraser la tier list ; `inflatePzPayload` plafonne à 32 Mo décompressés (`PZ_MAX_INFLATED`).
- **Modifier l'historique (lot E3, 2026-11-12):** la fiche d'un évènement (`HistorySheet`, Historique et « derniers échanges/partages ») a « Modifier » et « Supprimer » (`features/history/EventEditor.tsx`) pour n'importe quel évènement, de n'importe quel appareil : cartes d'un booster, carte/sens/ami d'un partage, cartes/ami/jetons d'un échange, quantités d'une mise à jour. Aperçu « Effet sur ta collection » avant d'enregistrer, toast « Annuler ». `db.rewriteEvent(oldId, next)` retire l'ancien id (marque de suppression) et ajoute le nouvel évènement sous un **nouvel id à la même date**, pour que la synchro (`rebaseOwned`, comparaison par id) ajuste les autres appareils. Effet par carte = δ(nouveau) − δ(ancien), sauf si une `correction` plus récente touche la carte (elle l'a absorbé, quantité inchangée) ; borné à 0. Logique pure et testée : `lib/historyEdit.ts`. La date n'est pas modifiable.
- **Widget Android (lot F11, 2026-11-12):** 4 widgets d'écran d'accueil au choix (Nicolas : « coder les 3 et laisser le choix », maquettes A/B/C dans `ptcgp-app/maquettes/widget-android/`) : B 4 × 2 (%, booster à ouvrir en premier, bouton « Ajouter un pack »), A = deux 2 × 2 (anneau de %, booster conseillé), C 4 × 3 (3 meilleurs boosters). Natif `native/holo-native/…/HoloWidget.kt` + `WidgetData.kt` (affichent seulement), données calculées par `lib/widget/summary.ts` (testé, même calcul que l'accueil) et poussées par `lib/native/WidgetBridge.tsx` (lazy, Android seulement) via `HoloNative.widgetUpdate`. Nécessite un APK après la 1.5.0. Détail : `docs/android.md`.
- **Profils du foyer (lot F8, 2026-11-12, `docs/profiles.md`):** une base IndexedDB par profil ; le principal garde la base `ptcgp` et ses clés (aucune migration), un autre profil a `ptcgp-p-<id>`, ses clés `ptcgp.p.<id>.*` (synchro) / `ptcgp:p.<id>.*` (`welcome.dismissed`, `pz.massOff` via `profilePrefName`) et son fichier Drive `ptcgp-sync-<id>.json`. Registre `ptcgp.profiles` + `ptcgp.profile.active` (`lib/profiles.ts`, `lib/profileOps.ts`) ; changer de profil **recharge la page** (tout le module-level repart). Pastille « Qui joue ? » sur l'accueil (mobile) et dans la barre latérale ; **gestion dans Réglages › Profil** (2026-11-12, option C de Nicolas, `features/settings/ProfileTab.tsx` : avatar = icône du jeu en un appui, « Nom et couleur », « Joueurs du foyer ») ; l'ancienne page Profil Pokémon-Zone est dans **Stats › À vie** (`stats/GameAccount.tsx`) ; `#/profil` et `#/profils` redirigent. Sauvegarde = profil actif (nom de fichier suffixé). Thème et filtres restent communs. Nouvelle donnée liée au joueur dans `localStorage` : passer par `profilePrefName`/`profileDeviceKey`. **Icône du jeu en image de profil** (2026-11-12) : `Profile.icon`, sélecteur `features/profiles/IconPicker.tsx`, catalogue `lib/profileIcons/` = Serebii (récentes, embarquées au déploiement par `fetch-profile-icons.mjs`, nouveautés guettées chaque jour par `update-profile-icons.yml` qui relance `deploy.yml`) + Pokémon-Zone `/accessories/icons/` (complet, lu dans l'appli Android ou page enregistrée importée) ; détail dans `docs/profiles.md`.
- **Barrière d'erreur** (`components/ErrorBoundary.tsx`, autour des routes dans `App.tsx`): une exception d'affichage montre un écran « Recharger / Exporter une sauvegarde / Retour à l'accueil » (la navigation reste visible, la barrière se réinitialise au changement de page); l'export vient de `lib/backupFile.ts`, partagé avec Réglages.
- **Export CSV (lot F9, 2026-11-12):** carte « Exporter en CSV » dans Réglages (`features/settings/ExportCsv.tsx`, logique pure testée `lib/exportCsv.ts`, sortie `lib/shareFile.ts`) : contenu (toutes/possédées/manquantes/doublons), séparateur `;` ou `,`, UTF-8 avec BOM, champs commençant par `= + - @` neutralisés. Télécharger (web), Copier (TSV, se colle directement dans Google Sheets), Partager (feuille de partage système ; sur Android le bouton Télécharger est masqué car la WebView ne gère pas les téléchargements blob). Pas de code natif, donc pas d'APK.
- **Notifications Android (lot F6, 2026-11-12, option B choisie par Nicolas):** plugin officiel `@capacitor/local-notifications` 8.3.1 (APK > 1.5.0 ; `Capacitor.isPluginAvailable('LocalNotifications')` sinon Réglages propose de mettre à jour l'APK). Calcul pur et testé dans `lib/notifications/plan.ts` : fin d'évènement (la veille / 6 h avant / les deux, filtre Pioches miracles · Missions et évènements · Boutiques · Offres Poké Lingots, regroupées par instant, nombre de cartes manquantes), sortie d'extension (jour même, option veille ; `releases.json` + extensions Pokémon-Zone, une par jour), rappel de mise à jour (dernière ligne d'historique + 3/7/14 j, à 19 h, puis tous les N jours). Jamais entre 22 h et 7 h (avancé à 21 h la veille), horizon 30 j, 40 max. `lib/notifications/native.ts` replanifie tout (annule puis prévoit, alarmes non exactes, canal `rappels`, petite icône `res/drawable/ic_stat_holo.xml`) au démarrage, au retour dans l'appli et quand les évènements ou l'historique changent (`liveQuery`) ; ne demande jamais l'autorisation sauf au clic sur « Activer les notifications » ; toucher une notification ouvre `extra.route`. Réglages › Notifications (`features/settings/NotificationsCard.tsx`, chargé seulement dans l'appli) : interrupteurs, puces, « Prochaines notifications », notification d'essai. Réglages dans `ptcgp:notif.settings` (propre à l'appareil, hors sauvegarde). Maquettes : `ptcgp-app/maquettes/notifications/`.
- **Réglages** (onglets depuis 2026-11-12 : **Profil** = joueur actif, icône, nom et couleur, joueurs du foyer (ajouté le 2026-11-12, option C) ; **Affichage** = Thème, Animation, Notifications (appli), Images hors connexion (web) ; **Données** = Synchro Drive, Vérifier les quantités, Sauvegarde JSON, Sauvegarde automatique, Export CSV ; **Appli** = Version et mise à jour, Journal (appli), Zone dangereuse). Chaque réglage est un encart repliable `components/Fold.tsx` (résumé d'une ligne, état mémorisé en pref `fold.<id>`, contenu toujours monté en `hidden`), onglet mémorisé `reglages.onglet` ; liens profonds `#/reglages?onglet=donnees` ou `?ouvrir=<id>` (sync, backup, notif…, table `TAB_OF` dans `Settings.tsx`). Nouveau réglage : un `Fold` dans le bon onglet. Contenu :
- **Réglages (détail):** (backup JSON now carries the `ptcgp:*` display preferences in `settings`, except device-only keys such as `pm.autoTry`; Drive sync does not carry them)
  - Theme.
  - Images hors connexion (download all).
  - Animation.
  - Drive sync, then « Vérifier les quantités » (history consistency check).
  - Version and "Rechercher une mise à jour".
  - JSON backup import/export.
  - History and undo.
  - Danger zone.

### UI (B "clair et coloré" theme, **dark by default**, chosen on 2026-11-04)
- Nunito, violet-navy backgrounds, soft glows, large radii, a single SVG line-icon set (`Icon.tsx`). Never use emoji in the UI.
- Each section has its own colour via `data-section` → `--section`, used by chips, buttons and focus rings:
  - blue: Collection
  - cyan: Pokédex
  - pink: Souhaits / Plus
  - orange: Échange
  - pink-red: Partage
  - yellow: Évènements
  - red: Méta
  - violet: Stats
  - green/teal: Ajout
  - grey: Nouvelle extension / Réglages
- **Logo rule:** show the **expansion logo** (Pokepedia) wherever an expansion is mentioned. Wherever a booster is mentioned, show the **set logo plus booster emblem** (Serebii), and the **pack image** (Pokekalos) where it fits.
- Mobile-first, targets ≥ 44 px, no horizontal overflow at 412 px. The light theme stays available.
- **Interface épurée (plan `ptcgp-app/plans/plan-ui-epure-2026-11.md`, demande de Nicolas du 2026-11-12 : moins de texte, plus intuitif, rien de perdu).** Les dix règles, pour tout écran nouveau ou modifié :
  1. Pas de mode d'emploi à l'écran : une explication de plus de 8 mots va dans l'aide « ? » de l'en-tête (exception : un état vide, une phrase).
  2. Pas de sous-titre de page quand le titre suffit ; gardé seulement s'il porte une donnée (« 190 / 217 cartes »).
  3. Une ligne par élément de liste (image, nom, une information à droite) ; le reste dans la fiche.
  4. Le contenu d'abord : première donnée utile au-dessus de 300 px à 412 × 900 ; réglages rares en ligne « Changer » ou en feuille.
  5. Trois filtres visibles au plus, les autres dans la feuille « Filtres » (nombre de filtres actifs sur le bouton).
  6. Actions secondaires en icônes dans l'en-tête (rechercher, rafraîchir, vue, aide), chacune avec `aria-label` ; l'état de synchro est l'une d'elles.
  7. Un chiffre, un libellé de trois mots au plus ; les précisions dans la fiche de détail.
  8. Pas de répétition (pas de nom sous une carte dont l'image est affichée, pas de nom d'extension à côté de son logo, pas de pastille de source identique sur chaque ligne).
  9. Budget : 60 mots au plus sur le premier écran (80 pour Stats), 0 phrase d'explication hors état vide.
  10. Rien n'est supprimé : tout texte retiré reste dans « ? », la fiche ou Aide ; aucune fonction, route ni lien profond (`?onglet=`, `?ouvrir=`) ne disparaît.
- **Kit de page (lot L01, 2026-11-12)** — à utiliser plutôt que du balisage maison :
  - `PageHeader` (`components/PageHeader.tsx`) : `icon`, `title`, `sub` facultatif, `help` (blocs `{title?, text}` de la feuille d'aide, bouton « ? »), `actions` (`{icon, label, onClick | to, badge?, pressed?, primary?}` → boutons icônes de 44 px), `children` pour un contrôle particulier. Rend lui-même l'**icône d'état de synchro** à droite (plus de bouton flottant ; sur l'accueil elle reste à côté de la puce de profil). L'en-tête passe à la ligne plutôt que de se chevaucher. `HeaderIconButton` = un de ces boutons seul.
  - `HelpSheet` (`components/HelpSheet.tsx`) : feuille « Aide · <titre> » ; y déplacer les textes **tels quels**.
  - `components/PageKit.tsx` : `ChangeLine` (ligne de 48 px logo + libellé + valeur + « Changer », la feuille de choix appartient à l'écran) ; `FilterButton` (puce « Filtres · n », n masqué à 0) + `FilterSheet` (« Réinitialiser » / « Voir ») + `FilterSection` ; `ListRow` (vignette 44 × 60 ou icône, titre sur deux lignes au plus, sous-ligne d'une ligne, zone droite, chevron ; `onClick`/`to` rendent la ligne cliquable, `actions` reste hors de la zone cliquable) ; `SegTabs` (segments sur une ligne, défilement horizontal, jamais de libellé sur deux lignes) ; `ActionButton` (bouton principal avec `hint`, 5 mots au plus, affiché sous le bouton tant qu'il est inactif).
  - Bouton désactivé commun : `.btn:disabled` = fond `--surface-2`, texte `--muted` (plus de couleur de section ternie).
  - `useKeyboardOpen()` (`lib/useKeyboardOpen.ts`, monté dans `Shell`) : `data-kb="open"` sur `<html>` quand la zone visible fait moins de 75 % de la plus grande hauteur vue ; le CSS masque alors la barre du bas et colle `.actionbar` en bas.
  - `Sheet` : la zone des boutons système (`--sab`) est sous la zone qui défile, plus par-dessus le contenu.
  - Jetons : `--fs-1`…`--fs-7` (12, 13, 14, 16, 18, 23, 32 px), `--r-s` 8, `--r-m` 14, `--r-l` 22, `--r-pill`. Les nouveaux composants n'utilisent que ces jetons ; le remplacement des valeurs en dur est le lot L14.
  - Écran témoin : Souhaits. Tests : `e2e/page-kit.spec.mjs` (en-tête jamais recouvert à 360/412/450 px sur 25 écrans, aide fermée par croix/Échap/glisser avec retour du focus, clavier).

## 6. Synchronisation (Google Drive)
- `drive.appdata` scope (hidden app folder in **each user's own Drive**). Merge is last-writer-wins per row, with tombstones for deletions.
- **Garde-fous (lot A3, 2026-11-11):** `importedEvents` et ses marques de suppression sont synchronisés (et surveillés par `engine.ts`) ; les `updatedAt` distants sont bornés à « maintenant » à la fusion (horloge en avance) ; les marques de suppression de plus de 90 jours sont purgées (locales et distantes) ; deux fichiers Drive créés en même temps convergent vers le plus ancien (`createUniqueFile`) ; les écritures faites par la synchro elle-même ne la relancent pas (`isApplyingSync`). Non fait : l'historique complet est toujours renvoyé à chaque synchro.
- **Instantanés Pokémon-Zone (lot E5, 2026-11-12):** `meta` `pz.home`, `pz.stats`, `pz.themed` voyagent dans la table de synchro `pz` (lignes `home`/`stats`/`themed`, `updatedAt` = `fetchedAt`, sans `by` : le plus récent `fetchedAt` gagne ; pas de suppression). Profil, Collections à thème et Stats « À vie » ne sont donc plus vides sur le second appareil. `engine.ts` surveille les écritures de clés `pz.*` de `meta`. Un fichier Drive plus ancien sans table `pz` reste lisible.
- **Quantités sans perte (lot B1, 2026-11-11, `docs/sync.md`):** après la fusion LWW, `mergeSnapshots` rebase chaque ligne `owned` gagnante sur l'historique fusionné (`sync/rebase.ts` `rebaseOwned`) : les évènements que l'appareil gagnant ignorait sont ajoutés, ceux annulés ailleurs retirés ; une `correction` est une valeur absolue datée qui absorbe les évènements plus anciens. Deux packs hors ligne sur deux appareils ⇒ +2. Restent LWW : les ajustements manuels de la fiche carte (`setOwned`, sans évènement). Réglages › « Vérifier les quantités » (`features/sync/ConsistencyCheck.tsx`, `checkOwnedConsistency`) compare chaque carte à sa dernière correction + évènements suivants et propose une `correction` (cases à décocher).
- Nicolas's Google Cloud project "PTCGP Collection". OAuth client ID (public) is hardcoded in `src/lib/sync/gis.ts`:
  `1041120278633-rduag2vvlt9tee2pf50v0eqc1gpdie7o.apps.googleusercontent.com`.
- The consent screen is in **Testing** mode. Friends must be added as test users in Google Cloud Console.

## 7. Pipelines (GitHub Actions)
- **`ci.yml`** (job `ci`, sur chaque PR): `npm ci`, `tsc -b`, `vitest run`, `oxlint --deny-warnings` (zéro avertissement ; `react/only-export-components` désactivée, confort HMR seulement ; exceptions notées `// oxlint-disable-next-line règle -- raison`), `vite build`. À rendre obligatoire dans Settings → Rules → Rulesets (ruleset sur `main`, « Require status checks to pass » = `ci`). Les PR automatiques (`update-sets`, `update-pokedex`, créées avec `GITHUB_TOKEN`) ne déclenchent pas `ci` : ces workflows lancent donc `tsc`, `vitest` et `build` avant d'ouvrir la PR. `dependabot.yml` : actions et npm, mensuel. Timeouts sur tous les workflows ; `android-apk` a une `concurrency`.
- **Tests E2E** (lot C7, `e2e/smoke.spec.mjs`, `playwright.config.mjs`, `npm run e2e`): fumée Playwright + axe-core sur le build de production (`vite preview`, `BASE_PATH=/ptcgp-collection/`), aux deux tailles (412 et 1280). Jeu de données de démonstration généré par `e2e/demo-backup.mjs` à partir de `public/data` (déterministe, aucune donnée personnelle), importé par Réglages. Couvre : navigation de tous les écrans, ajout d'un pack puis annulation, sauvegarde invalide refusée, évènements/souhaits remplis, axe (seules les violations « critical » échouent ; le reste est consigné). Étape finale de `ci.yml`, rapport HTML en artefact si échec. Les images de cartes ne sont pas téléchargées en CI : les tuiles montrent leur numéro de secours.
- **`deploy.yml`:** runs on push to `main` (and by hand) only; no schedule since 2026-11-11 (Limitless moved to `update-meta.yml`). Build date = commit date, Android bundle version = short SHA, `meta.json`/`app-version.json` not precached, so a redeploy of the same commit shows no « Nouvelle version » banner. Downloads are cached and **never fatal**:
  1. Card images (`fetch-images.mjs`): Pokekalos `media.pokekalos.fr/img/jeux/pocket/extensions/<slug>/<num>.png` (slugs in `set-slugs.json`), then TCGdex, then Limitless. Output: webp in `public/cards/`.
  2. Set logos: Pokepedia (`fetch-logos.mjs`).
  3. Booster emblems: Serebii (`fetch-emblems.mjs`, explicit `EMBLEMS` table).
  4. **Pack images:** Pokekalos `…/extensions/<slug>/boosters/<file>.png` (`fetch-pack-images.mjs`, explicit table for 32 boosters, 480 px). Promos have none.
  5. Event item icons: Serebii (`fetch-item-icons.mjs`).
  6. Pokédex sprites: PokeAPI (`fetch-sprites.mjs`).
  7. Offline copy of `meta.json` downloaded from branch `data` (computed by **`update-meta.yml`**, every 6 h: `fetch-meta.mjs`, then force-pushed alone to branch `data`). Rules:
     - Last 7 days, non-custom tournaments with no banned cards.
     - Throttle 800 ms.
     - The 24 h delta is computed against the previously deployed `meta.json`.
  8. Build, then deploy to Pages.
- **Cache caveat:** the image caches restore with prefix-only `restore-keys`. An existing file is not downloaded again unless the script is run with `--force`.
- **`update-sets.yml`:**
  - Checks for new expansions: cron every 3 h (`15 */3 * * *`), but the job only works at 06:xx UTC (daily run) or in the window [release, release + 3 days] (`release-window.mjs`). GitHub disables scheduled workflows after 60 days without repository activity: if they stop, push any commit or re-enable them in the Actions tab.
  - Sources: flibustier dataset (`pokemon-tcg-pocket-database`, cards, pull rates, entityIds) plus TCGdex for French names.
  - Opens a PR `auto/new-sets-<date>`. This needs the repo setting "Allow GitHub Actions to create and approve pull requests".
- **`android-apk.yml`** (manual `workflow_dispatch` with input `version_code` only, the version comes from `package.json`; on a PR touching `android/**`, `native/**`, `capacitor.config.ts` or `package*.json` it only builds the APK as an artifact): Capacitor build (`npm run build` with `VITE_TARGET=android`, the deployed `app-bundle.zip` reused when reachable, `cap sync android`, `gradlew assembleRelease`, zipalign, apksigner) signed with secrets `ANDROID_KEYSTORE_B64` / `ANDROID_KEYSTORE_PASSWORD` (alias `ptcgp`; throwaway key if absent), attached to Release `v<version>`. Package `io.github.camelbaggy.ptcgp`, minSdk 24. Keystore kept in project files `ptcgp-app/android-prive/` (never in the repo). **Release rule (Nicolas, 2026-11-09): never dispatch this workflow from a work thread; report to the coordinator that an APK is needed.** Web-only changes reach the installed app through the OTA update (`deploy.yml` publishes `app-bundle.zip` + `app-version.json` with its SHA-256), no new APK. Full detail in `docs/android.md`. (The former TWA/Bubblewrap build and `assetlinks.json` no longer exist.)
- **`update-profile-icons.yml`** (chaque jour 07:40 UTC) : `scripts/check-profile-icons.mjs` compare la page Serebii des icônes de profil à `data/profile-icons.json` du site ; s'il y en a de nouvelles, `gh workflow run deploy.yml` (permission `actions: write`).
- **`pipeline-health.yml`** (daily 07:30 UTC, 2026-11-12): checks `meta.json` on branch `data` (> 24 h old = `update-meta` silently failing) via `scripts/pipeline-check.mjs` (`scripts/lib/health.mjs`, tests in `src/lib/pipelineHealth.test.ts`); opens/updates a GitHub issue labelled `pipeline-health`, closes it when green. Simulate with the dispatch inputs `meta_file` + `now`. `deploy.yml` has a similar step (card images below 95 % of `cards.json`). The Méta screen warns when the Limitless data is older than 24 h. The download scripts share `sleep`, request timeout and `loadSharp` from `scripts/lib/common.mjs`.
- **Mesure de l'interface** (lot L02, 2026-11-12) : `npm run ui:audit` (`e2e/ui-audit.mjs`, après un `BASE_PATH=/ptcgp-collection/ npm run build`) sert les captures de `dist` et mesure chaque écran à 412 px (et 1280 px) : débordement, cibles < 44 px, tailles de police, textes < 12 px, mots du premier écran / d'explication, position du premier contenu (attribut `data-content-start`, à poser sur le premier élément de contenu d'un nouvel écran), contrastes axe. Options : `--shots <dossier>` (captures), `--out`, `--full` (clair + 360 px), `--only a,b`, `--strict`, `BACKUP=<fichier>` (sinon jeu de démonstration). Sortie `ui-audit/ui-audit.json` + `.md`. Étape **non bloquante** de `ci.yml` (tableau dans le résumé du job, artefact `ui-audit`).
- **Version (single source):** `package.json`. `android-apk.yml` reads it (no `version` input any more, only `version_code`); bump `package.json` in the PR that prepares an APK. Réglages shows it.
- **`update-pokedex.yml`:** Mondays 06:30 UTC. Rebuilds `pokedex.json`, for example for gen 10, and opens a PR if it changed.

## 8. Known issues and ideas
- **Data:**
  - Checked 2026-11-05 against flibustier: every set is complete. Deluxe sets (A4b 165/379, B4b 193/429) and A1a-63 only look short because non-shiny reprints are stored once, as the original card (same image) with the deluxe booster added to its `boosterIds`; only the « Brillante » versions get their own ids. Consequence: the video import cannot align a deluxe set's exchange screen (its order uses A4b numbers).
  - French name errors fixed 2026-11-11: table in `src/lib/importers/nameFixes.ts` (by card id and by spelling variant), applied by `mergePublicData` so `update-sets` keeps it; `src/lib/data.test.ts` checks the shipped data (same `nameEn` ⇒ same `name`, only the 4 mission cards A1-283, C1-152, C1-183, C1-185 have no booster). New wrong names from the sources: add them to the table. English names of regional forms still have two spellings (`Paldean Wooper` / `Wooper Paldea`), left as is.
- **Tier list:** remaining gaps against PocketMads on a few decks (Mega Charizard Y ex/Entei ex, Giratina ex/Darkrai ex). Refit the score once more days of data are available.
- **Waiting on Nicolas:**
  - In-game QR scan confirmation.
  - His opinion of the tier list compared with PocketMads.
  - Pokemon-Zone full collection page (`/cards/`) is too heavy to save; the per-expansion `sets/<SET>/` page is used instead (Ajout › Import).
  - B2 emblem and C1 Mewtwo/Pikachu naming questions.
- **Not verified visually** (no data in the sandbox):
  - Filled-in wishlist strip.
  - Populated event list and calendar.
  - Tier list in the new theme.
- **Possible future:**
  - Collection import from a screen recording or screenshots (card recognition), with no datamining.
  - Dead code: `EventsHome.tsx`, no longer used on the home page.
- More detail:
  - `docs/journal.md`: dated history and detailed import-tool notes.
  - `docs/android.md`: Capacitor app, plugin, OTA updates, APK release.
  - `docs/legacy-logic.md`: the sheet's calculation logic.
  - `docs/public-sources.md`: data sources.
  - `docs/meta.md`: tier-list score.
  - `docs/questions.md`: past UI choices.
