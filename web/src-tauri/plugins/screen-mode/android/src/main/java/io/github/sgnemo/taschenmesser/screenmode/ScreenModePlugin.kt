package io.github.sgnemo.taschenmesser.screenmode

import android.app.Activity
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.KeyboardShortcutGroup
import android.view.Menu
import android.view.Window
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

/**
 * The volume keys stay with the web app at most this long after it last asked for them. The app
 * asks again while it wants them; if it stops (a crash of the page, a bug), the keys go back to
 * the phone by themselves – its own volume is never out of reach for long.
 */
private const val VOLUME_KEYS_LEASE_MS = 6_000L

@InvokeArg
class EnabledArgs {
    var enabled: Boolean = false
}

/**
 * Window modes for the cockpit:
 *  - `setImmersive`: status and navigation bars hidden; a swipe from the edge shows them for a
 *    moment (`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`). Off restores the normal bars.
 *  - `setKeepAwake`: `FLAG_KEEP_SCREEN_ON` while the cockpit is open.
 *
 *  - `setVolumeKeys`: while on (and for a short lease, see [VOLUME_KEYS_LEASE_MS]) the two
 *    hardware volume keys do not change the phone's volume; each press is handed to the web app
 *    as the event `volume-key` (`key`: `up` or `down`, `repeat`: the key is being held). The
 *    remote control uses it. Only these two keys, only while Nemo's window has the focus.
 *
 * All are settings of the activity window only: nothing is stored, nothing is logged. Needs a
 * device to verify (manual checklist in docs/MANUAL-TESTS.md).
 */
@TauriPlugin
class ScreenModePlugin(private val activity: Activity) : Plugin(activity) {
    private val main = Handler(Looper.getMainLooper())

    /** Main thread only. */
    private var volumeKeys = false
    private var keysWatched = false
    private val giveKeysBack = Runnable { volumeKeys = false }

    /**
     * Puts a thin layer over the window's callback, once: everything goes on to the callback that
     * was there, except the two volume keys while the web app holds them.
     */
    private fun watchKeys() {
        if (keysWatched) return
        val window = activity.window
        val inner = window.callback ?: return
        window.callback = object : Window.Callback by inner {
            override fun dispatchKeyEvent(event: KeyEvent): Boolean {
                val key = when (event.keyCode) {
                    KeyEvent.KEYCODE_VOLUME_UP -> "up"
                    KeyEvent.KEYCODE_VOLUME_DOWN -> "down"
                    else -> null
                }
                if (key == null || !volumeKeys) return inner.dispatchKeyEvent(event)
                if (event.action == KeyEvent.ACTION_DOWN) {
                    val data = JSObject()
                    data.put("key", key)
                    data.put("repeat", event.repeatCount > 0)
                    trigger("volume-key", data)
                }
                // down and up are both taken: the system's volume panel must not appear
                return true
            }

            // The two methods the interface gives a body of its own go on by hand (delegation
            // covers only the ones without).
            override fun onProvideKeyboardShortcuts(
                data: MutableList<KeyboardShortcutGroup>?,
                menu: Menu?,
                deviceId: Int,
            ) {
                inner.onProvideKeyboardShortcuts(data, menu, deviceId)
            }

            override fun onPointerCaptureChanged(hasCapture: Boolean) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    inner.onPointerCaptureChanged(hasCapture)
                }
            }
        }
        keysWatched = true
    }

    @Command
    fun setVolumeKeys(invoke: Invoke) {
        val args = invoke.parseArgs(EnabledArgs::class.java)
        activity.runOnUiThread {
            try {
                main.removeCallbacks(giveKeysBack)
                if (args.enabled) {
                    watchKeys()
                    volumeKeys = keysWatched
                    if (volumeKeys) main.postDelayed(giveKeysBack, VOLUME_KEYS_LEASE_MS)
                } else {
                    volumeKeys = false
                }
                invoke.resolve()
            } catch (e: Exception) {
                volumeKeys = false
                invoke.reject(e.message ?: e.javaClass.simpleName)
            }
        }
    }

    @Command
    fun setImmersive(invoke: Invoke) {
        val args = invoke.parseArgs(EnabledArgs::class.java)
        activity.runOnUiThread {
            val window = activity.window
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            if (args.enabled) {
                WindowCompat.setDecorFitsSystemWindows(window, false)
                controller.systemBarsBehavior =
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                controller.hide(WindowInsetsCompat.Type.systemBars())
            } else {
                controller.show(WindowInsetsCompat.Type.systemBars())
                WindowCompat.setDecorFitsSystemWindows(window, true)
            }
            invoke.resolve()
        }
    }

    @Command
    fun setKeepAwake(invoke: Invoke) {
        val args = invoke.parseArgs(EnabledArgs::class.java)
        activity.runOnUiThread {
            if (args.enabled) {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
            invoke.resolve()
        }
    }
}
