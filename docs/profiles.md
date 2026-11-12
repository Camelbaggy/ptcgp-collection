# Plusieurs profils (lot F8)

But : plusieurs membres du foyer suivent chacun leur collection sur le même appareil (autorisation DeNA : foyer, consentement explicite).

## Principe : une base IndexedDB par profil, changement = rechargement

- Le profil **principal** garde exactement la base actuelle `ptcgp` et les clés `localStorage` actuelles. **Aucune migration de données** : rien n'est copié ni renommé, donc aucune perte possible pour le profil existant.
- Chaque nouveau profil a sa propre base `ptcgp-p-<id>` (même schéma Dexie, données de référence chargées depuis `public/data` comme une première installation).
- Le registre des profils est un état d'appareil : `ptcgp.profiles` (liste `{id, name, color, createdAt}`) et `ptcgp.profile.active`. Sans registre, il n'y a que le profil principal (comportement d'aujourd'hui).
- Changer de profil écrit `ptcgp.profile.active` puis **recharge la page**. Tout ce qui vit au niveau du module (`db`, `DataProvider`, moteur de synchro, jeton Google en mémoire, lectures automatiques) repart proprement sur la bonne base, sans risque de mélanger deux collections en mémoire.

## Réglages (`lib/storage.ts`)

- Préférences d'affichage `ptcgp:*` (thème, filtres, onglets) : **communes à l'appareil**.
- Quelques préférences liées à la collection sont **par profil** : `welcome.dismissed`, `pz.massOff`. Clé `ptcgp:p.<id>.<nom>` pour un profil secondaire ; clé inchangée pour le principal.
- État d'appareil `ptcgp.*` lié au compte de synchro : **par profil** (`sync.enabled`, `sync.email`, `sync.last`) avec la même règle de nommage. `deviceId` reste commun (identifie l'appareil, pas la personne).

## Synchro Google Drive

- Profil principal : fichier `ptcgp-sync.json` (inchangé).
- Autre profil : fichier `ptcgp-sync-<id>.json`, dans l'`appDataFolder` du compte Google choisi pour ce profil (le sien, ou celui d'un parent : les deux marchent, chaque profil a son propre fichier).
- L'instantané porte `profile: {id, name, color}`. Sur un second appareil connecté, « Retrouver les profils sur Drive » liste les fichiers `ptcgp-sync-*.json` et recrée les profils avec le même id ; la synchro fait le reste.

## Instantanés Pokémon-Zone, tier list, évènements

- `pz.home`, `pz.stats`, `pz.themed` sont dans `meta`, donc **par profil** naturellement (chacun a son compte Pokémon-Zone).
- La fenêtre Pokémon-Zone de l'appli Android partage ses cookies entre profils : il faut se connecter au compte Pokémon-Zone du membre avant une synchro. L'écran de synchro rappelle le profil actif.
- Tier list PocketMads et évènements : communs en réalité, mais stockés par base. À la création d'un profil, ils sont **copiés** depuis le profil courant (pas d'écran vide), puis les lectures automatiques habituelles les tiennent à jour.

## Sauvegardes

- L'export concerne le profil actif ; le nom du fichier inclut le nom du profil (`holotheque-lea-2026-11-12.json`).
- L'import remplace le profil actif seulement (copie de secours automatique conservée).

## Suppression

- Un profil secondaire peut être supprimé (confirmation, base effacée avec `Dexie.delete`, clés locales retirées, fichier Drive conservé). Le principal ne peut pas être supprimé, seulement renommé.

## Interface (option A choisie par Nicolas le 2026-11-12)

- Pastille du profil actif en haut à droite de l'accueil (mobile) et sous le logo de la barre latérale (ordinateur) : ouvre la feuille « Qui joue ? » (`features/profiles/ProfileSheet.tsx`), un appui change de profil.
- Page `#/profils` (« Profils du foyer » dans Plus) : renommer, couleur, supprimer, ajouter, « Retrouver les profils sur Google Drive ».
- L'accueil dit « Bonjour <nom> ! » dès que le profil a un nom (le principal s'appelle « Moi » par défaut).

## Code

- `lib/profiles.ts` : registre, profil actif, noms de base/fichier/clés (pur, testé).
- `lib/profileOps.ts` : création (recopie évènements + tier list), résumé, suppression, changement.
- `lib/sync/profiles.ts` : `recoverProfilesFromDrive`. `sync/drive.ts` `listProfileFiles`.
- `db/schema.ts` : `new PtcgpDB(dbNameFor(activeProfileId()))`.
- Limite connue : « Se déconnecter » de la synchro révoque l'accès Google de l'appli ; les autres profils liés au même compte demanderont de se reconnecter.

## Tests

- Registre : sans registre ⇒ un seul profil principal, base `ptcgp`, clés inchangées (non-régression de l'existant).
- Données écrites dans la base `ptcgp` avant la fonctionnalité restent lisibles après (base inchangée).
- Isolation : une carte ajoutée dans un profil n'apparaît pas dans l'autre.
- Clés locales et nom du fichier Drive par profil.
- Suppression : base et clés retirées, principal non supprimable.
