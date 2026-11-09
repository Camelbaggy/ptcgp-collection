package io.github.camelbaggy.holonative

import android.content.Context
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.ArrayDeque
import java.util.Date
import java.util.Locale

/** Journal de diagnostic : 300 dernières lignes, persistées dans un fichier. */
object HoloLog {
    private const val TAG = "HoloNative"
    private const val MAX_LINES = 300
    private val lines = ArrayDeque<String>()
    private var file: File? = null
    private var loaded = false

    @Synchronized
    fun init(context: Context) {
        if (file == null) {
            file = File(context.applicationContext.filesDir, "holo-log.txt")
        }
        if (!loaded) {
            loaded = true
            try {
                file?.takeIf { it.exists() }?.readLines()?.takeLast(MAX_LINES)?.forEach { lines.addLast(it) }
            } catch (e: Exception) {
                Log.w(TAG, "Lecture du journal impossible", e)
            }
        }
    }

    @Synchronized
    fun add(message: String) {
        Log.i(TAG, message)
        val stamp = SimpleDateFormat("HH:mm:ss", Locale.FRANCE).format(Date())
        lines.addLast("$stamp $message".replace('\n', ' '))
        while (lines.size > MAX_LINES) lines.removeFirst()
        persist()
    }

    fun error(message: String, e: Throwable) {
        Log.e(TAG, message, e)
        add("ERREUR $message : ${e.javaClass.simpleName} ${e.message ?: ""}")
    }

    @Synchronized
    fun get(): List<String> = lines.toList()

    @Synchronized
    fun clear() {
        lines.clear()
        persist()
    }

    private fun persist() {
        try {
            file?.writeText(lines.joinToString("\n"))
        } catch (e: Exception) {
            Log.w(TAG, "Ecriture du journal impossible", e)
        }
    }
}
