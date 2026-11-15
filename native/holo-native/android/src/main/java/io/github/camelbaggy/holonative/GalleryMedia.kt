package io.github.camelbaggy.holonative

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import org.json.JSONObject
import java.io.File

/**
 * Images et vidéos choisies dans le téléphone (galerie, captures, enregistrements d'écran) par le
 * sélecteur de documents d'Android, pour pouvoir les supprimer une fois les boosters ajoutés.
 *
 * L'appli lit une copie placée dans son cache (`picked/`), effacée au choix suivant et au démarrage.
 * La suppression des originaux passe par la fenêtre de confirmation d'Android (Android 11 et plus).
 */
object GalleryMedia {
    private const val MAX_BYTES = 400L * 1024 * 1024

    fun pickedDir(context: Context): File {
        val d = File(context.applicationContext.cacheDir, "picked")
        if (!d.exists()) d.mkdirs()
        return d
    }

    /** Efface les copies des choix précédents (déjà lues par l'appli). */
    fun clearCopies(context: Context) {
        try {
            pickedDir(context).listFiles()?.forEach { it.delete() }
        } catch (e: Exception) {
            HoloLog.error("nettoyage des fichiers choisis", e)
        }
    }

    fun pickIntent(kind: String, multiple: Boolean): Intent {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT)
        i.addCategory(Intent.CATEGORY_OPENABLE)
        when (kind) {
            "image" -> i.type = "image/*"
            "video" -> i.type = "video/*"
            else -> {
                i.type = "*/*"
                i.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
            }
        }
        i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        return i
    }

    fun urisOf(data: Intent?): List<Uri> {
        if (data == null) return emptyList()
        val out = mutableListOf<Uri>()
        val clip = data.clipData
        if (clip != null) {
            for (k in 0 until clip.itemCount) clip.getItemAt(k)?.uri?.let { out.add(it) }
        } else {
            data.data?.let { out.add(it) }
        }
        return out
    }

    /** URI MediaStore du document (supprimable avec confirmation d'Android), ou null. */
    fun mediaUri(context: Context, uri: Uri): Uri? {
        if (uri.authority == "media") return uri
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
        return try {
            MediaStore.getMediaUri(context, uri)
        } catch (e: Exception) {
            null
        }
    }

    /** Le fournisseur du document accepte-t-il qu'on le supprime directement ? */
    fun supportsDelete(context: Context, uri: Uri): Boolean {
        if (!DocumentsContract.isDocumentUri(context, uri)) return false
        return try {
            context.contentResolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_FLAGS), null, null, null)?.use { c ->
                c.moveToFirst() && (c.getInt(0) and DocumentsContract.Document.FLAG_SUPPORTS_DELETE) != 0
            } ?: false
        } catch (e: Exception) {
            false
        }
    }

    fun canDelete(context: Context, uri: Uri): Boolean =
        (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && mediaUri(context, uri) != null) || supportsDelete(context, uri)

    /** Copie le document dans le cache ; renvoie sa description pour l'appli. */
    fun copy(context: Context, uri: Uri, index: Int): JSONObject {
        val resolver = context.contentResolver
        var name = "fichier-${index + 1}"
        var size = -1L
        try {
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    if (!c.isNull(0)) name = c.getString(0)
                    if (!c.isNull(1)) size = c.getLong(1)
                }
            }
        } catch (e: Exception) {
            HoloLog.error("nom du fichier choisi", e)
        }
        if (size > MAX_BYTES) throw IllegalStateException("Fichier trop gros (${size / 1024 / 1024} Mo).")
        val mime = resolver.getType(uri) ?: "application/octet-stream"
        val id = "p${System.currentTimeMillis()}-$index"
        val ext = when {
            mime.startsWith("video/") -> "mp4"
            mime == "image/jpeg" -> "jpg"
            mime == "image/webp" -> "webp"
            else -> "png"
        }
        val out = File(pickedDir(context), "$id.$ext")
        resolver.openInputStream(uri)?.use { input ->
            out.outputStream().use { input.copyTo(it) }
        } ?: throw IllegalStateException("Fichier illisible.")
        return JSONObject()
            .put("id", id)
            .put("path", out.absolutePath)
            .put("name", name)
            .put("mime", mime)
            .put("size", out.length())
            .put("uri", uri.toString())
            .put("deletable", canDelete(context, uri))
    }
}
