# holo-native

Plugin Capacitor (Android uniquement) de l'Holothèque. Le contrat côté web est dans `src/lib/native/holoNative.ts`.

Aucun accès au jeu ni au compte Nintendo : on lit seulement l'écran du téléphone, avec l'accord explicite de l'utilisateur (fenêtre système Android à chaque session).

## Méthodes

- `startCaptureSession()` : demande l'autorisation de capture, démarre le service de premier plan (notification « Holothèque lit l'écran »).
- `scheduleCapture({delayMs})` : capture après un délai ; le téléphone vibre. Aussi déclenchable depuis la notification (« Capturer dans 3 s »).
- `takeCaptures()` / `deleteCapture({id})` / `captureStatus()` / `stopCaptureSession()`.
- Événements : `captureTaken`, `captureSessionEnded`.
- `googleAuthorize({scopes, interactive})` / `googleSignOut()` : autorisation Google native (Drive). Aucun identifiant client dans le code : Google associe l'appli par nom de paquet et empreinte SHA-1 de signature.
- `getLog()` / `clearLog()` / `log({message})` : journal de diagnostic (300 dernières lignes).

La session s'arrête seule après 15 min sans capture.

## Permissions Android

`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PROJECTION`, `POST_NOTIFICATIONS` (demandée à l'exécution, refus non bloquant), `VIBRATE`.
