package com.novasec.notes; // Replace with your actual package name

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;
import androidx.annotation.RequiresApi;

@RequiresApi(api = Build.VERSION_CODES.N)
public class QuickNoteTileService extends TileService {

    // Resolves through Expo Router's linking config to the /notes screen.
    // Make sure app.json has "scheme": "novanotes" and a matching route.
    private static final String DEEP_LINK = "novanote://notes";

    @Override
    public void onClick() {
        super.onClick();

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK));
        intent.setPackage(getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Android 14+ (API 34): startActivityAndCollapse(Intent) is deprecated
            // in favor of the PendingIntent overload.
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    this,
                    0,
                    intent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );
            startActivityAndCollapse(pendingIntent);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10-13 (API 29-33)
            startActivityAndCollapse(intent);
        } else {
            // Android 7-9 (API 24-28)
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
