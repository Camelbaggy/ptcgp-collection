package io.github.camelbaggy.holonative

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Une capture enregistrée dans le cache. */
data class CaptureRecord(
    val id: String,
    val at: Long,
    val width: Int,
    val height: Int,
    val path: String,
    val black: Boolean,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("id", id)
        .put("at", at)
        .put("width", width)
        .put("height", height)
        .put("path", path)
        .put("black", black)
}

/** Liste des captures en attente, persistée en JSON (survit à la mise en pause de la WebView). */
object CaptureStore {
    private var file: File? = null

    @Synchronized
    private fun file(context: Context): File {
        val f = file ?: File(context.applicationContext.filesDir, "pending-captures.json")
        file = f
        return f
    }

    fun captureDir(context: Context): File {
        val d = File(context.applicationContext.cacheDir, "captures")
        if (!d.exists()) d.mkdirs()
        return d
    }

    @Synchronized
    fun read(context: Context): MutableList<CaptureRecord> {
        val out = mutableListOf<CaptureRecord>()
        try {
            val f = file(context)
            if (!f.exists()) return out
            val arr = JSONArray(f.readText())
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val rec = CaptureRecord(
                    o.getString("id"),
                    o.getLong("at"),
                    o.getInt("width"),
                    o.getInt("height"),
                    o.getString("path"),
                    o.getBoolean("black"),
                )
                if (File(rec.path).exists()) out.add(rec)
            }
        } catch (e: Exception) {
            HoloLog.error("lecture des captures en attente", e)
        }
        return out
    }

    @Synchronized
    private fun write(context: Context, list: List<CaptureRecord>) {
        try {
            val arr = JSONArray()
            list.forEach { arr.put(it.toJson()) }
            file(context).writeText(arr.toString())
        } catch (e: Exception) {
            HoloLog.error("ecriture des captures en attente", e)
        }
    }

    @Synchronized
    fun add(context: Context, rec: CaptureRecord) {
        val list = read(context)
        list.add(rec)
        write(context, list)
    }

    @Synchronized
    fun take(context: Context): List<CaptureRecord> {
        val list = read(context)
        write(context, emptyList())
        return list
    }

    @Synchronized
    fun count(context: Context): Int = read(context).size

    @Synchronized
    fun delete(context: Context, id: String) {
        val list = read(context)
        val keep = list.filter { it.id != id }
        if (keep.size != list.size) write(context, keep)
        try {
            File(captureDir(context), "$id.png").delete()
        } catch (e: Exception) {
            HoloLog.error("suppression de la capture $id", e)
        }
    }
}
