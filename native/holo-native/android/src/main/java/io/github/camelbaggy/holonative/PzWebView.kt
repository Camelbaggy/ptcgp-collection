package io.github.camelbaggy.holonative

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject
import org.json.JSONTokener
import java.net.URI

/**
 * Fenêtre intégrée (WebView) pour la synchro Pokémon-Zone : c'est un vrai navigateur, celui du
 * téléphone, que l'utilisateur voit au début (vérification Cloudflare éventuelle, connexion) puis
 * qui continue hors de vue pendant que l'appli affiche une barre de progression.
 *
 * Garde-fous :
 *  - aucune interface JavaScript n'est exposée à la page ;
 *  - du code n'est évalué que si la page affichée est sur pokemon-zone.com ou app.pocketmads.com
 *    (tier list méta, lue de la même façon) ;
 *  - hors de vue, la navigation vers un autre site est bloquée ;
 *  - l'agent utilisateur n'est pas modifié.
 * Toutes les méthodes s'appellent depuis le fil principal.
 */
class PzWebView(private val activity: Activity, private val onUi: (String) -> Unit) {

    private val main = Handler(Looper.getMainLooper())
    private var root: FrameLayout? = null
    private var web: WebView? = null
    private var statusView: TextView? = null
    private var actionBtn: Button? = null
    private var visible = true
    private var navCb: ((Boolean, String?) -> Unit)? = null
    private var navTimeout: Runnable? = null
    private var backCb: OnBackPressedCallback? = null

    private fun dp(n: Int): Int = (n * activity.resources.displayMetrics.density).toInt()

    private fun isPzUrl(url: String?): Boolean {
        if (url == null) return false
        return try {
            val u = URI(url)
            val h = (u.host ?: "").lowercase()
            u.scheme == "https" && (h == "pokemon-zone.com" || h.endsWith(".pokemon-zone.com") || h == "app.pocketmads.com")
        } catch (e: Exception) {
            false
        }
    }

    val isOpen: Boolean get() = root != null

