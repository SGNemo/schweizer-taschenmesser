package io.github.sgnemo.taschenmesser.apkinstaller

import androidx.core.content.FileProvider

/** Own subclass so the manifest entry does not collide with the FileProvider of the app template. */
class ApkFileProvider : FileProvider()
