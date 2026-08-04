package com.novasec.notes.musicnotification;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Owns the single music-playback notification + MediaSessionCompat for the
 * whole app. Runs as a foreground service so playback controls (and, on
 * Android, the notification itself) survive the RN activity being
 * backgrounded or killed by the OS.
 *
 * JS -> here:  Intents with ACTION_SHOW / ACTION_UPDATE_TRACK /
 *              ACTION_UPDATE_STATE / ACTION_HIDE (sent by MusicNotificationModule)
 * here -> JS:  MusicNotificationModule.emit(...) for taps on the
 *              notification buttons, lock screen, headset button, or
 *              Bluetooth controls (all routed through MediaSessionCompat.Callback
 *              so every input source is handled uniformly).
 */
public class MusicNotificationService extends Service {

  public static final String ACTION_SHOW = "com.novasec.notes.musicnotification.SHOW";
  public static final String ACTION_UPDATE_TRACK = "com.novasec.notes.musicnotification.UPDATE_TRACK";
  public static final String ACTION_UPDATE_STATE = "com.novasec.notes.musicnotification.UPDATE_STATE";
  public static final String ACTION_HIDE = "com.novasec.notes.musicnotification.HIDE";

  public static final String ACTION_PLAY = "com.novasec.notes.musicnotification.PLAY";
  public static final String ACTION_PAUSE = "com.novasec.notes.musicnotification.PAUSE";
  public static final String ACTION_NEXT = "com.novasec.notes.musicnotification.NEXT";
  public static final String ACTION_PREVIOUS = "com.novasec.notes.musicnotification.PREVIOUS";
  public static final String ACTION_STOP = "com.novasec.notes.musicnotification.STOP";

  private static final String CHANNEL_ID = "novanotes_music_playback";
  private static final int NOTIFICATION_ID = 5150;

  private MediaSessionCompat mediaSession;
  private NotificationManagerCompat notificationManager;
  private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();

