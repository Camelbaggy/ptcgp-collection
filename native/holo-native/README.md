# holo-native

Plugin Capacitor (Android uniquement) de l'Holothèque. Le contrat côté web est dans `src/lib/native/holoNative.ts`.

Aucun accès au jeu ni au compte Nintendo : on lit seulement l'écran du téléphone, avec l'accord explicite de l'utilisateur (fenêtre système Android à chaque session).

## Méthodes

- `startCaptureSession()` : demande l'autorisation de capture, démarre le service de premier plan (notification « Holothèque lit l'écran »).
- `scheduleCapture({delayMs})` : capture après un délai ; le téléphone vibre. Aussi déclenchable depuis la notification (« Capturer dans 3 s »).
- `takeCaptures()` / `deleteCapture({id})` / `captureStatus()` / `stopCaptureSession()`.
- Événements : `captureTaken`, `captureSessionEnded`.
- `startRecording({delayMs, maxWidth?})` : enregistre l'écran en MP4 (H.264, sans son, 30 i/s, ~6 Mb/s, largeur max 720 par défaut, dimensions multiples de 16) dans la session de capture déjà ouverte (sinon « Lance d'abord la capture »). Le même VirtualDisplay est basculé sur la surface du `MediaRecorder` (resize + setSurface), puis remis sur l'ImageReader à l'arrêt. Pendant l'enregistrement les captures sont refusées et la notification propose « Arrêter l'enregistrement ». Arrêt automatique après 3 min ; si la projection s'arrête, la vidéo est finalisée si possible. Fichiers : `cacheDir/recordings/<id>.mp4`.
- `stopRecording()` / `recordingStatus()` (`{recording, pending}`) / `takeRecordings()` / `deleteRecording({id})`. Événement : `recordingStopped {id, durationMs}`. Une vidéo trop courte (arrêt avant la première image) est supprimée et signalée dans la notification.
- `googleAuthorize({scopes, interactive})` / `googleSignOut()` : autorisation Google native (Drive). Aucun identifiant client dans le code : Google associe l'appli par nom de paquet et empreinte SHA-1 de signature.
- `getLog()` / `clearLog()` / `log({message})` : journal de diagnostic (300 dernières lignes).
- `widgetUpdate({summary})` : enregistre le résumé JSON du widget d'écran d'accueil (`WidgetData.kt`, `SharedPreferences` `holo_widget`) et redessine les 4 widgets (`HoloWidget.kt`) ; les images des 3 boosters conseillés sont téléchargées une fois (`filesDir/holo-widget/`, 200 px de haut).

La session s'arrête seule après 15 min sans capture (jamais pendant un enregistrement).

## Lire une vidéo dans la WebView

`Capacitor.convertFileSrc(path)` donne une URL du serveur local de Capacitor (`/_capacitor_file_/...`). Ce serveur répond 206 aux requêtes `Range` mais renvoie le flux depuis l'octet 0 sans sauter au début demandé : le déplacement (seek) dans un `<video src=url>` est donc peu fiable. Il faut charger le fichier en `Blob` (`fetch(url)` sans `Range`, comme `captureBlob`) puis `URL.createObjectURL(blob)` pour la balise `<video>`.

## Permissions Android

`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PROJECTION`, `POST_NOTIFICATIONS` (demandée à l'exécution, refus non bloquant), `VIBRATE`.
