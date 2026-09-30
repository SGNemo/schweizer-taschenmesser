package io.github.sgnemo.taschenmesser.shareintent

import android.app.Activity
import android.content.Intent
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

/** Longest shared text we hand to the web view; anything beyond is cut off. */
private const val MAX_CHARS = 20_000

/**
 * Keeps the latest text or link another app shared (ACTION_SEND, text/plain) until the web app
 * fetches it with `takePending`. The launching intent is read in `load`, later shares (the
 * activity is singleTask) arrive in `onNewIntent`. Nothing is logged.
 */
@TauriPlugin
class ShareIntentPlugin(private val activity: Activity) : Plugin(activity) {
    private var pending: JSObject? = null

    override fun load(webView: WebView) {
        remember(activity.intent)
    }

    override fun onNewIntent(intent: Intent) {
        remember(intent)
    }

    private fun remember(intent: Intent?) {
        if (intent == null || intent.action != Intent.ACTION_SEND) return
        if (intent.type?.startsWith("text/") != true) return
        val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.take(MAX_CHARS) ?: ""
        val title = (intent.getStringExtra(Intent.EXTRA_SUBJECT)
            ?: intent.getStringExtra(Intent.EXTRA_TITLE) ?: "").take(MAX_CHARS)
        if (text.isBlank() && title.isBlank()) return
        // Consume the extras so that recreating the activity does not deliver the same share twice.
        intent.removeExtra(Intent.EXTRA_TEXT)
        intent.removeExtra(Intent.EXTRA_SUBJECT)
        intent.removeExtra(Intent.EXTRA_TITLE)
        pending = JSObject().apply {
            put("title", title)
            put("text", text)
        }
    }

    @Command
    fun takePending(invoke: Invoke) {
        val shared = pending ?: JSObject()
        pending = null
        invoke.resolve(shared)
    }
}
