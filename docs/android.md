# Appli Android (Capacitor)

L'Holothèque Android est la même appli web (PWA) emballée dans une coque **Capacitor 8**, avec un plugin natif local. Elle remplace l'ancienne version TWA/Bubblewrap, qui n'existe plus.

## Structure

| Élément | Rôle |
|---|---|
| `capacitor.config.ts` | `appId` `io.github.camelbaggy.ptcgp`, `webDir: dist`, schéma `https`, mise à jour manuelle (`CapacitorUpdater.autoUpdate: false`) |
| `android/` | Projet Gradle généré par Capacitor (minSdk 24, targetSdk 36) ; `MainActivity` est un simple `BridgeActivity` |
| `native/holo-native/` | Plugin Capacitor local en Kotlin : capture d'écran, enregistrement vidéo, WebView Pokémon-Zone / PocketMads, autorisation Google native, journal. Voir son `README.md` pour la liste des méthodes |
| `src/lib/native/` | Côté web : contrat du plugin (`holoNative.ts`), détection de plateforme et `REMOTE_BASE` (`platform.ts`), mises à jour (`appUpdate.ts`), démarrage (`boot.ts`), lectures automatiques (`autoReads.ts`), files de captures et d'enregistrements |

Dans l'APK, les images lourdes (cartes, boosters, sprites, objets, évènements) ne sont pas embarquées : l'appli les lit sur le site publié (`ASSET_BASE`). Logos, emblèmes et JSON de référence sont locaux.

## Ce que fait le plugin

- Lecture d'écran : une session de capture (fenêtre système Android à chaque session, notification « Holothèque lit l'écran »), captures différées et enregistrement MP4 (jusqu'à 3 min). Aucun accès au jeu ni au compte Nintendo.
- `PzWebView.kt` : fenêtre WebView limitée à `*.pokemon-zone.com` et `app.pocketmads.com`, sans interface JavaScript exposée ni changement d'agent utilisateur. Nicolas passe lui-même les contrôles de sécurité et la connexion ; les lectures automatiques s'arrêtent sans bruit sur un contrôle de sécurité.
- Autorisation Google (Drive) native, sans identifiant client dans le code : Google associe l'appli par nom de paquet et empreinte de signature.

## Notifications locales

Plugin officiel `@capacitor/local-notifications` (pas de code dans `holo-native`). Le web calcule le plan (`src/lib/notifications/plan.ts`) et le confie au plugin, qui le garde après un redémarrage du téléphone (`BOOT_COMPLETED`). Alarmes non exactes (`isExactNotification: false`) : aucune fenêtre « Alarmes et rappels », quelques minutes de décalage possibles. Canal Android « Rappels » ; petite icône `android/app/src/main/res/drawable/ic_stat_holo.xml`, couleur dans `capacitor.config.ts`. Un APK sans le plugin (1.5.0 et avant) affiche seulement une invitation à mettre à jour l'appli.

Toute nouvelle méthode native demande un nouvel APK ; `pzSyncSupported()` et ses équivalents détectent les APK trop anciens.

## Mises à jour sans nouvel APK

1. `deploy.yml` construit un second bundle (`VITE_TARGET=android`, `BASE_PATH=/`), le zippe en `app-bundle.zip` et écrit `app-version.json` : `{version (SHA court), url, date, checksum SHA-256}`.
2. `appUpdate.ts` lit `app-version.json` toutes les 30 min et au retour au premier plan, télécharge le zip avec `@capgo/capacitor-updater` (mode manuel), puis propose « Recharger ».
3. Garde-fous : checksum obligatoire, date antérieure au build embarqué ignorée, `notifyAppReady()` au démarrage (sinon le plugin revient au bundle précédent).

Les changements 100 % web (la grande majorité) arrivent donc sur le téléphone après un déploiement, sans APK.

## Publier un APK

Réservé au coordinateur / à Nicolas (règle du 2026-11-09 : un fil de travail ne lance jamais `android-apk.yml`).

1. Incrémenter `version` dans `package.json` (source unique, ex. 1.6.0), fusionner, puis Actions → « Android APK » → Run workflow avec `version_code` (entier, +1 à chaque APK).
2. Le workflow compile en Release, signe avec la clé du dépôt (secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, alias `ptcgp`) et publie `holotheque-<version>.apk` dans la Release `v<version>`.
3. Sur une pull request touchant `android/`, `native/`, `capacitor.config.ts` ou `package*.json`, le même workflow construit seulement un APK de test (artefact, clé jetable possible).

La clé de signature est conservée dans les fichiers du projet (`ptcgp-app/android-prive/`), jamais dans le dépôt. Si la clé change, l'appli installée ne peut plus être mise à jour par-dessus : désinstaller d'abord.

## Tests et limites

Le bac à sable n'a ni téléphone ni WebView réelle : la logique pure (files, plans, extracteurs) est testée avec Vitest, le reste (capture, vidéo, WebView Pokémon-Zone) doit être vérifié sur le téléphone de Nicolas.
