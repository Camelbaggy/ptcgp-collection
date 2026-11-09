package io.github.camelbaggy.holonative

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Une vidéo d'écran enregistrée dans le cache. */
data class RecordingRecord(
    val id: String,
    val at: Long,
    val durationMs: Long,
    val width: Int,
    val height: Int,
    val path: String,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("id", id)
        .put("at", at)
        .put("durationMs", durationMs)
        .put("width", width)
        .put("height", height)
        .put("path", path)
}

/** Liste des vidéos en attente, persistée en JSON (même principe que CaptureStore). */
object RecordingStore {
    private var file: File? = null

    @Synchronized
    private fun file(context: Context): File {
        val f = file ?: File(context.applicationContext.filesDir, "pending-recordings.json")
        file = f
        return f
    }

    fun recordingDir(context: Context): File {
        val d = File(context.applicationContext.cacheDir, "recordings")
        if (!d.exists()) d.mkdirs()
        return d
    }

    @Synchronized
    fun read(context: Context): MutableList<RecordingRecord> {
        val out = mutableListOf<RecordingRecord>()
        try {
            val f = file(context)
            if (!f.exists()) return out
            val arr = JSONArray(f.readText())
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val rec = RecordingRecord(
                    o.getString("id"),
                    o.getLong("at"),
                    o.getLong("durationMs"),
                    o.getInt("width"),
                    o.getInt("height"),
                    o.getString("path"),
                )
                if (File(rec.path).exists()) out.add(rec)
            }
        } catch (e: Exception) {
            HoloLog.error("lecture des videos en attente", e)
        }
        return out
    }

    @Synchronized
    private fun write(context: Context, list: List<RecordingRecord>) {
        try {
            val arr = JSONArray()
            list.forEach { arr.put(it.toJson()) }
            file(context).writeText(arr.toString())
        } catch (e: Exception) {
            HoloLog.error("ecriture des videos en attente", e)
        }
    }

    @Synchronized
    fun add(context: Context, rec: RecordingRecord) {
        val list = read(context)
        list.add(rec)
        write(context, list)
    }

    @Synchronized
    fun take(context: Context): List<RecordingRecord> {
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
            File(recordingDir(context), "$id.mp4").delete()
        } catch (e: Exception) {
            HoloLog.error("suppression de la video $id", e)
        }
    }
}
