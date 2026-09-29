package io.github.sgnemo.taschenmesser.apkinstaller

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

@InvokeArg
class DownloadArgs {
    lateinit var url: String
    var sha256: String? = null
}

@InvokeArg
class InstallArgs {
    lateinit var path: String
}

/**
 * Self-update helper: downloads a release APK into the app cache, verifies its SHA-256 and opens
 * the system package installer. Android additionally verifies the APK signature against the
 * installed app, so only builds signed with our keystore can replace it.
 */
@TauriPlugin
class ApkInstallerPlugin(private val activity: Activity) : Plugin(activity) {
    private val executor = Executors.newSingleThreadExecutor()
    private val downloaded = AtomicLong(0)
    private val total = AtomicLong(0)

    private val updatesDir: File
        get() = File(activity.cacheDir, "updates").apply { mkdirs() }

    private fun canRequestInstalls(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.packageManager.canRequestPackageInstalls()

    @Command
    fun canInstall(invoke: Invoke) {
        val ret = JSObject()
        ret.put("allowed", canRequestInstalls())
        invoke.resolve(ret)
    }

    @Command
    fun downloadProgress(invoke: Invoke) {
        val ret = JSObject()
        ret.put("downloaded", downloaded.get())
        ret.put("total", total.get())
        invoke.resolve(ret)
    }

    @Command
    fun download(invoke: Invoke) {
        val args = invoke.parseArgs(DownloadArgs::class.java)
        if (!args.url.startsWith("https://")) {
            invoke.reject("only https downloads are allowed")
            return
        }
        downloaded.set(0)
        total.set(0)
        // Commands run on the main thread; the network work must not.
        executor.execute {
            try {
                invoke.resolve(fetch(args))
            } catch (e: Exception) {
                invoke.reject(e.message ?: e.javaClass.simpleName)
            }
        }
    }

    private fun fetch(args: DownloadArgs): JSObject {
        // Only one update file is ever kept.
        updatesDir.listFiles()?.forEach { it.delete() }
        val target = File(updatesDir, "Taschenmesser-update.apk")
        val partial = File(updatesDir, "Taschenmesser-update.apk.part")

        val connection = URL(args.url).openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = true
        connection.connectTimeout = 15_000
        connection.readTimeout = 30_000
        connection.setRequestProperty("User-Agent", "Taschenmesser-Updater")
        connection.setRequestProperty("Accept", "application/octet-stream")
        try {
            if (connection.responseCode !in 200..299) {
                throw IllegalStateException("download failed: HTTP ${connection.responseCode}")
            }
            total.set(connection.contentLengthLong.coerceAtLeast(0))
            val digest = MessageDigest.getInstance("SHA-256")
            var size = 0L
            connection.inputStream.use { input ->
                FileOutputStream(partial).use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        size += read
                        if (size > MAX_APK_BYTES) throw IllegalStateException("file too large")
                        digest.update(buffer, 0, read)
                        output.write(buffer, 0, read)
                        downloaded.set(size)
                    }
                }
            }
            val actual = digest.digest().joinToString("") { "%02x".format(it) }
            val expected = args.sha256?.trim()?.lowercase()
            if (expected != null && expected.isNotEmpty() && expected != actual) {
                partial.delete()
                throw IllegalStateException("sha256-mismatch")
            }
            if (!partial.renameTo(target)) throw IllegalStateException("could not store the download")
            val ret = JSObject()
            ret.put("path", target.absolutePath)
            ret.put("sha256", actual)
            ret.put("size", size)
            return ret
        } finally {
            connection.disconnect()
        }
    }

    @Command
    fun install(invoke: Invoke) {
        val args = invoke.parseArgs(InstallArgs::class.java)
        val file = File(args.path)
        // Only files this plugin downloaded may be installed.
        if (!file.canonicalPath.startsWith(updatesDir.canonicalPath + File.separator) || !file.isFile) {
            invoke.reject("unknown update file")
            return
        }
        val ret = JSObject()
        if (!canRequestInstalls()) {
            // Send the user to the "install unknown apps" switch of this app; they retry afterwards.
            val settings = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${activity.packageName}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(settings)
            ret.put("status", "needs-permission")
            invoke.resolve(ret)
            return
        }
        val uri = FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.apkinstaller.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
        ret.put("status", "started")
        invoke.resolve(ret)
    }

    private companion object {
        const val MAX_APK_BYTES = 300L * 1024 * 1024
    }
}
