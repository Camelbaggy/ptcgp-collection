package io.github.camelbaggy.holonative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.DisplayMetrics
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** Pont service -> plugin (le plugin s'y abonne quand la WebView est là). */
object HoloEvents {
    @Volatile
    var onCaptureTaken: ((CaptureRecord) -> Unit)? = null

    @Volatile
    var onRecordingStopped: ((RecordingRecord) -> Unit)? = null

    @Volatile
    var onSessionEnded: ((String) -> Unit)? = null

    /** Appelé une fois (ok, message d'erreur) à la fin de l'initialisation de la session. */
    @Volatile
    var onSessionReady: ((Boolean, String?) -> Unit)? = null
}

/** Service de premier plan qui garde la session MediaProjection, un VirtualDisplay et un ImageReader. */
class CaptureService : Service() {

    companion object {
        const val ACTION_START = "io.github.camelbaggy.holonative.START"
        const val ACTION_CAPTURE = "io.github.camelbaggy.holonative.CAPTURE"
        const val ACTION_STOP = "io.github.camelbaggy.holonative.STOP"
        const val EXTRA_RESULT_CODE = "resultCode"
        const val EXTRA_RESULT_DATA = "resultData"
        private const val CHANNEL_ID = "holo_capture"
        private const val NOTIFICATION_ID = 4201
        private const val AUTO_STOP_MS = 15L * 60L * 1000L
        private const val FRAME_RETRY_MS = 1000L
        private const val FRAME_RETRY_STEP_MS = 100L
        private const val MAX_RECORDING_MS = 3L * 60L * 1000L
        private const val DEFAULT_RECORDING_WIDTH = 720
        private const val RECORDING_FPS = 30
        private const val RECORDING_BITRATE = 6_000_000
        const val ACTION_STOP_RECORDING = "io.github.camelbaggy.holonative.STOP_RECORDING"

        @Volatile
        var active: Boolean = false
            private set

        @Volatile
        private var instance: CaptureService? = null

        /** Programme une capture si une session est active. */
        fun schedule(delayMs: Long): Boolean {
            val s = instance ?: return false
            s.scheduleCapture(delayMs)
            return true
        }

        /** Vrai pendant l'attente du delai ou l'enregistrement lui-meme (captures impossibles). */
        val busyRecording: Boolean
            get() = instance?.let { it.recorder != null || it.recordingPending } ?: false

        val recording: Boolean
            get() = instance?.let { it.recorder != null } ?: false

        /** Programme un enregistrement ; renvoie un message d'erreur, ou null si c'est programme. */
        fun scheduleRecording(delayMs: Long, maxWidth: Int): String? {
            val s = instance ?: return "Lance d'abord la capture"
            return s.requestRecording(delayMs, maxWidth)
        }

        /** Arrete l'enregistrement (ou annule son depart) de facon synchrone ; faux si rien a arreter. */
        fun stopRecording(reason: String): Boolean {
            val s = instance ?: return false
            return s.stopRecordingNow(reason)
        }

        fun stopSession(reason: String) {
            instance?.endSession(reason)
        }
    }

    private var projection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var reader: ImageReader? = null
    private var width = 0
    private var height = 0
    private var ended = false
    private var thread: HandlerThread? = null
    private var handler: Handler? = null
    private var dpi = 0
    private val recLock = Any()
    private var recorder: MediaRecorder? = null
    private var recordingPending = false
    private var recId = ""
    private var recFile: File? = null
    private var recW = 0
    private var recH = 0
    private var recStartedAt = 0L
    private var recStartedWall = 0L
    private var recStart: Runnable? = null
    private val recAutoStop = Runnable { stopRecordingNow("duree maximale") }
    private val autoStop = Runnable {
        // Pas d'arret pour inactivite pendant un enregistrement.
        if (recorder != null || recordingPending) resetAutoStop() else endSession("inactivite")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        HoloLog.init(this)
        val t = HandlerThread("holo-capture")
        t.start()
        thread = t
        handler = Handler(t.looper)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startSession(intent)
            ACTION_CAPTURE -> {
                if (active) {
                    if (busyRecording) HoloLog.add("capture ignoree : enregistrement en cours")
                    else scheduleCapture(3000L)
                } else stopSelf()
            }
            ACTION_STOP_RECORDING -> {
                if (active) handler?.post { stopRecordingNow("notification") } else stopSelf()
            }
            ACTION_STOP -> {
                if (active) endSession("arret") else stopSelf()
            }
            else -> if (!active) stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun startSession(intent: Intent) {
        try {
            createChannel()
            val notification = buildNotification()
            // Obligatoire avant getMediaProjection (Android 14+).
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
            )
            HoloLog.add("service au premier plan")
            val code = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
            @Suppress("DEPRECATION")
            val data: Intent? = intent.getParcelableExtra(EXTRA_RESULT_DATA)
            if (data == null) throw IllegalStateException("autorisation de capture absente")
            val mgr = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val p = mgr.getMediaProjection(code, data)
                ?: throw IllegalStateException("MediaProjection indisponible")
            projection = p
            // Le rappel doit etre enregistre avant de creer le VirtualDisplay (Android 14+).
            p.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    HoloLog.add("MediaProjection arretee par le systeme")
                    endSession("systeme")
                }
            }, handler)
            computeSize()
            dpi = resources.displayMetrics.densityDpi
            val r = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
            reader = r
            virtualDisplay = p.createVirtualDisplay(
                "HolothequeCapture",
                width,
                height,
                dpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                r.surface,
                null,
                handler,
            )
            active = true
            instance = this
            ended = false
            resetAutoStop()
            HoloLog.add("session de capture demarree ${width}x$height dpi=$dpi")
            HoloEvents.onSessionReady?.invoke(true, null)
        } catch (e: Exception) {
            HoloLog.error("demarrage de la session de capture", e)
            ended = true
            HoloEvents.onSessionReady?.invoke(false, "Impossible de démarrer la capture d'écran.")
            cleanup()
            stopForegroundCompat()
            stopSelf()
        }
    }

    private fun computeSize() {
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val b = wm.currentWindowMetrics.bounds
            width = b.width()
            height = b.height()
        } else {
            val m = DisplayMetrics()
            @Suppress("DEPRECATION")
            wm.defaultDisplay.getRealMetrics(m)
            width = m.widthPixels
            height = m.heightPixels
        }
        if (width <= 0 || height <= 0) {
            val m = resources.displayMetrics
            width = m.widthPixels
            height = m.heightPixels
        }
        HoloLog.add("taille d'ecran ${width}x$height")
    }

    private fun resetAutoStop() {
        handler?.removeCallbacks(autoStop)
        handler?.postDelayed(autoStop, AUTO_STOP_MS)
    }

    fun scheduleCapture(delayMs: Long) {
        val h = handler ?: return
        if (busyRecording) {
            HoloLog.add("capture refusee : enregistrement en cours")
            return
        }
        resetAutoStop()
        HoloLog.add("capture programmee dans $delayMs ms")
        h.postDelayed({ tryCapture(0L) }, delayMs.coerceAtLeast(0L))
    }

    private fun tryCapture(waited: Long) {
        if (ended) return
        if (busyRecording) {
            HoloLog.add("capture annulee : enregistrement en cours")
            return
        }
        try {
            val r = reader ?: return
            val image = r.acquireLatestImage()
            if (image == null) {
                if (waited < FRAME_RETRY_MS) {
                    handler?.postDelayed({ tryCapture(waited + FRAME_RETRY_STEP_MS) }, FRAME_RETRY_STEP_MS)
                } else {
                    HoloLog.add("ERREUR aucune image disponible apres 1 s")
                }
                return
            }
            try {
                val plane = image.planes[0]
                val buffer = plane.buffer
                val pixelStride = plane.pixelStride
                val rowPadding = plane.rowStride - pixelStride * image.width
                val w = image.width
                val h = image.height
                val padded = Bitmap.createBitmap(w + rowPadding / pixelStride, h, Bitmap.Config.ARGB_8888)
                padded.copyPixelsFromBuffer(buffer)
                val bmp = if (padded.width != w) Bitmap.createBitmap(padded, 0, 0, w, h) else padded
                val black = isBlack(bmp)
                val id = UUID.randomUUID().toString()
                val file = File(CaptureStore.captureDir(this), "$id.png")
                FileOutputStream(file).use { out -> bmp.compress(Bitmap.CompressFormat.PNG, 100, out) }
                if (bmp !== padded) bmp.recycle()
                padded.recycle()
                val rec = CaptureRecord(id, System.currentTimeMillis(), w, h, file.absolutePath, black)
                CaptureStore.add(this, rec)
                HoloLog.add("capture ecrite $id ${w}x$h ${file.length() / 1024} Ko")
                if (black) HoloLog.add("ecran noir detecte (contenu protege ?)")
                vibrate()
                resetAutoStop()
                HoloEvents.onCaptureTaken?.invoke(rec)
            } finally {
                image.close()
            }
        } catch (e: Exception) {
            HoloLog.error("capture d'ecran", e)
        }
    }

    private fun isBlack(bmp: Bitmap): Boolean {
        val steps = 48
        var dark = 0
        var total = 0
        for (iy in 0 until steps) {
            val y = ((iy + 0.5) * bmp.height / steps).toInt().coerceIn(0, bmp.height - 1)
            for (ix in 0 until steps) {
                val x = ((ix + 0.5) * bmp.width / steps).toInt().coerceIn(0, bmp.width - 1)
                val p = bmp.getPixel(x, y)
                val lum = (((p shr 16) and 0xFF) * 299 + ((p shr 8) and 0xFF) * 587 + (p and 0xFF) * 114) / 1000
                total++
                if (lum < 10) dark++
            }
        }
        return total > 0 && dark.toDouble() / total > 0.98
    }

    private fun vibrate() {
        try {
            val v: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            if (v == null || !v.hasVibrator()) return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(150L, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(150L)
            }
        } catch (e: Exception) {
            HoloLog.error("vibration", e)
        }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(CHANNEL_ID, "Capture d'écran", NotificationManager.IMPORTANCE_LOW)
            nm.createNotificationChannel(ch)
        }
    }

    private fun buildNotification(extraText: String? = null): Notification {
        val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        val open = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val contentPi = if (open != null) PendingIntent.getActivity(this, 0, open, flags) else null
        val capturePi = PendingIntent.getService(
            this, 1, Intent(this, CaptureService::class.java).setAction(ACTION_CAPTURE), flags,
        )
        val stopPi = PendingIntent.getService(
            this, 2, Intent(this, CaptureService::class.java).setAction(ACTION_STOP), flags,
        )
        val stopRecPi = PendingIntent.getService(
            this, 3, Intent(this, CaptureService::class.java).setAction(ACTION_STOP_RECORDING), flags,
        )
        val isRec = recorder != null
        val text = extraText
            ?: if (isRec) "Enregistrement en cours : fais défiler, puis Arrêter"
            else "Touchez « Capturer » puis revenez au jeu"
        val b = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentTitle("Holothèque lit l'écran")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentPi)
        if (isRec) {
            b.addAction(0, "Arrêter l'enregistrement", stopRecPi)
        } else {
            b.addAction(0, "Capturer dans 3 s", capturePi)
        }
        b.addAction(0, "Arrêter", stopPi)
        return b.build()
    }

    private fun refreshNotification(extraText: String? = null) {
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIFICATION_ID, buildNotification(extraText))
        } catch (e: Exception) {
            HoloLog.error("mise a jour de la notification", e)
        }
    }

    // ------------------------------------------------------------ Enregistrement

    private fun requestRecording(delayMs: Long, maxWidth: Int): String? {
        val h = handler ?: return "Lance d'abord la capture"
        synchronized(recLock) {
            if (recorder != null || recordingPending) return "Un enregistrement est déjà en cours."
            recordingPending = true
        }
        resetAutoStop()
        HoloLog.add("enregistrement programme dans $delayMs ms (largeur max $maxWidth)")
        val r = Runnable { startRecordingNow(maxWidth) }
        recStart = r
        h.postDelayed(r, delayMs.coerceAtLeast(0L))
        return null
    }

    private fun even16(v: Int): Int = ((v / 16) * 16).coerceAtLeast(16)

    private fun startRecordingNow(maxWidth: Int) {
        synchronized(recLock) {
            if (!recordingPending || ended) {
                recordingPending = false
                return
            }
            val vd = virtualDisplay
            val rd = reader
            if (vd == null || rd == null) {
                recordingPending = false
                HoloLog.add("ERREUR enregistrement : pas de session")
                return
            }
            var w = width
            var h = height
            val limit = if (maxWidth >= 16) maxWidth else DEFAULT_RECORDING_WIDTH
            if (w > limit) {
                h = (h.toLong() * limit / w).toInt()
                w = limit
            }
            w = even16(w)
            h = even16(h)
            val id = UUID.randomUUID().toString()
            val file = File(RecordingStore.recordingDir(this), "$id.mp4")
            var rec: MediaRecorder? = null
            var displayMoved = false
            try {
                rec = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    MediaRecorder(this)
                } else {
                    @Suppress("DEPRECATION")
                    MediaRecorder()
                }
                rec.setVideoSource(MediaRecorder.VideoSource.SURFACE)
                rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                rec.setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                rec.setVideoSize(w, h)
                rec.setVideoFrameRate(RECORDING_FPS)
                rec.setVideoEncodingBitRate(RECORDING_BITRATE)
                rec.setOutputFile(file.absolutePath)
                rec.prepare()
                HoloLog.add("enregistreur pret ${w}x$h ${RECORDING_FPS} i/s")
                vd.resize(w, h, dpi)
                vd.setSurface(rec.surface)
                displayMoved = true
                rec.start()
                recorder = rec
                recId = id
                recFile = file
                recW = w
                recH = h
                recStartedAt = SystemClock.elapsedRealtime()
                recStartedWall = System.currentTimeMillis()
                recordingPending = false
                recStart = null
                handler?.removeCallbacks(recAutoStop)
                handler?.postDelayed(recAutoStop, MAX_RECORDING_MS)
                vibrate()
                refreshNotification()
                HoloLog.add("enregistrement demarre $id ${w}x$h")
            } catch (e: Exception) {
                HoloLog.error("demarrage de l'enregistrement", e)
                recordingPending = false
                recStart = null
                recorder = null
                if (displayMoved) restoreDisplay()
                try {
                    rec?.release()
                } catch (e2: Exception) {
                    HoloLog.error("liberation de l'enregistreur", e2)
                }
                try {
                    file.delete()
                } catch (e2: Exception) {
                    HoloLog.error("suppression du fichier video", e2)
                }
                refreshNotification("Enregistrement impossible sur cet appareil")
            }
        }
    }

    /** Remet le VirtualDisplay sur l'ImageReader, a sa taille d'origine. */
    private fun restoreDisplay() {
        try {
            val vd = virtualDisplay
            val rd = reader
            if (vd != null && rd != null) {
                vd.resize(width, height, dpi)
                vd.setSurface(rd.surface)
                try {
                    // Ecarte une image perimee de avant l'enregistrement.
                    rd.acquireLatestImage()?.close()
                } catch (e: Exception) {
                    HoloLog.error("purge de l'ImageReader", e)
                }
                HoloLog.add("affichage virtuel remis sur la capture ${width}x$height")
            }
        } catch (e: Exception) {
            HoloLog.error("restauration du VirtualDisplay", e)
        }
    }

    /** Arret synchrone. Renvoie faux si rien ne tournait. */
    private fun stopRecordingNow(reason: String): Boolean {
        synchronized(recLock) {
            if (recorder == null) {
                if (recordingPending) {
                    recordingPending = false
                    recStart?.let { handler?.removeCallbacks(it) }
                    recStart = null
                    HoloLog.add("depart d'enregistrement annule ($reason)")
                    return true
                }
                return false
            }
            return finishRecording(reason, true)
        }
    }

    /** A appeler sous recLock avec recorder != null. */
    private fun finishRecording(reason: String, restore: Boolean): Boolean {
        val rec = recorder ?: return false
        recorder = null
        handler?.removeCallbacks(recAutoStop)
        val id = recId
        val file = recFile
        val duration = SystemClock.elapsedRealtime() - recStartedAt
        HoloLog.add("arret de l'enregistrement $id ($reason) apres $duration ms")
        if (restore) restoreDisplay()
        var ok = true
        try {
            rec.stop()
        } catch (e: RuntimeException) {
            ok = false
            HoloLog.error("arret de l'enregistreur (trop court ?)", e)
        }
        try {
            rec.reset()
        } catch (e: Exception) {
            HoloLog.error("reinitialisation de l'enregistreur", e)
        }
        try {
            rec.release()
        } catch (e: Exception) {
            HoloLog.error("liberation de l'enregistreur", e)
        }
        recFile = null
        resetAutoStop()
        if (!ok || file == null || !file.exists() || file.length() <= 0L) {
            try {
                file?.delete()
            } catch (e: Exception) {
                HoloLog.error("suppression de la video invalide", e)
            }
            if (!ended) refreshNotification("Enregistrement trop court ou impossible : recommence")
            return true
        }
        val item = RecordingRecord(id, recStartedWall, duration, recW, recH, file.absolutePath)
        RecordingStore.add(this, item)
        HoloLog.add("video ecrite $id ${recW}x$recH ${file.length() / 1024} Ko")
        vibrate()
        if (!ended) refreshNotification()
        Handler(Looper.getMainLooper()).post { HoloEvents.onRecordingStopped?.invoke(item) }
        return true
    }

    private fun stopForegroundCompat() {
        try {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        } catch (e: Exception) {
            HoloLog.error("arret du premier plan", e)
        }
    }

    private fun cleanup() {
        try {
            virtualDisplay?.release()
        } catch (e: Exception) {
            HoloLog.error("liberation du VirtualDisplay", e)
        }
        virtualDisplay = null
        try {
            reader?.close()
        } catch (e: Exception) {
            HoloLog.error("fermeture de l'ImageReader", e)
        }
        reader = null
        val p = projection
        projection = null
        try {
            p?.stop()
        } catch (e: Exception) {
            HoloLog.error("arret de MediaProjection", e)
        }
    }

    fun endSession(reason: String) {
        if (ended) return
        synchronized(recLock) {
            recordingPending = false
            if (recorder != null) {
                try {
                    finishRecording("fin de session ($reason)", false)
                } catch (e: Exception) {
                    HoloLog.error("finalisation de la video en fin de session", e)
                }
            }
        }
        ended = true
        active = false
        instance = null
        handler?.removeCallbacksAndMessages(null)
        cleanup()
        stopForegroundCompat()
        HoloLog.add("session de capture terminee ($reason)")
        // Notification sur le thread principal pour rester simple pour le plugin.
        Handler(Looper.getMainLooper()).post { HoloEvents.onSessionEnded?.invoke(reason) }
        stopSelf()
    }

    override fun onDestroy() {
        if (!ended) {
            synchronized(recLock) {
                if (recorder != null) {
                    try {
                        finishRecording("service detruit", false)
                    } catch (e: Exception) {
                        HoloLog.error("finalisation de la video", e)
                    }
                }
            }
            ended = true
            active = false
            instance = null
            cleanup()
        }
        thread?.quitSafely()
        thread = null
        super.onDestroy()
    }
}
