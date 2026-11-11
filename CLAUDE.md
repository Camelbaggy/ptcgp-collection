# PTCGP Collection — CLAUDE.md

This is Nicolas's personal app **Holothèque** (renamed from "PTCGP Collection" on 2026-11-05; logo = dark card with rainbow frame on an iridescent background, `public/icons/icon.svg`; repo, URL, TWA package id and storage keys unchanged) for tracking his **Pokémon TCG Pocket** collection. It is a PWA that replaces his Google Sheet "PTCGP", which had become slow and rigid.
- **UI text is in French**, and Nicolas is spoken to in French.
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
- No datamining of the game, and no interception of the Nintendo account. Do not reproduce Pokemon-Zone's account sync.
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
- Debug branches still to clean up some day: `debug/raenonx`, `debug/upcoming`, `debug/pocketmads`, `debug/eventpages`, `debug/pz-probe` (`probe-pz.yml`, status lines only), `debug/video-fp` (its `probe-fp.yml` prints card fingerprints of chosen sets to the job log; read with `get_job_logs`, the session cannot delete branches).

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
- No backend. Sync uses the user's Google Drive (see §6).

## 3. Code layout
```
src/
  App.tsx            nav (desktop sidebar grouped ≥900 px, mobile bottom bar with central +), routes, More page
  styles.css         design tokens (dark B theme by default) + shared components
  lib/
    types.ts         data contract (see §4)
    db.ts            Dexie schema v1→v3, JSON loading, applyEvent/applyCorrections/setOwned (emit reveal)
    useData.ts       hooks, RARITY_LABEL, usePersisted (localStorage with try/catch)
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
  features/<screen>/ one folder per screen (see §5)
scripts/             Node build-time scripts (fetch-*.mjs, update-sets, build-pokedex, add-entity-ids), lib/common.mjs
public/data/         reference JSON (cards, sets, boosters, rates, releases, set-slugs, pokedex); meta.json generated
docs/                legacy-logic.md (sheet logic), public-sources.md, meta.md (tier-list score), questions.md
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
- **Shipped vs. user data:** reference data ships in `public/data/` and is reloaded on update. Sets added by hand are kept (`meta.shippedSetIds`).
- **SP1 Mew:** uses negative numbers −1..−3.

## 5. Screens and business rules
Routes: `/`, `/profil`, `/collections-a-theme`, `/guide-pokemon-zone`, `/ajout`, `/partage`, `/echange`, `/collection`, `/evenements`, `/meta`, `/pokedex`, `/souhaits`, `/stats`, `/extension/nouvelle`, `/extension/:setId/taux`, `/reglages`, `/plus`.

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
- **Ajout layout (2026-11-11, Nicolas):** 4 categories, each with method sub-tabs, recommended first (star + « Recommandé » tag), defined in `features/add-pack/methods.ts` (Android vs web lists; native-only « Lecture d'écran » hidden on web; old `?onglet=` values mapped by `fromOnglet`, `pz`/payload → MAJ massive, `pz1` → 1 extension):
  - **1 booster**: Capture d'écran (rec.) · Saisie manuelle (Recherche/Grille toggle) — `PackEntry.tsx`, shared set/booster choice `boosterChoice.ts`.
  - **10 boosters**: Lecture d'écran (rec., Android) · Captures · Vidéo · Saisie manuelle (booster after booster) — `RecapImport source=…`.
  - **1 extension**: Pokémon-Zone (rec.; Android: `PzSyncOne`, sync mode `sets` with one set; web: bookmarklet) · Lecture d'écran (Android, `VideoImport source="screen"`) · Vidéo · Saisie manuelle (`BulkUpdate`).
  - **MAJ massive**: Pokémon-Zone (Android: `PzSyncMass`, checklist of sets, Tout cocher/décocher, unchecked ids persisted in `pz.massOff`, optional profile pages; web: bookmarklet « Tout » + saved pages).
  - The sections below describe the underlying tools (former tab names).
- **Ajout** (former layout, tools still used) had four tabs (Saisie, Grille, Mise à jour, Import):
  - **Saisie**: type-ahead on the start of the FR/EN name or the number, Enter to add.
  - **Grille**.
  - **Mise à jour**: bulk entry of real quantities, which writes a `correction` event.
  - **Import** tab (persisted sub-choice `import.source`, `ImportTab.tsx`) has two sources:
  - **Pokémon-Zone page** (2026-11-05, `importers/pzCollection.ts`, `PzCollectionImport.tsx`): Nicolas saves his profile page `players/<id>/sets/<SET>/` (one expansion, light enough) and imports one or more .html files. Each card block gives the `/cards/<slug>/<n>/` link, the count (`__count`, absent = 0), the image name `cPK_10_<entityId>_<variant>_…_<rarity>` and the rarity icon (C D1, U D2, R D3, RR D4, AR E1, SR/SAR E2, IM E3, S S1, SSR S2, UR C1). Matching: same number + entity first, then by entityId + rarity preferring cards sold in the set's boosters (deluxe reprints). Checked on C1: 217/217 matched, counts equal the video truth and include the 3 cards the game screen omits. Deluxe: checked on the full B4b page (28 MB .mhtml, 429/429 matched): reprints carry a new deluxe rarity, so the entity pass excludes the page's own set (brillantes match by number) and uses rarity only as a tie-breaker; 60/60 right. The page shows 60 cards per « Load More » click: a visible button (not `d-none`, which marks a fully loaded page) sets `hasMore` and the UI warns (absent cards stay unchanged). Accepts .html and .mht/.mhtml (Brave Android; quoted-printable decoded). Image names may carry a hash (`…_C.c1723df7.webp`). Old backups restore cards without `entityId`, so the import fills it from the shipped `data/cards.json`. Review shows changes only, warns on decreases (stale PZ sync), saves one `correction`.
    - **Bookmarklet « Envoyer vers Holothèque »** (2026-11-06, `importers/pzBookmarklet.ts`, `PzBookmarklet.tsx`): run by Nicolas on his PZ profile in his own browser. On a set page it asks (confirm) this set or all; elsewhere, all sets (codes from `/players/<id>/sets/` links, else the app's set list baked in). Per set: hidden same-origin iframe, clicks « Load More » until done, reads the cards; fallback fetch+DOMParser (first 60 only) if the iframe is blocked; 1.5 s pause between sets; progress overlay. Then navigates to `app#/ajout?onglet=pz&pzz=<deflate-raw base64url JSON>` (`pz=` plain JSON if no CompressionStream), payload v2 `{player, pages:[{set, more, rows:[[/cards/x/n/, count, name, image, rarity]]}]}` parsed by `parsePzPayload`/`inflatePzPayload`; the app strips it from the URL. Player id remembered (`ptcgp:pz.player`) for the « Ouvrir sur Pokémon-Zone » button. Tested by simulation (routed saved pages) in Playwright only; **not yet tested on the real site** (iframe may be blocked by X-Frame-Options). Never automate the Nintendo account side (Nicolas asked 2026-11-06; declined).
    - **Profile pages (2026-11-06, bookmarklet payload v3):** the menu offers « Tout » (all sets + home, stats, themed collections, wishlist; onboarding or after a new set's opening frenzy), « Mise à jour rapide » (home + wishlist + the displayed set) and « Seulement l'extension ». Non-set pages travel as cleaned `<main>` html in `html.{home,stats,themed,wishlist}` (`pzPayloadHtml`); saved .html/.mht files of these pages are detected by `detectPzPage`. Parsers in `lib/pzProfile/parse.ts`; snapshots saved in `meta` (`pz.home`, `pz.stats`, `pz.themed`, `store.ts`, **not synced by Drive**); wishlist cards added at priority 2 without touching existing ones (`resolve.ts`: PZ image → card, SR → lowest number, SAR → highest). Screens: **Profil** `#/profil` (`baseline.ts`: PZ counters + full packs entered after the import; pack points +5/pack), **Collections à thème** `#/collections-a-theme` (`themed.ts`: missing cards re-checked against the live collection; PZ's « Missing cards » header = number of incomplete collections, not cards), Stats tile « Depuis le début », tutorial **`#/guide-pokemon-zone`** (`features/pz-guide`, linked from Welcome, Aide and the Import tab). Simulated end-to-end on Nicolas's real pages: back in the app in 8 s, URL ≈ 71 KB. **Short loader (2026-11-06):** the 8 KB `javascript:` URL did nothing on Brave Android (a 22-char `alert` worked), so the bookmarklet is now a ~300-char loader that injects `<app>/pz-favori.js?t=…` (emitted by the `pz-favori` plugin in `vite.config.ts` from `pzFavoriScript()`, not precached); the app URL comes from `document.currentScript`. Pages other than the current one are read in a popup tab opened on the menu click (`window.open`, same origin; Pokémon-Zone seems to block hidden iframes: on the real site only the current page was read), with iframe then fetch as fallbacks. Errors show an alert. The script updates with each deploy, no need to recreate the bookmark.
  - **Synchro Pokémon-Zone intégrée (Android app only, 2026-11-10):** `PzSyncPanel` (Import tab) starts `lib/pzSync` (`run.ts` orchestrator over a `PzHost`, `extractors.ts` JS snippets, `store.ts` + `components/PzSyncBar.tsx` progress bar). The native `PzWebView.kt` (HoloNative `pzOpen/pzNavigate/pzEval/pzSetVisible/pzClose`, event `pzUi`) shows Nicolas's PZ profile in a real WebView; he passes Cloudflare/login himself, then the window moves offscreen and the sync reads home/stats/themed/wishlist/sets one page at a time (human pace) and ends in the usual review screen via a payload v3. Only `*.pokemon-zone.com` is allowed, no JS interface exposed, no UA change, no bypass. New native methods need a new APK (`pzSyncSupported()` detects old ones); not testable in the sandbox beyond jsdom/FakeHost tests.
  - **Vidéo** (2026-11-05): import of a screen recording of the in-game **"Échange de points Booster"** screen of one expansion. `src/lib/videoScan/` (pure, tested on Nicolas's C1 video: 214/214 cards identified, 213/214 counts right, the miss flagged):
    - frames sampled at 5 fps via `<video>` seek, scaled to 592 px wide (`layout.ts` geometry: 3 columns, slate copy badge, light badge = 0);
    - scroll offset per frame (`scroll.ts`), badge rows fitted to a lattice (`lattice.ts`), best frames re-read per row (`scan.ts`);
    - copy count read by digit templates (`digits.ts`, learned from the video) with a vote across frames;
    - card identity: 6×8 colour fingerprint of the art vs our own card images (`fingerprint.ts`, computed in the browser from the precached webp), ordered DP alignment (`align.ts`) because the game omits a few cards (C1: Miel ★, Pikachu ★★★, Méga-Mewtwo X ★★★).
    - Review screen shows only changes and doubtful reads, video thumbnail next to our card, editable; saves one `correction` event (undo toast).
  - **Capture d'écran** (Saisie/Grille, 2026-11-05): "Depuis une capture d'écran" button, or Ctrl+V on PC. `videoScan/screenshot.ts` finds the 4–6 cards of an end-of-opening screenshot by row/column projections (uniform card size = median width), `boxVariants` tries 27 framings; cards matched against **all** cards with a small bonus for the selected set; review list with top 4 candidates per card; adding switches set/booster to the majority one. Tested on Nicolas's 3 screenshots (C1, A4b, B1): 13/15 right in the sandbox, the 2 misses flagged (shiny Alolan Diglett; Tortank-ex, a reprint stored as A1-56, which the sandbox test set lacked). The preferred set includes reprints sold in its boosters.
  - Reference fingerprints for every card: `scripts/build-fingerprints.mjs` (deploy step, `node --experimental-strip-types`, imports `fingerprint.ts`) → `public/data/fingerprints.json` (generated, git-ignored). `prints.ts` falls back to computing from images when a card is missing there.
  - A toast offers "Annuler" for 6 s. The "Chercher dans tous les boosters de l'extension" checkbox widens the search.
- **"Nouvelle carte !" animation** (`NewCardReveal`):
  - Triggers: any save that takes a card from 0 to ≥1 (pack, share, trade, correction, +/− on the card sheet). Undo and sync/import do not trigger it.
  - Display: opens the expansion grid, and the new card lights up with a holo effect and sparkles.
  - Setting: "Animation des nouvelles cartes" in Réglages (`ptcgp:reveal.enabled`).
  - Respects `prefers-reduced-motion`.
- **Collection:** grid or list per expansion, card sheet with an editable quantity.
- **Évènements:**
  - Only source is **Pokemon-Zone**. Nicolas saves the "schedule" and "upcoming" pages (Ctrl+S) and imports them with the **"Import .html Pokemon-Zone"** button, which opens the file picker directly.
  - The parser uses `data-start`/`data-end` and `/cards/<slug>/<n>/` links. Text is translated to French.
  - PROMO reissues are merged, and all Poké Gold offers are grouped into one event.
  - Every event opens a detail sheet (cards, missions, rewards with item icons). There is a list/calendar toggle.
  - The next expansion date comes from `releases.json` / `releaseWindow.ts`.
- **Méta:** since 2026-11-10 the **tiers come from PocketMads** (`app.pocketmads.com/tier-list`, robots.txt allows it, never call their `/api`), read in a real browser: Android app button (hidden `PzWebView`, now also allowed on `app.pocketmads.com`, needs an APK newer than 1.4.0) or the Holothèque bookmarklet run on the tier list (`#/meta?pm=`). `lib/pocketMads/` (extract, parse, match, sync, store `meta` `pm.tierlist`). Nicolas asked to drop the Holothèque-computed tiers from the UI. Limitless data (`meta.json`) still gives French names, icons, deck lists, matchups (7 d) and QR, matched by deck id then name. All PocketMads tiers are shown, even empty. Android: automatic hidden read at app open/resume, at most every 6 h (`pocketMads/auto.ts`, `pzOpen({hidden})` since the APK after 1.5.0; silent abort on a security check). `meta.json` is computed by **`update-meta.yml`** every 6 h, separate from app deploys, and published alone on branch **`data`**; the app reads `raw.githubusercontent.com/Camelbaggy/ptcgp-collection/data/meta.json` first (SW NetworkFirst, not precached), else the offline copy bundled at deploy. See `docs/meta.md`.
- **Limitless data:** computed from the **public Limitless API** every 6 h by `update-meta.yml` (branch `data`).
  - Score fitted on PocketMads; method in `docs/meta.md`.
  - Deck detail shows the consensus list, **matchups vs the 20 most played archetypes** (`Matchups.tsx`, `DeckStats.matchups`, 2026-11-05) and an **in-game QR code** (`deckcode.ts`).
  - QR format: base64 of `u8 nbTrainers + u24be(entityId+10 000 000)…, u8 nbPokémon + u24be…, u8 nbEnergies + u8 type…`.
  - Energy codes: 1 Grass, 2 Fire, 3 Water, 4 Lightning, 5 Psychic, 6 Fighting, 7 Darkness, 8 Metal.
  - `entityId` comes from the flibustier `image` file names (`cPK_10_xxxxxx` / `cTR_20_xxxxxx`), stored in cards.json.
  - The QR round-trip was checked against one of Nicolas's real QR codes. **An in-game scan has not been confirmed by him.**
- **Pokédex:**
  - `pokedex.json` covers gens 1–9 plus Mega and regional forms (1179 entries), built from PokeAPI CSVs (GitHub raw), with PokeAPI sprites.
  - Filters: generation, form, type, "Dans TCG Pocket" / "Pas encore dans le jeu" (exclusive), "Manquants".
  - Sorts: number, name, distinct cards, owned, missing, %, rarities, generation; ↑/↓ toggle; persisted.
  - Card → species matching is in `pokedex/match.ts` and covers 100 % of cards (aliases for typos in names).
- **Stats** (redesigned 2026-11-11): three tabs (`stats.tab`), each with a « Source » line, so numbers never mix sources:
  - **Collection** (`CollectionTab.tsx`): current state, exact; échangeables/partageables use the **same rules as home** (`calc/offers` via `duplicateStock`/`duplicateCards`); note explaining why PZ rarity totals are bigger (deluxe reprints counted apart).
  - **Activité** (`ActivityTab.tsx`): app journal only (starts 31/10/2025), period 7/30/90 j/Tout (« depuis le … »). One pack definition everywhere (`isFullPack`, ≥4 cards): pulls, best pulls, luck and boosters all use full packs. Luck: unconditional mixture of the booster's pack types, packs whose card count is outside the booster's slot-count range are skipped (`packTypesFor`; journal 6-card entries are often not real bonus packs, so the count is not used to guess the type). New cards split by source (`gainsBySource`: packs / échanges / partages / corrections = imports PZ). Coverage vs PZ lifetime packs.
  - **À vie** (`LifetimeTab.tsx`, `lib/stats/lifetime.ts`): PZ stats snapshot + full packs entered after `fetchedAt`; packs by set/booster (`pzPackToBoosterId`: `PACK_ICON_AN005_…` = 5th set of series A, booster by mascot name), rarities obtained (SR+SAR merged), types/trainers/special (FR labels), real booster points, other counters with ranks (`PZ_COUNTER_FR`). Empty state links the PZ guide. Home « packs ouverts » pill uses PZ lifetime when a snapshot exists.
  - Shared calc in `features/stats/view.ts`; hand-written SVG charts (`features/stats/charts.tsx`, Okabe-Ito palette).
  - Every tile and section opens a detail sheet (`details.tsx`), and sheets can be stacked with "‹ Retour".
  - Luck: "rare" = E1+ (`RARE_RARITIES`). Pack points are no longer estimated (packs × 5 summed across sets was meaningless).
- **Échange / Partage pages** (2026-11-05): below the form, `history/RecentHistory.tsx` lists the last 10 trades/shares (thumbnails, date, friend), each opens `HistorySheet`; « Tout l'historique » links to `#/historique?type=trade|share` (History reads the `type` param; `useHistory(limit, kind)` filters in the query).
- **Souhaits** (wishlist): 3 priority levels.
- **Nouvelle extension:** import a card list plus enter pull rates (generic model, no per-expansion logic).
- **v1.0.0 (2026-11-05, « amis »):** version in `package.json` → `__APP_VERSION__`. Welcome card on home when 0 cards owned (`dashboard/Welcome.tsx`, dismiss `ptcgp:welcome.dismissed`), `/aide` (Help), `/a-propos` (fan disclaimer, credits, privacy), install button (`lib/install.ts`, `InstallButton`), `#/ajout?onglet=video|saisie|grille|maj`. Card/pack/sprite/item/event images are no longer precached: Workbox runtime CacheFirst `ptcgp-images`, plus « Télécharger toutes les images » in Réglages (`lib/offlineImages.ts`). Release plan for friends/public: https://claude.ai/artifact/DJTo8CKn5CN7qmBo8fSEXC
- **Réglages:**
  - Theme.
  - Images hors connexion (download all).
  - Animation.
  - Drive sync.
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

## 6. Synchronisation (Google Drive)
- `drive.appdata` scope (hidden app folder in **each user's own Drive**). Merge is last-writer-wins per row, with tombstones for deletions.
- Nicolas's Google Cloud project "PTCGP Collection". OAuth client ID (public) is hardcoded in `src/lib/sync/gis.ts`:
  `1041120278633-rduag2vvlt9tee2pf50v0eqc1gpdie7o.apps.googleusercontent.com`.
- The consent screen is in **Testing** mode. Friends must be added as test users in Google Cloud Console.

## 7. Pipelines (GitHub Actions)
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
  - Checks for new expansions: daily at 06:15 UTC, and hourly in the window [release, release + 3 days].
  - Sources: flibustier dataset (`pokemon-tcg-pocket-database`, cards, pull rates, entityIds) plus TCGdex for French names.
  - Opens a PR `auto/new-sets-<date>`. This needs the repo setting "Allow GitHub Actions to create and approve pull requests".
- **`android-apk.yml`** (manual, 2026-11-05): wraps the PWA as a TWA with `@bubblewrap/core` (`android/build-apk.mjs`, package `io.github.camelbaggy.ptcgp`, minSdk 24), builds with the runner's SDK, signs with secrets `ANDROID_KEYSTORE_B64` / `ANDROID_KEYSTORE_PASSWORD` (alias `ptcgp`; throwaway key if absent), attaches the APK to Release `v<version>`. Keystore kept in project files `ptcgp-app/android-prive/` (never in the repo); cert SHA256 `1C:72:73:FF:…:20:8B`. Full-screen TWA needs `https://camelbaggy.github.io/.well-known/assetlinks.json` (user-site repo `Camelbaggy.github.io`), else a small URL bar shows.
- **`update-pokedex.yml`:** Mondays 06:30 UTC. Rebuilds `pokedex.json`, for example for gen 10, and opens a PR if it changed.

## 8. Known issues and ideas
- **Data:**
  - Checked 2026-11-05 against flibustier: every set is complete. Deluxe sets (A4b 165/379, B4b 193/429) and A1a-63 only look short because non-shiny reprints are stored once, as the original card (same image) with the deluxe booster added to its `boosterIds`; only the « Brillante » versions get their own ids. Consequence: the video import cannot align a deluxe set's exchange screen (its order uses A4b numbers).
  - Some FR/EN name mismatches in cards.json: Mantyke/Amonita, Omanyte/Amonistar, Ultra Necrozma FR "Bulbizarre".
  - Corrupted names such as "Électriquetek".
  - Not yet reported to Nicolas.
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
  - `docs/legacy-logic.md`: the sheet's calculation logic.
  - `docs/public-sources.md`: data sources.
  - `docs/meta.md`: tier-list score.
  - `docs/questions.md`: past UI choices.
