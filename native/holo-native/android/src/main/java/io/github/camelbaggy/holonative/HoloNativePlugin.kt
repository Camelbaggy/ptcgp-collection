package io.github.camelbaggy.holonative

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import org.json.JSONObject

@CapacitorPlugin(name = "HoloNative")
class HoloNativePlugin : Plugin() {

    private val main = Handler(Looper.getMainLooper())
    private var notifLauncher: ActivityResultLauncher<String>? = null
    private var projectionLauncher: ActivityResultLauncher<Intent>? = null
    private var authLauncher: ActivityResultLauncher<IntentSenderRequest>? = null

    private var startCall: PluginCall? = null
    private var authCall: PluginCall? = null
    private var lastToken: String? = null

    override fun load() {
        HoloLog.init(context)
        HoloLog.add("plugin charge (Android ${Build.VERSION.SDK_INT})")

        notifLauncher = bridge.registerForActivityResult(
            ActivityResultContracts.RequestPermission(),
            ActivityResultCallback<Boolean> { granted ->
                HoloLog.add("notifications : ${if (granted) "accordees" else "refusees (non bloquant)"}")
                launchProjection()
            },
        )
        projectionLauncher = bridge.registerForActivityResult(
            ActivityResultContracts.StartActivityForResult(),
            ActivityResultCallback<ActivityResult> { result -> onProjectionResult(result) },
        )
        authLauncher = bridge.registerForActivityResult(
            ActivityResultContracts.StartIntentSenderForResult(),
            ActivityResultCallback<ActivityResult> { result -> onAuthResult(result) },
        )

        HoloEvents.onCaptureTaken = { rec ->
            val d = JSObject()
            d.put("id", rec.id)
            d.put("at", rec.at)
            d.put("black", rec.black)
            notifyListeners("captureTaken", d)
        }
        HoloEvents.onRecordingStopped = { rec ->
            val d = JSObject()
            d.put("id", rec.id)
            d.put("durationMs", rec.durationMs)
            notifyListeners("recordingStopped", d)
        }
        HoloEvents.onSessionEnded = { reason ->
            val d = JSObject()
            d.put("reason", reason)
            notifyListeners("captureSessionEnded", d)
        }
    }

    override fun handleOnDestroy() {
        try { pz?.close() } catch (e: Exception) { HoloLog.error("fermeture pz", e) }
        pz = null
        HoloEvents.onCaptureTaken = null
        HoloEvents.onRecordingStopped = null
        HoloEvents.onSessionEnded = null
        HoloEvents.onSessionReady = null
        super.handleOnDestroy()
    }

    // ---------------------------------------------------------------- Capture

