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
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
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
    private val autoStop = Runnable { endSession("inactivite") }

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
                if (active) scheduleCapture(3000L) else stopSelf()
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
            val dpi = resources.displayMetrics.densityDpi
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
        resetAutoStop()
        HoloLog.add("capture programmee dans $delayMs ms")
        h.postDelayed({ tryCapture(0L) }, delayMs.coerceAtLeast(0L))
    }

    private fun tryCapture(waited: Long) {
        if (ended) return
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

    private fun buildNotification(): Notification {
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
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentTitle("Holothèque lit l'écran")
            .setContentText("Touchez « Capturer » puis revenez au jeu")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentPi)
            .addAction(0, "Capturer dans 3 s", capturePi)
            .addAction(0, "Arrêter", stopPi)
            .build()
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
