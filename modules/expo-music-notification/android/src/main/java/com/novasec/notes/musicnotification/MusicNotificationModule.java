package com.novasec.notes.musicnotification;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * JS-facing bridge for the music playback notification.
 *
 * All calls are fire-and-forget Intents to {@link MusicNotificationService},
 * which owns the actual Notification + MediaSessionCompat. Button taps on
 * the notification / lock screen / headset / Bluetooth flow back to JS as
 * DeviceEventEmitter events (see EVENT_* constants below), which the
 * MusicPlayerEngine in moodmusic.tsx subscribes to.
 */
public class MusicNotificationModule extends ReactContextBaseJavaModule {

  public static final String EVENT_PLAY = "MusicNotification:onPlay";
  public static final String EVENT_PAUSE = "MusicNotification:onPause";
  public static final String EVENT_NEXT = "MusicNotification:onNext";
  public static final String EVENT_PREVIOUS = "MusicNotification:onPrevious";
  public static final String EVENT_SEEK = "MusicNotification:onSeek";
  public static final String EVENT_STOP = "MusicNotification:onStop";

  // Held statically so the Service (which the OS can keep alive independent
  // of any particular JS instance) can always reach the current bridge.
  private static ReactApplicationContext reactContext;

  public MusicNotificationModule(ReactApplicationContext context) {
    super(context);
    reactContext = context;
  }

  @Override
  public String getName() {
    return "MusicNotification";
  }

  /** Called by MusicNotificationService — never called from JS. */
  public static void emit(String eventName, @Nullable WritableMap params) {
    if (reactContext == null || !reactContext.hasActiveCatalystInstance()) return;
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(eventName, params);
  }

  @ReactMethod
  public void showNotification(ReadableMap track, boolean isPlaying, Promise promise) {
    try {
      Intent intent = new Intent(getReactApplicationContext(), MusicNotificationService.class);
      intent.setAction(MusicNotificationService.ACTION_SHOW);
      intent.putExtra("track", Arguments.toBundle(track));
      intent.putExtra("isPlaying", isPlaying);
      startServiceCompat(intent);
      promise.resolve(null);
    } catch (Exception e) {
      promise.reject("E_SHOW_NOTIFICATION", e);
    }
  }

  @ReactMethod
  public void updateTrack(ReadableMap track, boolean isPlaying) {
    Intent intent = new Intent(getReactApplicationContext(), MusicNotificationService.class);
    intent.setAction(MusicNotificationService.ACTION_UPDATE_TRACK);
    intent.putExtra("track", Arguments.toBundle(track));
    intent.putExtra("isPlaying", isPlaying);
    startServiceCompat(intent);
  }

  @ReactMethod
  public void updatePlaybackState(boolean isPlaying, double positionSeconds, double durationSeconds) {
    Intent intent = new Intent(getReactApplicationContext(), MusicNotificationService.class);
    intent.setAction(MusicNotificationService.ACTION_UPDATE_STATE);
    intent.putExtra("isPlaying", isPlaying);
    intent.putExtra("positionSeconds", positionSeconds);
    intent.putExtra("durationSeconds", durationSeconds);
    startServiceCompat(intent);
  }

  @ReactMethod
  public void hideNotification() {
    Intent intent = new Intent(getReactApplicationContext(), MusicNotificationService.class);
    intent.setAction(MusicNotificationService.ACTION_HIDE);
    startServiceCompat(intent);
  }

  // Required no-ops so RN's NativeEventEmitter doesn't warn about a missing
  // addListener/removeListeners pair on this module.
  @ReactMethod
  public void addListener(String eventName) {}

  @ReactMethod
  public void removeListeners(double count) {}

  private void startServiceCompat(Intent intent) {
    Context context = getReactApplicationContext();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent);
    } else {
      context.startService(intent);
    }
  }
}