    /** `hidden` : ouverte directement hors de vue (lecture automatique, sans flash à l'écran). */
    fun open(url: String, status: String?, hidden: Boolean = false) {
        if (!isPzUrl(url)) throw IllegalArgumentException("Adresse non autorisée.")
        if (root != null) close()
        val w = WebView(activity)
        w.settings.javaScriptEnabled = true
        w.settings.domStorageEnabled = true
        w.settings.javaScriptCanOpenWindowsAutomatically = false
        w.settings.setSupportMultipleWindows(false)
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true)
        w.webChromeClient = WebChromeClient()
        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url.toString()
                if (!u.startsWith("https://")) return true
                // visible : l'utilisateur peut se connecter ailleurs ; hors de vue, on reste sur les sites autorisés
                return !visible && !isPzUrl(u)
            }

            override fun onPageFinished(view: WebView, url: String?) {
                finishNav(true, url)
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    HoloLog.add("pz : erreur de chargement ${error.errorCode}")
                    finishNav(false, request.url.toString())
                }
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                HoloLog.add("pz : processus de rendu arrete")
                finishNav(false, null)
                onUi("cancel")
                return true
            }
        }

        val bar = LinearLayout(activity)
        bar.orientation = LinearLayout.HORIZONTAL
        bar.gravity = Gravity.CENTER_VERTICAL
        bar.setBackgroundColor(Color.parseColor("#1d1838"))
        bar.setPadding(dp(12), dp(8), dp(8), dp(8))
        val st = TextView(activity)
        st.setTextColor(Color.WHITE)
        st.textSize = 14f
        st.setTypeface(st.typeface, Typeface.BOLD)
        st.text = status ?: ""
        bar.addView(st, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        val act = Button(activity)
        act.isAllCaps = false
        act.visibility = android.view.View.GONE
        act.setOnClickListener { onUi("continue") }
        bar.addView(act, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        val cancel = Button(activity)
        cancel.isAllCaps = false
        cancel.text = "Annuler"
        cancel.setOnClickListener { onUi("cancel") }
        bar.addView(cancel, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        val col = LinearLayout(activity)
        col.orientation = LinearLayout.VERTICAL
        col.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        col.addView(w, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        val r = FrameLayout(activity)
        r.setBackgroundColor(Color.parseColor("#15122e"))
        r.keepScreenOn = true
        r.addView(col, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        // marges des barres système (affichage bord à bord)
        ViewCompat.setOnApplyWindowInsetsListener(r) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(b.left, b.top, b.right, b.bottom)
            insets
        }
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        content.addView(r, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        ViewCompat.requestApplyInsets(r)

        root = r
        web = w
        statusView = st
        actionBtn = act
        visible = true
        if (hidden) {
            r.keepScreenOn = false
            setVisible(false, null, null)
        }

        val cb = object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val ww = web
                if (visible && ww != null && ww.canGoBack()) ww.goBack() else onUi("cancel")
            }
        }
        (activity as? ComponentActivity)?.onBackPressedDispatcher?.addCallback(cb)
        backCb = cb

        HoloLog.add("pz : fenetre ouverte")
        w.loadUrl(url)
    }

    private fun finishNav(ok: Boolean, url: String?) {
        val cb = navCb ?: return
        navCb = null
        navTimeout?.let { main.removeCallbacks(it) }
        navTimeout = null
        cb(ok, url)
    }

    fun navigate(url: String, timeoutMs: Long, cb: (Boolean, String?) -> Unit) {
        val w = web ?: throw IllegalStateException("Fenêtre fermée.")
        if (!isPzUrl(url)) throw IllegalArgumentException("Adresse non autorisée.")
        finishNav(false, null)
        navCb = cb
        val t = Runnable { finishNav(false, w.url) }
        navTimeout = t
        main.postDelayed(t, timeoutMs)
        w.loadUrl(url)
    }

    /** Évalue `js` (qui doit produire une chaîne) ; `cb(valeur, erreur)`. */
    fun eval(js: String, cb: (String?, String?) -> Unit) {
        val w = web
        if (w == null) {
            cb(null, "Fenêtre fermée.")
            return
        }
        if (!isPzUrl(w.url)) {
            cb(null, "Page non autorisée.")
            return
        }
        w.evaluateJavascript(js) { raw ->
            try {
                val v = JSONTokener(raw ?: "null").nextValue()
                cb(if (v == JSONObject.NULL) null else v.toString(), null)
            } catch (e: Exception) {
                cb(null, "Résultat illisible.")
            }
        }
    }

    fun setVisible(show: Boolean, status: String?, button: String?) {
        val r = root ?: return
        visible = show
        val w = if (r.width > 0) r.width else activity.resources.displayMetrics.widthPixels
        // hors de vue : la fenêtre reste affichée (donc active), seulement décalée hors de l'écran
        r.translationX = if (show) 0f else -(w * 2).toFloat()
        if (status != null) statusView?.text = status
        val b = actionBtn
        if (b != null) {
            if (button.isNullOrEmpty()) {
                b.visibility = android.view.View.GONE
            } else {
                b.text = button
                b.visibility = android.view.View.VISIBLE
            }
        }
        HoloLog.add("pz : fenetre ${if (show) "visible" else "cachee"}")
    }

    fun close() {
        finishNav(false, null)
        backCb?.remove()
        backCb = null
        val r = root
        val w = web
        root = null
        web = null
        statusView = null
        actionBtn = null
        try {
            w?.stopLoading()
            (r?.parent as? ViewGroup)?.removeView(r)
            w?.destroy()
        } catch (e: Exception) {
            HoloLog.error("fermeture de la fenetre pz", e)
        }
        HoloLog.add("pz : fenetre fermee")
    }
}
