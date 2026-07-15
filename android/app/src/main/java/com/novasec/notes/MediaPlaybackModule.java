package com.novasec.notes;

import android.content.Intent;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class MediaPlaybackModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public MediaPlaybackModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @NonNull
    @Override
    public String getName() {
        return "MediaPlaybackModule";
    }

    // Called from JS to start the service
    @ReactMethod
    public void startService() {
        Intent intent = new Intent(reactContext, MediaPlaybackService.class);
        reactContext.startForegroundService(intent);
    }

    // Called from JS to stop the service
    @ReactMethod
    public void stopService() {
        Intent intent = new Intent(reactContext, MediaPlaybackService.class);
        reactContext.stopService(intent);
    }

    // Called from JS to update notification metadata
    @ReactMethod
    public void updateMetadata(String title, String artist, String album) {
        // You can extend this to pass data to the service via Intent extras
        Intent intent = new Intent(reactContext, MediaPlaybackService.class);
        intent.setAction("UPDATE_METADATA");
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("album", album);
        reactContext.startService(intent);
    }

    // Called from JS to send play/pause commands
    @ReactMethod
    public void sendCommand(String action) {
        Intent intent = new Intent(action);
        reactContext.sendBroadcast(intent);
    }

    // Helper to emit events to JavaScript
    public void sendEventToJS(String eventName, String data) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, data);
    }
}
