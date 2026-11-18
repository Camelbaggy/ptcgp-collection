package io.github.camelbaggy.holonative

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.text.SpannableString
import android.text.Spanned
import android.text.style.RelativeSizeSpan
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.text.NumberFormat
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Données partagées des widgets d'écran d'accueil (lot F11) : le résumé envoyé par l'appli
 * (`src/lib/widget/summary.ts`, via `HoloNative.widgetUpdate`), les images des packs conseillés
 * (téléchargées une fois depuis le site publié) et les liens d'ouverture de l'appli.
 */
object WidgetData {
    private const val PREFS = "holo_widget"
    private const val KEY_SUMMARY = "summary"
    private const val SITE = "https://camelbaggy.github.io/ptcgp-collection/"
    private const val PACK_MAX_H = 200

    /** Tous les widgets proposés (Android les liste séparément ; Nicolas choisit lequel poser). */
    val PROVIDERS = listOf(
        HoloWidget::class.java,
        HoloWidgetCollection::class.java,
        HoloWidgetBooster::class.java,
        HoloWidgetLarge::class.java,
    )

    private val io = Executors.newSingleThreadExecutor()
    val fr: Locale = Locale.FRANCE

    /** Enregistre le résumé, redessine les widgets et télécharge les images de pack manquantes. */
    fun save(context: Context, summary: String) {
        val json = JSONObject(summary) // refuse un JSON invalide avant de l'enregistrer
        val app = context.applicationContext
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_SUMMARY, summary).apply()
        refresh(app)
        val urls = mutableListOf<String>()
        val arr = json.optJSONArray("boosters")
        if (arr != null) for (i in 0 until arr.length()) arr.optJSONObject(i)?.optString("image")?.takeIf { it.isNotEmpty() }?.let { urls.add(it) }
        io.execute { syncImages(app, urls) }
    }

    fun load(context: Context): JSONObject? = try {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SUMMARY, null)?.let { JSONObject(it) }
    } catch (_: Exception) { null }

    fun refresh(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        for (cls in PROVIDERS) {
            val ids = manager.getAppWidgetIds(ComponentName(context, cls))
            if (ids.isEmpty()) continue
            val provider = cls.getDeclaredConstructor().newInstance()
            for (id in ids) provider.render(context, manager, id)
        }
    }

    private fun dir(context: Context) = File(context.filesDir, "holo-widget")
    private fun fileFor(context: Context, url: String) = File(dir(context), "pack-${Integer.toHexString(url.hashCode())}.png")

    /** Image du pack déjà téléchargée, ou null. */
    fun packBitmap(context: Context, url: String?): Bitmap? {
        if (url.isNullOrEmpty()) return null
        val f = fileFor(context, url)
        return if (f.exists()) BitmapFactory.decodeFile(f.path) else null
    }

    private fun syncImages(context: Context, urls: List<String>) {
        val keep = urls.map { fileFor(context, it).name }.toSet()
        dir(context).listFiles()?.forEach { if (it.name !in keep) it.delete() }
        var changed = false
        for (url in urls) {
            val f = fileFor(context, url)
            if (f.exists()) continue
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 15_000
                conn.readTimeout = 20_000
                val decoded: Bitmap? = try {
                    conn.inputStream.use { BitmapFactory.decodeStream(it) }
                } finally {
                    conn.disconnect()
                }
                val raw = decoded ?: throw IllegalStateException("image illisible")
                val h = minOf(PACK_MAX_H, raw.height)
                val w = maxOf(1, raw.width * h / raw.height)
                val bmp = if (h == raw.height) raw else Bitmap.createScaledBitmap(raw, w, h, true)
                f.parentFile?.mkdirs()
                FileOutputStream(f).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
                changed = true
            } catch (e: Exception) {
                HoloLog.add("widget : image du pack non téléchargée (${e.message})")
            }
        }
        if (changed) refresh(context)
    }

    /** Ouvre l'appli (accueil) ou un écran précis par un lien du site (reçu comme App Link, `hashFromDeepLink`). */
    fun open(context: Context, hash: String?, code: Int): PendingIntent {
        val intent = if (hash == null) {
            context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
        } else {
            Intent(Intent.ACTION_VIEW, Uri.parse(SITE + hash)).setPackage(context.packageName)
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun int(n: Int): String = NumberFormat.getIntegerInstance(fr).format(n)

    /** « 78,4 % » avec le signe % plus petit. */
    fun bigPct(pct: Double, decimals: Int = 1, ratio: Float = 0.5f): CharSequence {
        val t = String.format(fr, "%.${decimals}f", pct * 100)
        val s = SpannableString("$t %")
        s.setSpan(RelativeSizeSpan(ratio), t.length, s.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        return s
    }

    fun pct(p: Double): String = String.format(fr, "%.1f %%", p * 100)

    fun setPack(context: Context, v: RemoteViews, viewId: Int, url: String?) {
        val bmp = packBitmap(context, url)
        if (bmp != null) v.setImageViewBitmap(viewId, bmp) else v.setImageViewResource(viewId, R.drawable.holo_widget_pack)
    }
}
