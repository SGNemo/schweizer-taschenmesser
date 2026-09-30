package io.github.sgnemo.taschenmesser.securestore

import android.app.Activity
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import android.view.WindowManager
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@InvokeArg
class SetArgs {
    lateinit var name: String
    lateinit var value: String
}

@InvokeArg
class NameArgs {
    lateinit var name: String
}

@InvokeArg
class SealArgs {
    lateinit var name: String
    lateinit var secret: String
    lateinit var title: String
    lateinit var subtitle: String
    lateinit var cancel: String
}

@InvokeArg
class UnsealArgs {
    lateinit var name: String
    lateinit var title: String
    lateinit var subtitle: String
    lateinit var cancel: String
}

@InvokeArg
class SecureWindowArgs {
    var enabled: Boolean = false
}

/**
 * Secrets in the Android Keystore:
 *  - `set/get/delete`: values encrypted with a hardware-backed AES-GCM key that needs no user
 *    authentication (API keys the app must use in the background),
 *  - `biometricSeal/Unseal`: the vault's data key encrypted with a *different* Keystore key that
 *    requires a strong biometric for every use (BiometricPrompt + CryptoObject). Enrolling a new
 *    fingerprint invalidates that key, and the sealed value is then dropped.
 *  - `setSecureWindow`: FLAG_SECURE (no screenshots / blank app-switcher preview).
 *
 * Nothing here is verified by unit tests (needs a device) – see the manual checklist in CLAUDE.md.
 */
@TauriPlugin
class SecureStorePlugin(private val activity: Activity) : Plugin(activity) {
    private val prefs
        get() = activity.getSharedPreferences("taschenmesser_secure_store", Context.MODE_PRIVATE)

