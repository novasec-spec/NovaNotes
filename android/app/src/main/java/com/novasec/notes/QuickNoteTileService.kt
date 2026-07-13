package com.novasec.notes

import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.N)
class QuickNoteTileService : TileService() {

    override fun onClick() {
        super.onClick()
        
        val intent = Intent(this, MainActivity::class.java).apply {
            action = "com.novasec.notes.QUICK_NOTE"
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startActivityAndCollapse(intent)
        } else {
            @Suppress("DEPRECATION")
            startActivity(intent)
        }
    }

    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply {
            label = "Take Note"
            contentDescription = "Quickly create a new note"
            state = Tile.STATE_ACTIVE
            updateTile()
        }
    }
}

