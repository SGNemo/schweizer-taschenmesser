package io.github.sgnemo.taschenmesser.lanwatch

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Handler
import java.net.Inet4Address
import java.util.ArrayDeque
import java.util.concurrent.atomic.AtomicBoolean

/** DNS-SD type of the hub (`crates/lan-sync/src/discovery.rs` `SERVICE_TYPE`, without `.local.`). */
internal const val SERVICE_TYPE = "_nemo-sync._tcp"

/** More announcements than this on one network are ignored (Rust tries at most three). */
private const val MAX_FOUND = 16

/** One resolved announcement, raw: Rust checks version, hint and address. */
internal class FoundService(val host: String, val port: Int, val v: String?, val h: String?)

/**
 * One time-boxed `NsdManager` search for `_nemo-sync._tcp`: browse, resolve one service at a time
 * (older Android versions refuse parallel resolves), keep IPv4 results with their TXT `v` and `h`,
 * and hand everything to [done] exactly once when [timeoutMs] is over or the browse fails. A
 * multicast lock is held while it runs (some devices filter mDNS without one) and always released.
 * Only mDNS queries leave the phone; nothing is logged.
 */
internal class HubSearch(
    context: Context,
    private val main: Handler,
    private val timeoutMs: Long,
    private val done: (List<FoundService>) -> Unit,
) {
    private val nsd = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val wifi = context.getSystemService(Context.WIFI_SERVICE) as WifiManager?
    private val finished = AtomicBoolean(false)
    private val found = ArrayList<FoundService>()
    private val queue = ArrayDeque<NsdServiceInfo>()
    private var resolving = false
    private var browsing = false
    private var lock: WifiManager.MulticastLock? = null

    private val browse = object : NsdManager.DiscoveryListener {
        override fun onDiscoveryStarted(serviceType: String) {}

        override fun onServiceFound(info: NsdServiceInfo) {
            synchronized(this@HubSearch) {
                if (finished.get() || queue.size + found.size >= MAX_FOUND) return
                queue.add(info)
            }
            resolveNext()
        }

        override fun onServiceLost(info: NsdServiceInfo) {}

        override fun onDiscoveryStopped(serviceType: String) {}

        override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
            synchronized(this@HubSearch) { browsing = false }
            main.post { finish() }
        }

        override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
    }

    fun start() {
        try {
            lock = wifi?.createMulticastLock("nemo-lan-watch")?.apply {
                setReferenceCounted(false)
                acquire()
            }
        } catch (_: RuntimeException) {
            lock = null // NsdManager works without it on most devices
        }
        try {
            nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, browse)
            synchronized(this) { browsing = true }
        } catch (_: RuntimeException) {
            finish()
            return
        }
        main.postDelayed({ finish() }, timeoutMs)
    }

    private fun resolveNext() {
        val next = synchronized(this) {
            if (resolving || finished.get()) return
            val info = queue.poll() ?: return
            resolving = true
            info
        }
        try {
            @Suppress("DEPRECATION") // resolveService works up to the current API level
            nsd.resolveService(next, object : NsdManager.ResolveListener {
                override fun onServiceResolved(info: NsdServiceInfo) {
                    keep(info)
                    synchronized(this@HubSearch) { resolving = false }
                    resolveNext()
                }

                override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
                    synchronized(this@HubSearch) { resolving = false }
                    resolveNext()
                }
            })
        } catch (_: RuntimeException) {
            synchronized(this) { resolving = false }
        }
    }

    private fun keep(info: NsdServiceInfo) {
        @Suppress("DEPRECATION") // getHost: the single address is enough here
        val host = info.host as? Inet4Address ?: return
        val address = host.hostAddress ?: return
        val txt = info.attributes
        val service = FoundService(address, info.port, text(txt["v"]), text(txt["h"]))
        synchronized(this) {
            if (!finished.get() && found.size < MAX_FOUND) found.add(service)
        }
    }

    private fun text(bytes: ByteArray?): String? =
        bytes?.let { String(it, Charsets.UTF_8) }?.takeIf { it.length <= 64 }

    private fun finish() {
        if (!finished.compareAndSet(false, true)) return
        val stop = synchronized(this) { browsing }
        if (stop) {
            try {
                nsd.stopServiceDiscovery(browse)
            } catch (_: RuntimeException) {
                // never started or already stopped
            }
        }
        try {
            lock?.release()
        } catch (_: RuntimeException) {
            // already released
        }
        lock = null
        val result = synchronized(this) { ArrayList(found) }
        done(result)
    }
}
