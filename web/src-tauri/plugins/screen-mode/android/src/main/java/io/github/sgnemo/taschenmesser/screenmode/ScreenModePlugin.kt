package io.github.sgnemo.taschenmesser.screenmode

import android.app.Activity
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

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
 * Both are flags on the activity window only: nothing is stored, nothing is logged. Needs a
 * device to verify (manual checklist in docs/MANUAL-TESTS.md).
 */
@TauriPlugin
class ScreenModePlugin(private val activity: Activity) : Plugin(activity) {
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
