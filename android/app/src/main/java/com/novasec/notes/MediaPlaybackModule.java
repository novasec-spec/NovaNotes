package com.novasec.notes;

import android.content.Intent;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class MediaPlaybackModule extends ReactContextBaseJavaModule {
    // Static reference so the Service can reach us without needing ReactContext
    private static MediaPlaybackModule instance;

    public MediaPlaybackModule(ReactApplicationContext context) {
        super(context);
        instance = this;
    }

    @NonNull
    @Override
    public String getName() {
        return "MediaPlaybackModule";
    }

    // Called by the Service — no React imports needed in Service
    public static void emitEvent(String eventName, String data) {
        if (instance != null) {
            instance.sendEvent(eventName, data);
        }
    }

    private void sendEvent(String eventName, String data) {
        ReactApplicationContext ctx = getReactApplicationContext();
        if (ctx != null && ctx.hasActiveReactInstance()) {
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
              .emit(eventName, data);
        }
    }

    @ReactMethod
    public void startService() {
        Intent intent = new Intent(getReactApplicationContext(), MediaPlaybackService.class);
        getReactApplicationContext().startForegroundService(intent);
    }

    @ReactMethod
    public void stopService() {
        Intent intent = new Intent(getReactApplicationContext(), MediaPlaybackService.class);
        getReactApplicationContext().stopService(intent);
    }

    @ReactMethod
    public void updateMetadata(String title, String artist, String album) {
        Intent intent = new Intent(getReactApplicationContext(), MediaPlaybackService.class);
        intent.setAction("UPDATE_METADATA");
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("album", album);
        getReactApplicationContext().startService(intent);
    }

    @ReactMethod
    public void sendCommand(String action) {
        Intent intent = new Intent(action);
        getReactApplicationContext().sendBroadcast(intent);
    }
}

