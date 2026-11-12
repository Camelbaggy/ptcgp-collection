package io.github.camelbaggy.holonative

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.text.SpannableString
import android.text.Spanned
import android.text.style.RelativeSizeSpan
import android.view.View
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
 * Widget d'écran d'accueil (lot F11) : % de collection et booster à ouvrir en premier.
 * L'appli calcule le résumé (`src/lib/widget/summary.ts`) et l'envoie par `HoloNative.widgetUpdate` ;
 * le widget ne fait qu'afficher la dernière version enregistrée. L'image du pack est téléchargée une fois
 * depuis le site publié et gardée dans les fichiers de l'appli.
 */
class HoloWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) render(context, manager, id)
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
        render(context, manager, id)
    }

    companion object {
        private const val PREFS = "holo_widget"
        private const val KEY_SUMMARY = "summary"
        private const val KEY_IMAGE_URL = "imageUrl"
        private const val SITE = "https://camelbaggy.github.io/ptcgp-collection/"
        /** En dessous (largeur en dp), mise en page compacte. */
        private const val SMALL_MAX_DP = 250
        private const val PACK_MAX_H = 200

        private val io = Executors.newSingleThreadExecutor()
        private val fr: Locale = Locale.FRANCE

        /** Enregistre le résumé envoyé par l'appli, redessine les widgets et télécharge l'image du pack si elle a changé. */
        fun save(context: Context, summary: String) {
            val json = JSONObject(summary) // refuse un JSON invalide avant de l'enregistrer
            val app = context.applicationContext
            app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_SUMMARY, summary).apply()
            refresh(app)
            val url = json.optJSONArray("boosters")?.optJSONObject(0)?.optString("image").orEmpty()
            if (url.isNotEmpty() && url != prefs(app).getString(KEY_IMAGE_URL, null)) io.execute { download(app, url) }
        }

        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, HoloWidget::class.java))
            for (id in ids) render(context, manager, id)
        }

        private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        private fun packFile(context: Context) = File(File(context.filesDir, "holo-widget"), "pack.png")

        private fun download(context: Context, url: String) {
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 15_000
                conn.readTimeout = 20_000
                val raw = conn.inputStream.use { BitmapFactory.decodeStream(it) } ?: throw IllegalStateException("image illisible")
                conn.disconnect()
                val h = minOf(PACK_MAX_H, raw.height)
                val w = maxOf(1, raw.width * h / raw.height)
                val bmp = if (h == raw.height) raw else Bitmap.createScaledBitmap(raw, w, h, true)
                val f = packFile(context)
                f.parentFile?.mkdirs()
                FileOutputStream(f).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
                prefs(context).edit().putString(KEY_IMAGE_URL, url).apply()
                refresh(context)
            } catch (e: Exception) {
                HoloLog.add("widget : image du pack non téléchargée (${e.message})")
            }
        }

        private fun open(context: Context, hash: String?, code: Int): PendingIntent {
            val intent = if (hash == null) {
                context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
            } else {
                // lien du site : l'appli le reçoit comme un App Link (appUrlOpen / getLaunchUrl → hashFromDeepLink)
                Intent(Intent.ACTION_VIEW, Uri.parse(SITE + hash)).setPackage(context.packageName)
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        private fun render(context: Context, manager: AppWidgetManager, id: Int) {
            val minW = manager.getAppWidgetOptions(id)?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
            val small = minW in 1 until SMALL_MAX_DP
            val v = RemoteViews(context.packageName, if (small) R.layout.holo_widget_small else R.layout.holo_widget)
            v.setImageViewResource(R.id.holo_w_icon, context.applicationInfo.icon)
            v.setOnClickPendingIntent(R.id.holo_w_root, open(context, null, 1))
            if (!small) v.setOnClickPendingIntent(R.id.holo_w_add, open(context, "#/ajout", 2))

            val s = try {
                prefs(context).getString(KEY_SUMMARY, null)?.let { JSONObject(it) }
            } catch (_: Exception) { null }

            if (s == null) {
                if (!small) {
                    v.setViewVisibility(R.id.holo_w_body, View.GONE)
                    v.setViewVisibility(R.id.holo_w_empty, View.VISIBLE)
                }
                manager.updateAppWidget(id, v)
                return
            }

            val pct = s.optDouble("pct", 0.0)
            val owned = s.optInt("owned")
            val total = s.optInt("total")
            val nf = NumberFormat.getIntegerInstance(fr)
            val pctText = String.format(fr, "%.1f", pct * 100)
            val big = SpannableString("$pctText %")
            big.setSpan(RelativeSizeSpan(0.5f), pctText.length, big.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            v.setTextViewText(R.id.holo_w_pct, big)
            v.setProgressBar(R.id.holo_w_bar, 1000, (pct * 1000).toInt().coerceIn(0, 1000), false)

            val missing = total - owned
            val best = s.optJSONArray("boosters")?.optJSONObject(0)
            val pNew = best?.let { String.format(fr, "%.1f %%", it.optDouble("pNew") * 100) }

            if (small) {
                v.setTextViewText(R.id.holo_w_sub, "${nf.format(owned)} / ${nf.format(total)} cartes")
                v.setTextViewText(R.id.holo_w_booster, if (best != null) "${best.optString("label")} · $pNew" else "")
                v.setViewVisibility(R.id.holo_w_booster, if (best != null) View.VISIBLE else View.GONE)
            } else {
                v.setViewVisibility(R.id.holo_w_body, View.VISIBLE)
                v.setViewVisibility(R.id.holo_w_empty, View.GONE)
                v.setTextViewText(
                    R.id.holo_w_sub,
                    "${nf.format(owned)} / ${nf.format(total)} cartes\n" +
                        if (missing > 0) "${nf.format(missing)} à trouver" else "Collection complète !",
                )
                val hasBest = best != null
                v.setViewVisibility(R.id.holo_w_next, if (hasBest) View.VISIBLE else View.GONE)
                v.setViewVisibility(R.id.holo_w_divider, if (hasBest) View.VISIBLE else View.GONE)
                if (best != null) {
                    v.setTextViewText(R.id.holo_w_booster, best.optString("label"))
                    v.setTextViewText(R.id.holo_w_pnew, pNew)
                    val f = packFile(context)
                    val bmp = if (f.exists() && prefs(context).getString(KEY_IMAGE_URL, null) == best.optString("image")) {
                        BitmapFactory.decodeFile(f.path)
                    } else null
                    if (bmp != null) v.setImageViewBitmap(R.id.holo_w_pack, bmp) else v.setImageViewResource(R.id.holo_w_pack, R.drawable.holo_widget_pack)
                }
            }
            manager.updateAppWidget(id, v)
        }
    }
}
