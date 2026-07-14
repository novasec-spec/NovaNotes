package com.novasec.notes; // Replace with your actual package name

import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;
import androidx.annotation.RequiresApi;
import com.novasec.notes.MainActivity; // Your main activity

@RequiresApi(api = Build.VERSION_CODES.N)
public class QuickNoteTileService extends TileService {

    @Override
    public void onClick() {
        super.onClick();
        
        // Create intent to open your app with a specific deep link or action
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction("com.novasec.notes.QUICK_NOTE");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        // For Android 10+ (API 29), use startActivityAndCollapse
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startActivityAndCollapse(intent);
        } else {
            startActivity(intent);
        }
    }

    @Override
    public void onStartListening() {
        super.onStartListening();
        Tile tile = getQsTile();
        if (tile != null) {
            tile.setLabel("Take Note");
            tile.setContentDescription("Quickly create a new note");
            tile.setState(Tile.STATE_ACTIVE);
            tile.updateTile();
        }
    }
}
