package io.github.sgnemo.taschenmesser.lanwatch

import android.app.Activity
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

/** Longest search the plugin runs, whatever Rust asks for (a failed sync round waits for it). */
private const val MAX_SEARCH_MS = 5_000L

@InvokeArg
class DiscoverArgs {
    var timeoutMs: Long = 3_000L
}

/**
 * Home-network sync on the phone (CONCEPT §4, §6).
 *
 * Wi-Fi watch: a [ConnectivityManager.NetworkCallback] for TRANSPORT_WIFI (internet not required: a
 * home network whose router is offline still counts) emits `wifi-available` when the first Wi-Fi
 * network comes up and `wifi-lost` when the last one goes; `wifiState` answers the current state.
 * Works while the process runs and is not frozen; nothing runs in the background on its own.
 *
 * Hub search (`discover`): called by Rust only (no webview permission exists for it), see
 * [HubSearch]. The network name is never read, no location permission is used; nothing is logged.
 */
@TauriPlugin
class LanWatchPlugin(private val activity: Activity) : Plugin(activity) {
    private val context: Context = activity.applicationContext
    private val connectivity =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val main = Handler(Looper.getMainLooper())
    private val wifiNetworks = HashSet<Network>()
    private var callback: ConnectivityManager.NetworkCallback? = null

    override fun load(webView: WebView) {
        watch()
    }

    override fun onDestroy() {
        callback?.let {
            try {
                connectivity.unregisterNetworkCallback(it)
            } catch (_: RuntimeException) {
                // already gone
            }
        }
        callback = null
    }

    private fun watch() {
        if (callback != null) return
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                val first = synchronized(wifiNetworks) {
                    val none = wifiNetworks.isEmpty()
                    wifiNetworks.add(network)
                    none
                }
                if (first) emit("wifi-available")
            }

            override fun onLost(network: Network) {
                val last = synchronized(wifiNetworks) {
                    wifiNetworks.remove(network) && wifiNetworks.isEmpty()
                }
                if (last) emit("wifi-lost")
            }
        }
        try {
            connectivity.registerNetworkCallback(request, cb)
            callback = cb
        } catch (_: RuntimeException) {
            // too many callbacks or no permission: the web app keeps its other sync triggers
        }
    }

    private fun emit(event: String) {
        main.post { trigger(event, JSObject()) }
    }

    /** Wi-Fi connected right now: the callback's view, or (before its first answer) the active network. */
    private fun hasWifi(): Boolean {
        if (synchronized(wifiNetworks) { wifiNetworks.isNotEmpty() }) return true
        return try {
            val active = connectivity.activeNetwork ?: return false
            connectivity.getNetworkCapabilities(active)
                ?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
        } catch (_: RuntimeException) {
            false
        }
    }

    @Command
    fun wifiState(invoke: Invoke) {
        invoke.resolve(JSObject().apply {
            put("supported", true)
            put("connected", hasWifi())
        })
    }

    /** Rust-only (see the class comment): the raw `_nemo-sync._tcp` announcements found on Wi-Fi. */
    @Command
    fun discover(invoke: Invoke) {
        val timeout = try {
            invoke.parseArgs(DiscoverArgs::class.java).timeoutMs
        } catch (_: Exception) {
            3_000L
        }.coerceIn(500L, MAX_SEARCH_MS)
        if (!hasWifi()) {
            invoke.resolve(JSObject().apply { put("services", JSArray()) })
            return
        }
        HubSearch(context, main, timeout) { found ->
            val services = JSArray()
            for (s in found) {
                services.put(JSObject().apply {
                    put("host", s.host)
                    put("port", s.port)
                    s.v?.let { put("v", it) }
                    s.h?.let { put("h", it) }
                })
            }
            invoke.resolve(JSObject().apply { put("services", services) })
        }.start()
    }
}