  private String title = "";
  private String artist = "";
  private String album = "";
  private String artworkUri = null;
  private Bitmap artworkBitmap = null;
  private boolean isPlaying = false;
  private long positionMs = 0;
  private long durationMs = 0;

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    notificationManager = NotificationManagerCompat.from(this);
    createChannelIfNeeded();
    setupMediaSession();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent == null || intent.getAction() == null) {
      return START_STICKY;
    }

    switch (intent.getAction()) {
      case ACTION_SHOW:
      case ACTION_UPDATE_TRACK:
        readTrackExtras(intent);
        isPlaying = intent.getBooleanExtra("isPlaying", isPlaying);
        updateMediaSessionMetadata();
        updatePlaybackStateInternal();
        loadArtworkAndNotify();
        break;

      case ACTION_UPDATE_STATE:
        isPlaying = intent.getBooleanExtra("isPlaying", isPlaying);
        positionMs = (long) (intent.getDoubleExtra("positionSeconds", positionMs / 1000.0) * 1000);
        durationMs = (long) (intent.getDoubleExtra("durationSeconds", durationMs / 1000.0) * 1000);
        updatePlaybackStateInternal();
        postNotification();
        break;

      case ACTION_HIDE:
        stopForegroundCompat();
        stopSelf();
        break;

      // These four fire when the user taps a button on the notification
      // itself (see the PendingIntents built in buildNotification()).
      // Lock-screen / headset / Bluetooth taps go through the
      // MediaSessionCompat.Callback registered in setupMediaSession()
      // instead — both paths funnel into the same MusicNotificationModule.emit().
      case ACTION_PLAY:
        MusicNotificationModule.emit(MusicNotificationModule.EVENT_PLAY, null);
        break;
      case ACTION_PAUSE:
        MusicNotificationModule.emit(MusicNotificationModule.EVENT_PAUSE, null);
        break;
      case ACTION_NEXT:
        MusicNotificationModule.emit(MusicNotificationModule.EVENT_NEXT, null);
        break;
      case ACTION_PREVIOUS:
        MusicNotificationModule.emit(MusicNotificationModule.EVENT_PREVIOUS, null);
        break;
      case ACTION_STOP:
        MusicNotificationModule.emit(MusicNotificationModule.EVENT_STOP, null);
        stopForegroundCompat();
        stopSelf();
        break;
    }

    return START_STICKY;
  }

  private void readTrackExtras(Intent intent) {
    Bundle trackBundle = intent.getBundleExtra("track");
    if (trackBundle == null) return;

    title = trackBundle.getString("title", "Unknown Track");
    artist = trackBundle.getString("artist", "Unknown Artist");
    album = trackBundle.getString("album", "");
    durationMs = (long) (trackBundle.getDouble("duration", 0) * 1000);
    positionMs = 0;

    String newArtworkUri = trackBundle.getString("artworkUri", null);
    boolean artworkChanged = newArtworkUri == null ? artworkUri != null : !newArtworkUri.equals(artworkUri);
    if (artworkChanged) {
      artworkBitmap = null; // force a reload for the new track
    }
    artworkUri = newArtworkUri;
  }

  private void setupMediaSession() {
    mediaSession = new MediaSessionCompat(this, "NovaNotesMusicSession");
    mediaSession.setFlags(
      MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
      MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
    );
    mediaSession.setCallback(new MediaSessionCompat.Callback() {
      @Override
      public void onPlay() {
        MusicNotificationModule.emit(MusicNotificationModule.EVENT_PLAY, null);
      }

      @Override
      public void onPause() {
        MusicNotificationModule.emit(MusicNotificationModule.EVENT_PAUSE, null);
      }

      @Override
      public void onSkipToNext() {
        MusicNotificationModule.emit(MusicNotificationModule.EVENT_NEXT, null);
      }

      @Override
      public void onSkipToPrevious() {
        MusicNotificationModule.emit(MusicNotificationModule.EVENT_PREVIOUS, null);
      }

      @Override
      public void onSeekTo(long pos) {
        WritableMap params = Arguments.createMap();
        params.putDouble("positionSeconds", pos / 1000.0);
        MusicNotificationModule.emit(MusicNotificationModule.EVENT_SEEK, params);
      }

      @Override
      public void onStop() {
        MusicNotificationModule.emit(MusicNotificationModule.EVENT_STOP, null);
        stopForegroundCompat();
        stopSelf();
      }
    });
    mediaSession.setActive(true);
  }

  private void updateMediaSessionMetadata() {
    MediaMetadataCompat.Builder builder = new MediaMetadataCompat.Builder()
      .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
      .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
      .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
      .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);
    if (artworkBitmap != null) {
      builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artworkBitmap);
    }
    mediaSession.setMetadata(builder.build());
  }

  private void updatePlaybackStateInternal() {
    int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
    long actions = PlaybackStateCompat.ACTION_PLAY
      | PlaybackStateCompat.ACTION_PAUSE
      | PlaybackStateCompat.ACTION_PLAY_PAUSE
      | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
      | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
      | PlaybackStateCompat.ACTION_SEEK_TO
      | PlaybackStateCompat.ACTION_STOP;

    PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
      .setActions(actions)
      .setState(state, positionMs, isPlaying ? 1f : 0f)
      .build();
    mediaSession.setPlaybackState(playbackState);
  }

  private void loadArtworkAndNotify() {
    if (artworkBitmap != null || artworkUri == null) {
      postNotification();
      return;
    }
    final String uriToLoad = artworkUri;
    artworkExecutor.execute(() -> {
      Bitmap bmp = fetchBitmap(uriToLoad);
      // Guard against a track change happening while this was loading.
      if (bmp != null && uriToLoad.equals(artworkUri)) {
        artworkBitmap = bmp;
        updateMediaSessionMetadata();
      }
      postNotification();
    });
  }

  private Bitmap fetchBitmap(String uriString) {
    try {
      if (uriString.startsWith("http://") || uriString.startsWith("https://")) {
        URL url = new URL(uriString);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setDoInput(true);
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);
        connection.connect();
        try (InputStream input = connection.getInputStream()) {
          return BitmapFactory.decodeStream(input);
        }
      } else {
        Uri uri = Uri.parse(uriString);
        try (InputStream input = getContentResolver().openInputStream(uri)) {
          if (input == null) return null;
          return BitmapFactory.decodeStream(input);
        }
      }
    } catch (Exception e) {
      Log.w("MusicNotification", "Could not load artwork: " + e.getMessage());
      return null;
    }
  }

  private void postNotification() {
    Notification notification = buildNotification();
    if (isPlaying) {
      startForegroundCompat(notification);
    } else {
      // Detach from foreground while paused (matches Spotify/YT Music
      // behavior) so the user — or the system — can swipe it away, but
      // keep showing it so play/skip controls stay reachable.
      stopForeground(Service.STOP_FOREGROUND_DETACH);
      notificationManager.notify(NOTIFICATION_ID, notification);
    }
  }

  private Notification buildNotification() {
    PendingIntent playPausePI = actionPendingIntent(isPlaying ? ACTION_PAUSE : ACTION_PLAY, 1);
    PendingIntent nextPI = actionPendingIntent(ACTION_NEXT, 2);
    PendingIntent prevPI = actionPendingIntent(ACTION_PREVIOUS, 3);
    PendingIntent stopPI = actionPendingIntent(ACTION_STOP, 4);
    PendingIntent contentPI = buildContentIntent();

    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(getSmallIconRes())
      .setContentTitle(title)
      .setContentText(artist)
      .setSubText(album)
      .setLargeIcon(artworkBitmap)
      .setContentIntent(contentPI)
      .setDeleteIntent(stopPI)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .addAction(new NotificationCompat.Action(android.R.drawable.ic_media_previous, "Previous", prevPI))
      .addAction(new NotificationCompat.Action(
        isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
        isPlaying ? "Pause" : "Play",
        playPausePI))
      .addAction(new NotificationCompat.Action(android.R.drawable.ic_media_next, "Next", nextPI))
      .setStyle(new MediaStyle()
        .setMediaSession(mediaSession.getSessionToken())
        .setShowActionsInCompactView(0, 1, 2)
        .setShowCancelButton(true)
        .setCancelButtonIntent(stopPI));

    return builder.build();
  }

  private int getSmallIconRes() {
    int resId = getResources().getIdentifier("ic_stat_music_note", "drawable", getPackageName());
    return resId != 0 ? resId : android.R.drawable.ic_media_play;
  }

  private PendingIntent buildContentIntent() {
    Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
    int flags = PendingIntent.FLAG_UPDATE_CURRENT
      | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
    return PendingIntent.getActivity(this, 0, launchIntent, flags);
  }

  private PendingIntent actionPendingIntent(String action, int requestCode) {
    Intent intent = new Intent(this, MusicNotificationService.class);
    intent.setAction(action);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT
      | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
    return PendingIntent.getService(this, requestCode, intent, flags);
  }

  private void startForegroundCompat(Notification notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }
  }

  private void stopForegroundCompat() {
    stopForeground(Service.STOP_FOREGROUND_REMOVE);
    notificationManager.cancel(NOTIFICATION_ID);
  }

  private void createChannelIfNeeded() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID, "Music Playback", NotificationManager.IMPORTANCE_LOW);
      channel.setDescription("Controls for the song currently playing");
      channel.setShowBadge(false);
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager != null) {
        manager.createNotificationChannel(channel);
      }
    }
  }

  @Override
  public void onDestroy() {
    super.onDestroy();
    if (mediaSession != null) {
      mediaSession.setActive(false);
      mediaSession.release();
    }
    artworkExecutor.shutdown();
  }
}
