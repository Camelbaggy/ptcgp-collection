package io.github.camelbaggy.holonative

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * Widgets d'écran d'accueil (lot F11). Quatre widgets au choix dans la liste d'Android, qui affichent tous
 * le dernier résumé envoyé par l'appli (`WidgetData`) :
 * - `HoloWidget` (4 × 2, maquette B) : %, barre, booster à ouvrir en premier, bouton « Ajouter un pack » ;
 * - `HoloWidgetCollection` (2 × 2, maquette A) : anneau de complétion ;
 * - `HoloWidgetBooster` (2 × 2, maquette A) : booster à ouvrir en premier ;
 * - `HoloWidgetLarge` (4 × 3, maquette C) : %, % avec 2e copie et les 3 meilleurs boosters.
 */
abstract class HoloWidgetBase : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) render(context, manager, id)
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
        render(context, manager, id)
    }

    fun render(context: Context, manager: AppWidgetManager, id: Int) {
        val minW = manager.getAppWidgetOptions(id)?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
        val v = build(context, WidgetData.load(context), minW)
        v.setOnClickPendingIntent(R.id.holo_w_root, WidgetData.open(context, null, 1))
        manager.updateAppWidget(id, v)
    }

    /** `minW` : largeur actuelle en dp (0 si inconnue). */
    protected abstract fun build(context: Context, s: JSONObject?, minW: Int): RemoteViews

    protected fun best(s: JSONObject?, i: Int = 0): JSONObject? = s?.optJSONArray("boosters")?.optJSONObject(i)
}

/** Maquette B, avec une mise en page compacte sous 250 dp de large. */
class HoloWidget : HoloWidgetBase() {
    override fun build(context: Context, s: JSONObject?, minW: Int): RemoteViews {
        val small = minW in 1 until 250
        val v = RemoteViews(context.packageName, if (small) R.layout.holo_widget_small else R.layout.holo_widget)
        v.setImageViewResource(R.id.holo_w_icon, context.applicationInfo.icon)
        if (!small) v.setOnClickPendingIntent(R.id.holo_w_add, WidgetData.open(context, "#/ajout", 2))
        if (s == null) {
            if (!small) {
                v.setViewVisibility(R.id.holo_w_body, View.GONE)
                v.setViewVisibility(R.id.holo_w_empty, View.VISIBLE)
            }
            return v
        }
        val pct = s.optDouble("pct", 0.0)
        val owned = s.optInt("owned")
        val total = s.optInt("total")
        v.setTextViewText(R.id.holo_w_pct, WidgetData.bigPct(pct))
        v.setProgressBar(R.id.holo_w_bar, 1000, (pct * 1000).toInt().coerceIn(0, 1000), false)
        val b = best(s)
        if (small) {
            v.setTextViewText(R.id.holo_w_sub, "${WidgetData.int(owned)} / ${WidgetData.int(total)} cartes")
            v.setTextViewText(R.id.holo_w_booster, if (b != null) "${b.optString("label")} · ${WidgetData.pct(b.optDouble("pNew"))}" else "")
            v.setViewVisibility(R.id.holo_w_booster, if (b != null) View.VISIBLE else View.GONE)
            return v
        }
        v.setViewVisibility(R.id.holo_w_body, View.VISIBLE)
        v.setViewVisibility(R.id.holo_w_empty, View.GONE)
        val missing = total - owned
        v.setTextViewText(
            R.id.holo_w_sub,
            "${WidgetData.int(owned)} / ${WidgetData.int(total)} cartes\n" +
                if (missing > 0) "${WidgetData.int(missing)} à trouver" else "Collection complète !",
        )
        val vis = if (b != null) View.VISIBLE else View.GONE
        v.setViewVisibility(R.id.holo_w_next, vis)
        v.setViewVisibility(R.id.holo_w_divider, vis)
        if (b != null) {
            v.setTextViewText(R.id.holo_w_booster, b.optString("label"))
            v.setTextViewText(R.id.holo_w_pnew, WidgetData.pct(b.optDouble("pNew")))
            WidgetData.setPack(context, v, R.id.holo_w_pack, b.optString("image"))
        }
        return v
    }
}

