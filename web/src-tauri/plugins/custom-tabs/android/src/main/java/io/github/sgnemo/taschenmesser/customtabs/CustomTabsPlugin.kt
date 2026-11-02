package io.github.sgnemo.taschenmesser.customtabs

import android.app.Activity
import android.content.ActivityNotFoundException
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class OpenArgs {
    lateinit var url: String
}

/**
 * Opens an http(s) address in a Custom Tab: the system browser inside the app, with its own cookies
 * and settings. The page runs in the browser's process; we inject nothing and get nothing back
 * (no page content, no history). The Rust side has already checked the scheme; it is checked again
 * here because this is the last step before another app is started.
 */
@TauriPlugin
class CustomTabsPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun open(invoke: Invoke) {
        val args = invoke.parseArgs(OpenArgs::class.java)
        val uri = Uri.parse(args.url)
        if (uri.scheme != "https" && uri.scheme != "http") {
            invoke.reject("scheme")
            return
        }
        try {
            CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(activity, uri)
            invoke.resolve()
        } catch (e: ActivityNotFoundException) {
            invoke.reject("unavailable")
        }
    }
}