    @PluginMethod
    fun startCaptureSession(call: PluginCall) {
        try {
            if (CaptureService.active) {
                val r = JSObject()
                r.put("granted", true)
                call.resolve(r)
                return
            }
            if (startCall != null) {
                call.reject("Une demande de capture est déjà en cours.")
                return
            }
            startCall = call
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                HoloLog.add("demande de l'autorisation des notifications")
                val nl = notifLauncher
                if (nl != null) nl.launch(Manifest.permission.POST_NOTIFICATIONS) else launchProjection()
            } else {
                launchProjection()
            }
        } catch (e: Exception) {
            HoloLog.error("startCaptureSession", e)
            failStart("Impossible de lancer la demande de capture d'écran.")
        }
    }

    private fun launchProjection() {
        try {
            val mgr = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val launcher = projectionLauncher ?: throw IllegalStateException("lanceur absent")
            HoloLog.add("demande d'autorisation de capture (MediaProjection)")
            launcher.launch(mgr.createScreenCaptureIntent())
        } catch (e: Exception) {
            HoloLog.error("launchProjection", e)
            failStart("Impossible d'afficher la demande d'autorisation de capture.")
        }
    }

    private fun onProjectionResult(result: ActivityResult) {
        val call = startCall
        val data = result.data
        HoloLog.add("autorisation de capture : resultCode=${result.resultCode}")
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || data == null) {
            startCall = null
            val r = JSObject()
            r.put("granted", false)
            call.resolve(r)
            return
        }
        var done = false
        val finish: (Boolean, String?) -> Unit = { ok, msg ->
            main.post {
                if (!done) {
                    done = true
                    HoloEvents.onSessionReady = null
                    startCall = null
                    if (ok) {
                        val r = JSObject()
                        r.put("granted", true)
                        call.resolve(r)
                    } else {
                        call.reject(msg ?: "Échec du démarrage de la capture.")
                    }
                }
            }
        }
        HoloEvents.onSessionReady = finish
        main.postDelayed({
            if (!done) {
                HoloLog.add("ERREUR delai depasse au demarrage du service")
                finish(false, "Le service de capture ne répond pas.")
            }
        }, 8000L)
        try {
            val i = Intent(context, CaptureService::class.java)
                .setAction(CaptureService.ACTION_START)
                .putExtra(CaptureService.EXTRA_RESULT_CODE, result.resultCode)
                .putExtra(CaptureService.EXTRA_RESULT_DATA, data)
            ContextCompat.startForegroundService(context, i)
            HoloLog.add("service de capture lance")
        } catch (e: Exception) {
            HoloLog.error("demarrage du service", e)
            finish(false, "Impossible de démarrer le service de capture.")
        }
    }

    private fun failStart(msg: String) {
        val call = startCall
        startCall = null
        call?.reject(msg)
    }

    @PluginMethod
    fun stopCaptureSession(call: PluginCall) {
        try {
            CaptureService.stopSession("arret")
            call.resolve()
        } catch (e: Exception) {
            HoloLog.error("stopCaptureSession", e)
            call.reject("Impossible d'arrêter la session de capture.")
        }
    }

    @PluginMethod
    fun captureStatus(call: PluginCall) {
        try {
            val r = JSObject()
            r.put("active", CaptureService.active)
            r.put("pending", CaptureStore.count(context))
            call.resolve(r)
        } catch (e: Exception) {
            HoloLog.error("captureStatus", e)
            call.reject("Impossible de lire l'état de la capture.")
        }
    }

    @PluginMethod
    fun scheduleCapture(call: PluginCall) {
        try {
            val delay = call.getLong("delayMs") ?: 3000L
            if (CaptureService.busyRecording) {
                call.reject("Capture impossible pendant un enregistrement.")
                return
            }
            if (!CaptureService.schedule(delay)) {
                call.reject("Aucune session de capture active.")
                return
            }
            call.resolve()
        } catch (e: Exception) {
            HoloLog.error("scheduleCapture", e)
            call.reject("Impossible de programmer la capture.")
        }
    }

    @PluginMethod
    fun takeCaptures(call: PluginCall) {
        try {
            val items = JSArray()
            CaptureStore.take(context).forEach { items.put(JSObject(it.toJson().toString())) }
            val r = JSObject()
            r.put("items", items)
            call.resolve(r)
        } catch (e: Exception) {
            HoloLog.error("takeCaptures", e)
            call.reject("Impossible de lire les captures.")
        }
    }

    @PluginMethod
    fun deleteCapture(call: PluginCall) {
        try {
            val id = call.getString("id")
            if (id.isNullOrEmpty() || id.contains('/') || id.contains("..")) {
                call.reject("Identifiant de capture invalide.")
                return
            }
            CaptureStore.delete(context, id)
            call.resolve()
        } catch (e: Exception) {
            HoloLog.error("deleteCapture", e)
            call.reject("Impossible de supprimer la capture.")
        }
    }

    // ---------------------------------------------------------------- Enregistrement

    @PluginMethod
    fun startRecording(call: PluginCall) {
        try {
            val delay = call.getLong("delayMs") ?: 3000L
            val maxWidth = call.getInt("maxWidth") ?: 720
            val err = CaptureService.scheduleRecording(delay, maxWidth)
            if (err != null) {
                call.reject(err)
                return
            }
            call.resolve()
        } catch (e: Exception) {
            HoloLog.error("startRecording", e)
            call.reject("Impossible de programmer l'enregistrement.")
        }
    }

    @PluginMethod
    fun stopRecording(call: PluginCall) {
        // MediaRecorder.stop() peut bloquer un instant : hors du fil principal.
        Thread {
            try {
                if (CaptureService.stopRecording("app")) {
                    call.resolve()
                } else {
                    call.reject("Aucun enregistrement en cours.")
                }
            } catch (e: Exception) {
                HoloLog.error("stopRecording", e)
                call.reject("Impossible d'arrêter l'enregistrement.")
            }
        }.start()
    }

    @PluginMethod
    fun recordingStatus(call: PluginCall) {
        try {
            val r = JSObject()
            r.put("recording", CaptureService.recording)
            r.put("pending", RecordingStore.count(context))
            call.resolve(r)
        } catch (e: Exception) {
            HoloLog.error("recordingStatus", e)
            call.reject("Impossible de lire l'état de l'enregistrement.")
        }
    }

    @PluginMethod
    fun takeRecordings(call: PluginCall) {
        try {
            val items = JSArray()
            RecordingStore.take(context).forEach { items.put(JSObject(it.toJson().toString())) }
            val r = JSObject()
            r.put("items", items)
            call.resolve(r)
        } catch (e: Exception) {
            HoloLog.error("takeRecordings", e)
            call.reject("Impossible de lire les vidéos.")
        }
    }

    @PluginMethod
    fun deleteRecording(call: PluginCall) {
        try {
            val id = call.getString("id")
            if (id.isNullOrEmpty() || id.contains('/') || id.contains("..")) {
                call.reject("Identifiant de vidéo invalide.")
                return
            }
            RecordingStore.delete(context, id)
            call.resolve()
        } catch (e: Exception) {
            HoloLog.error("deleteRecording", e)
            call.reject("Impossible de supprimer la vidéo.")
        }
    }

    // ---------------------------------------------------------------- Google

    @PluginMethod
    fun googleAuthorize(call: PluginCall) {
        try {
            val arr = call.getArray("scopes")
            val scopes = ArrayList<Scope>()
            if (arr != null) {
                for (i in 0 until arr.length()) scopes.add(Scope(arr.getString(i)))
            }
            if (scopes.isEmpty()) {
                call.reject("Aucune autorisation demandée.")
                return
            }
            val interactive = call.getBoolean("interactive") ?: false
            val request = AuthorizationRequest.builder().setRequestedScopes(scopes).build()
            HoloLog.add("autorisation Google (interactive=$interactive, ${scopes.size} portee(s))")
            Identity.getAuthorizationClient(activity).authorize(request)
                .addOnSuccessListener { result ->
                    try {
                        if (result.hasResolution()) {
                            if (!interactive) {
                                HoloLog.add("autorisation Google : consentement requis")
                                call.reject("Consentement Google requis.", "consent_required")
                                return@addOnSuccessListener
                            }
                            val pi = result.pendingIntent
                            val launcher = authLauncher
                            if (pi == null || launcher == null) {
                                call.reject("Fenêtre d'autorisation Google indisponible.")
                                return@addOnSuccessListener
                            }
                            if (authCall != null) {
                                call.reject("Une autorisation Google est déjà en cours.")
                                return@addOnSuccessListener
                            }
                            authCall = call
                            launcher.launch(IntentSenderRequest.Builder(pi.intentSender).build())
                        } else {
                            resolveAuth(call, result)
                        }
                    } catch (e: Exception) {
                        HoloLog.error("resultat d'autorisation Google", e)
                        authCall = null
                        call.reject("Échec de l'autorisation Google.")
                    }
                }
                .addOnFailureListener { e ->
                    HoloLog.error("autorisation Google", e)
                    call.reject("Échec de l'autorisation Google.")
                }
        } catch (e: Exception) {
            HoloLog.error("googleAuthorize", e)
            call.reject("Échec de l'autorisation Google.")
        }
    }

    private fun onAuthResult(result: ActivityResult) {
        val call = authCall
        authCall = null
        if (call == null) return
        HoloLog.add("fenetre Google fermee : resultCode=${result.resultCode}")
        val data = result.data
        if (result.resultCode != Activity.RESULT_OK || data == null) {
            call.reject("Autorisation Google refusée ou annulée.", "cancelled")
            return
        }
        try {
            val r = Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data)
            resolveAuth(call, r)
        } catch (e: Exception) {
            HoloLog.error("lecture du resultat Google", e)
            call.reject("Échec de l'autorisation Google.")
        }
    }

    private fun resolveAuth(call: PluginCall, result: AuthorizationResult) {
        val token = result.accessToken
        if (token.isNullOrEmpty()) {
            HoloLog.add("ERREUR autorisation Google sans jeton")
            call.reject("Google n'a pas fourni de jeton.")
            return
        }
        lastToken = token
        val r = JSObject()
        r.put("accessToken", token)
        val email: String? = try {
            result.toGoogleSignInAccount()?.email
        } catch (e: Exception) {
            null
        }
        if (!email.isNullOrEmpty()) r.put("email", email)
        HoloLog.add("autorisation Google obtenue")
        call.resolve(r)
    }

    @PluginMethod
    fun googleSignOut(call: PluginCall) {
        val token = lastToken
        lastToken = null
        if (token == null) {
            call.resolve()
            return
        }
        Thread {
            try {
                GoogleAuthUtil.clearToken(context, token)
                HoloLog.add("jeton Google efface")
            } catch (e: Exception) {
                HoloLog.error("effacement du jeton Google", e)
            }
            call.resolve()
        }.start()
    }

    // ---------------------------------------------------------------- Synchro Pokémon-Zone (fenêtre intégrée)

    private var pz: PzWebView? = null

    private fun pzOnUi(call: PluginCall, block: (PzWebView) -> Unit) {
        val a = activity
        if (a == null) {
            call.reject("Activité indisponible.")
            return
        }
        a.runOnUiThread {
            try {
                val v = pz ?: PzWebView(a) { action ->
                    val d = JSObject()
                    d.put("action", action)
                    notifyListeners("pzUi", d)
                }.also { pz = it }
                block(v)
            } catch (e: Exception) {
                HoloLog.error("pz", e)
                call.reject(e.message ?: "Erreur de la fenêtre Pokémon-Zone.")
            }
        }
    }

    @PluginMethod
    fun pzOpen(call: PluginCall) {
        val url = call.getString("url")
        if (url == null) {
            call.reject("Adresse manquante.")
            return
        }
        val status = call.getString("status")
        val hidden = call.getBoolean("hidden", false) ?: false
        pzOnUi(call) { v ->
            v.open(url, status, hidden)
            call.resolve()
        }
    }

    @PluginMethod
    fun pzNavigate(call: PluginCall) {
        val url = call.getString("url")
        if (url == null) {
            call.reject("Adresse manquante.")
            return
        }
        val timeout = (call.getInt("timeoutMs") ?: 30000).toLong()
        pzOnUi(call) { v ->
            v.navigate(url, timeout) { ok, finalUrl ->
                val r = JSObject()
                r.put("ok", ok)
                r.put("url", finalUrl ?: "")
                call.resolve(r)
            }
        }
    }

    @PluginMethod
    fun pzEval(call: PluginCall) {
        val js = call.getString("js")
        if (js == null) {
            call.reject("Script manquant.")
            return
        }
        pzOnUi(call) { v ->
            v.eval(js) { value, error ->
                if (error != null) {
                    call.reject(error)
                } else {
                    val r = JSObject()
                    r.put("value", value ?: JSONObject.NULL)
                    call.resolve(r)
                }
            }
        }
    }

    @PluginMethod
    fun pzSetVisible(call: PluginCall) {
        val show = call.getBoolean("visible") ?: true
        val status = call.getString("status")
        val button = call.getString("button")
        pzOnUi(call) { v ->
            v.setVisible(show, status, button)
            call.resolve()
        }
    }

    @PluginMethod
    fun pzClose(call: PluginCall) {
        val a = activity
        if (a == null) {
            call.resolve()
            return
        }
        a.runOnUiThread {
            try {
                pz?.close()
            } catch (e: Exception) {
                HoloLog.error("pzClose", e)
            }
            pz = null
            call.resolve()
        }
    }

    // ---------------------------------------------------------------- Journal

    @PluginMethod
    fun getLog(call: PluginCall) {
        val arr = JSArray()
        HoloLog.get().forEach { arr.put(it) }
        val r = JSObject()
        r.put("lines", arr)
        call.resolve(r)
    }

    @PluginMethod
    fun clearLog(call: PluginCall) {
        HoloLog.clear()
        call.resolve()
    }

    @PluginMethod
    fun log(call: PluginCall) {
        HoloLog.add("[app] " + (call.getString("message") ?: ""))
        call.resolve()
    }

    // ---------- Widget d'écran d'accueil ----------

    @PluginMethod
    fun widgetUpdate(call: PluginCall) {
        val summary = call.getString("summary")
        if (summary.isNullOrEmpty()) {
            call.reject("summary manquant")
            return
        }
        try {
            HoloWidget.save(context, summary)
            call.resolve()
        } catch (e: Exception) {
            HoloLog.add("widget : ${e.message}")
            call.reject(e.message ?: "erreur widget")
        }
    }
}