/** Maquette A, premier petit widget : anneau de complétion. */
class HoloWidgetCollection : HoloWidgetBase() {
    override fun build(context: Context, s: JSONObject?, minW: Int): RemoteViews {
        val v = RemoteViews(context.packageName, R.layout.holo_widget_collection)
        if (s == null) return v
        val pct = s.optDouble("pct", 0.0)
        v.setTextViewText(R.id.holo_w_pct, WidgetData.bigPct(pct, 0, 0.7f))
        v.setProgressBar(R.id.holo_w_ring, 1000, (pct * 1000).toInt().coerceIn(0, 1000), false)
        v.setTextViewText(R.id.holo_w_sub, "${WidgetData.int(s.optInt("owned"))} / ${WidgetData.int(s.optInt("total"))} cartes")
        return v
    }
}

/** Maquette A, second petit widget : booster à ouvrir en premier. */
class HoloWidgetBooster : HoloWidgetBase() {
    override fun build(context: Context, s: JSONObject?, minW: Int): RemoteViews {
        val v = RemoteViews(context.packageName, R.layout.holo_widget_booster)
        val b = best(s) ?: run {
            v.setViewVisibility(R.id.holo_w_body, View.GONE)
            v.setViewVisibility(R.id.holo_w_empty, View.VISIBLE)
            if (s != null) v.setTextViewText(R.id.holo_w_empty, context.getString(R.string.holo_widget_none))
            return v
        }
        v.setViewVisibility(R.id.holo_w_body, View.VISIBLE)
        v.setViewVisibility(R.id.holo_w_empty, View.GONE)
        v.setTextViewText(R.id.holo_w_booster, b.optString("label"))
        v.setTextViewText(R.id.holo_w_pnew, "${WidgetData.pct(b.optDouble("pNew"))} nouvelle")
        WidgetData.setPack(context, v, R.id.holo_w_pack, b.optString("image"))
        return v
    }
}

/** Maquette C : %, % avec 2e copie et les 3 meilleurs boosters. */
class HoloWidgetLarge : HoloWidgetBase() {
    private val rows = listOf(
        intArrayOf(R.id.holo_w_row1, R.id.holo_w_row1_pack, R.id.holo_w_row1_label, R.id.holo_w_row1_pct),
        intArrayOf(R.id.holo_w_row2, R.id.holo_w_row2_pack, R.id.holo_w_row2_label, R.id.holo_w_row2_pct),
        intArrayOf(R.id.holo_w_row3, R.id.holo_w_row3_pack, R.id.holo_w_row3_label, R.id.holo_w_row3_pct),
    )

    override fun build(context: Context, s: JSONObject?, minW: Int): RemoteViews {
        val v = RemoteViews(context.packageName, R.layout.holo_widget_large)
        v.setImageViewResource(R.id.holo_w_icon, context.applicationInfo.icon)
        v.setOnClickPendingIntent(R.id.holo_w_add, WidgetData.open(context, "#/ajout", 2))
        if (s == null) return v
        val pct = s.optDouble("pct", 0.0)
        val owned = s.optInt("owned")
        val total = s.optInt("total")
        v.setTextViewText(R.id.holo_w_pct, WidgetData.bigPct(pct, 0, 0.7f))
        v.setProgressBar(R.id.holo_w_ring, 1000, (pct * 1000).toInt().coerceIn(0, 1000), false)
        v.setTextViewText(R.id.holo_w_count, "${WidgetData.int(owned)} / ${WidgetData.int(total)} cartes")
        val missing = total - owned
        v.setTextViewText(
            R.id.holo_w_sub,
            (if (missing > 0) "${WidgetData.int(missing)} à trouver" else "Collection complète !") +
                " · ${String.format(WidgetData.fr, "%.0f", s.optDouble("pct2") * 100)} % avec 2e copie",
        )
        for ((i, r) in rows.withIndex()) {
            val b = best(s, i)
            v.setViewVisibility(r[0], if (b != null) View.VISIBLE else View.GONE)
            if (b == null) continue
            WidgetData.setPack(context, v, r[1], b.optString("image"))
            v.setTextViewText(r[2], b.optString("label"))
            v.setTextViewText(r[3], WidgetData.pct(b.optDouble("pNew")))
        }
        v.setViewVisibility(R.id.holo_w_next, if (best(s) != null) View.VISIBLE else View.GONE)
        return v
    }
}