    private val keyStore: KeyStore by lazy { KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) } }

    private fun b64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)
    private fun unb64(text: String): ByteArray = Base64.decode(text, Base64.NO_WRAP)

    private fun secretKey(alias: String, authRequired: Boolean): SecretKey {
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
        val builder = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
        if (authRequired) {
            builder.setUserAuthenticationRequired(true)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                // Timeout 0 = authenticate for every single use, with a strong biometric.
                builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
            } else {
                builder.setUserAuthenticationValidityDurationSeconds(-1)
            }
            builder.setInvalidatedByBiometricEnrollment(true)
        }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(builder.build())
        return generator.generateKey()
    }

    private fun deleteKey(alias: String) {
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
    }

    /* ---- plain keystore secrets ---- */

    @Command
    fun available(invoke: Invoke) {
        val canBio = BiometricManager.from(activity)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
            BiometricManager.BIOMETRIC_SUCCESS
        val ret = JSObject()
        ret.put("keystore", true)
        ret.put("biometric", canBio && activity is FragmentActivity)
        invoke.resolve(ret)
    }

    @Command
    fun set(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SetArgs::class.java)
            val cipher = Cipher.getInstance(TRANSFORM)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey(SECRETS_ALIAS, false))
            cipher.updateAAD(args.name.toByteArray())
            val ct = cipher.doFinal(args.value.toByteArray())
            prefs.edit().putString("s:${args.name}", "${b64(cipher.iv)}:${b64(ct)}").apply()
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject(e.message ?: e.javaClass.simpleName)
        }
    }

    @Command
    fun get(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(NameArgs::class.java)
            val ret = JSObject()
            val stored = prefs.getString("s:${args.name}", null)
            if (stored != null) {
                val (iv, ct) = stored.split(":", limit = 2).map { unb64(it) }
                val cipher = Cipher.getInstance(TRANSFORM)
                cipher.init(Cipher.DECRYPT_MODE, secretKey(SECRETS_ALIAS, false), GCMParameterSpec(128, iv))
                cipher.updateAAD(args.name.toByteArray())
                ret.put("value", String(cipher.doFinal(ct)))
            }
            invoke.resolve(ret)
        } catch (e: Exception) {
            invoke.reject(e.message ?: e.javaClass.simpleName)
        }
    }

    @Command
    fun delete(invoke: Invoke) {
        val args = invoke.parseArgs(NameArgs::class.java)
        prefs.edit().remove("s:${args.name}").apply()
        invoke.resolve()
    }

    /* ---- biometric gate ---- */

    private fun authenticate(
        title: String,
        subtitle: String,
        cancel: String,
        cipher: Cipher,
        onSuccess: (Cipher) -> Unit,
        onCancel: () -> Unit,
        onError: (String) -> Unit,
    ) {
        val host = activity as? FragmentActivity
        if (host == null) {
            onError("the activity cannot show a biometric prompt")
            return
        }
        activity.runOnUiThread {
            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    val authed = result.cryptoObject?.cipher
                    if (authed == null) onError("no cipher after authentication") else onSuccess(authed)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    when (errorCode) {
                        BiometricPrompt.ERROR_USER_CANCELED,
                        BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                        BiometricPrompt.ERROR_CANCELED -> onCancel()
                        else -> onError(errString.toString())
                    }
                }
            }
            val prompt = BiometricPrompt(host, ContextCompat.getMainExecutor(activity), callback)
            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setNegativeButtonText(cancel)
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .build()
            prompt.authenticate(info, BiometricPrompt.CryptoObject(cipher))
        }
    }

    @Command
    fun biometricSeal(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SealArgs::class.java)
            val secret = unb64(args.secret)
            val cipher = Cipher.getInstance(TRANSFORM)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey(BIOMETRIC_ALIAS, true))
            authenticate(
                args.title, args.subtitle, args.cancel, cipher,
                onSuccess = { authed ->
                    try {
                        authed.updateAAD(args.name.toByteArray())
                        val ct = authed.doFinal(secret)
                        prefs.edit().putString("b:${args.name}", "${b64(authed.iv)}:${b64(ct)}").apply()
                        invoke.resolve()
                    } catch (e: Exception) {
                        invoke.reject(e.message ?: e.javaClass.simpleName)
                    }
                },
                onCancel = { invoke.reject("cancelled") },
                onError = { invoke.reject(it) },
            )
        } catch (e: Exception) {
            invoke.reject(e.message ?: e.javaClass.simpleName)
        }
    }

    @Command
    fun biometricUnseal(invoke: Invoke) {
        val args = invoke.parseArgs(UnsealArgs::class.java)
        fun answer(status: String, secret: ByteArray? = null) {
            val ret = JSObject()
            ret.put("status", status)
            if (secret != null) ret.put("secret", b64(secret))
            invoke.resolve(ret)
        }
        val stored = prefs.getString("b:${args.name}", null)
        if (stored == null) {
            answer("missing")
            return
        }
        try {
            val (iv, ct) = stored.split(":", limit = 2).map { unb64(it) }
            val cipher = Cipher.getInstance(TRANSFORM)
            cipher.init(Cipher.DECRYPT_MODE, secretKey(BIOMETRIC_ALIAS, true), GCMParameterSpec(128, iv))
            authenticate(
                args.title, args.subtitle, args.cancel, cipher,
                onSuccess = { authed ->
                    try {
                        authed.updateAAD(args.name.toByteArray())
                        answer("ok", authed.doFinal(ct))
                    } catch (e: Exception) {
                        invoke.reject(e.message ?: e.javaClass.simpleName)
                    }
                },
                onCancel = { answer("cancelled") },
                onError = { invoke.reject(it) },
            )
        } catch (e: KeyPermanentlyInvalidatedException) {
            // A fingerprint/face was added or removed: the key is gone, so is the sealed value.
            prefs.edit().remove("b:${args.name}").apply()
            deleteKey(BIOMETRIC_ALIAS)
            answer("invalidated")
        } catch (e: Exception) {
            invoke.reject(e.message ?: e.javaClass.simpleName)
        }
    }

    @Command
    fun biometricHas(invoke: Invoke) {
        val args = invoke.parseArgs(NameArgs::class.java)
        val ret = JSObject()
        ret.put("present", prefs.contains("b:${args.name}"))
        invoke.resolve(ret)
    }

    @Command
    fun biometricDelete(invoke: Invoke) {
        val args = invoke.parseArgs(NameArgs::class.java)
        prefs.edit().remove("b:${args.name}").apply()
        invoke.resolve()
    }

    /* ---- screenshot protection ---- */

    @Command
    fun setSecureWindow(invoke: Invoke) {
        val args = invoke.parseArgs(SecureWindowArgs::class.java)
        activity.runOnUiThread {
            if (args.enabled) {
                activity.window.setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE,
                )
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
            invoke.resolve()
        }
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val TRANSFORM = "AES/GCM/NoPadding"
        const val SECRETS_ALIAS = "taschenmesser.secrets.v1"
        const val BIOMETRIC_ALIAS = "taschenmesser.biometric.v1"
    }
}
