package com.novasec.notes.quicktile

import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

class QuickCaptureTileService : TileService() {

    override fun onClick() {
        super.onClick()

        qsTile?.let {
            it.state = Tile.STATE_ACTIVE
            it.updateTile()
        }

        val serviceIntent = Intent(this, QuickCaptureTaskService::class.java)
        try {
            // TileService.onClick() is one of the few background contexts
            // Android grants a temporary exemption from background-start
            // restrictions for starting a foreground service — this is
            // what makes a truly UI-less capture possible.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            resetTileState()
        }
    }

    override fun onStartListening() {
        super.onStartListening()
        resetTileState()
    }

    private fun resetTileState() {
        qsTile?.let {
            it.state = Tile.STATE_INACTIVE
            it.updateTile()
        }
    }
}

