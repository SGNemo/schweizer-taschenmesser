package io.github.sgnemo.taschenmesser.shareintent

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * Quick-settings tile "Nemo: Erfassen". A tap only starts the app with the "open capture" extra
 * (the same one the launcher shortcut sends); the tile reads and keeps no data. The launch intent
 * comes from the package manager, so it targets the stable app and the Dev-Preview alike.
 */
class CaptureTileService : TileService() {
    override fun onStartListening() {
        super.onStartListening()
        // An action tile, not a switch: always shown as "inactive".
        qsTile?.let {
            it.state = Tile.STATE_INACTIVE
            it.updateTile()
        }
    }

    override fun onClick() {
        super.onClick()
        val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        launch.putExtra(EXTRA_OPEN, OPEN_CAPTURE)
        // On a locked phone the user unlocks first; nothing opens over the lock screen.
        if (isLocked) unlockAndRun { open(launch) } else open(launch)
    }

    private fun open(intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Android 14+: only the PendingIntent variant is allowed.
            val pending = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            startActivityAndCollapse(pending)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}
