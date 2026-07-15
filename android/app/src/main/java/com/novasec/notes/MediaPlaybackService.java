package com.novasec.notes;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;
import android.app.Service;
import android.util.Log;
import android.graphics.BitmapFactory;

public class MediaPlaybackService extends Service {
    private static final String CHANNEL_ID = "music_playback_channel";
    private String currentTitle = "Song Title";
    private String currentArtist = "Artist Name";
    private String currentAlbum = "Album Name";

    private static final int NOTIFICATION_ID = 1;
    
    public static final String ACTION_PLAY = "com.novasec.notes.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.novasec.notes.ACTION_PAUSE";
    public static final String ACTION_NEXT = "com.novasec.notes.ACTION_NEXT";
    public static final String ACTION_PREVIOUS = "com.novasec.notes.ACTION_PREVIOUS";
    
    private MediaSessionCompat mediaSession;
    private MediaPlayer mediaPlayer;
    private boolean isPlaying = false;
    
    private BroadcastReceiver mediaReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            Log.d("MediaService", "Received: " + action);
            
            switch (action) {
                case ACTION_PLAY:
                    play();
                    break;
                case ACTION_PAUSE:
                    pause();
                    break;
                case ACTION_NEXT:
                    // Send event to React Native
                    sendEventToJS("NEXT_TRACK");
                    break;
                case ACTION_PREVIOUS:
                    sendEventToJS("PREVIOUS_TRACK");
                    break;
            }
        }
    };
    
    @Override
    public void onCreate() {
        super.onCreate();
        
        // Create notification channel (Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Music Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Controls for music playback");
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
        
        // Setup MediaSession
        mediaSession = new MediaSessionCompat(this, "MusicSession");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | 
                             MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        
        // Register receiver for custom actions
        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_PLAY);
        filter.addAction(ACTION_PAUSE);
        filter.addAction(ACTION_NEXT);
        filter.addAction(ACTION_PREVIOUS);
        registerReceiver(mediaReceiver, filter);
    }
    
    private Notification buildNotification() {
        // PendingIntent to open app when tapped
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this, 0, openAppIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Action intents
        PendingIntent playIntent = createActionIntent(ACTION_PLAY, 1);
        PendingIntent pauseIntent = createActionIntent(ACTION_PAUSE, 2);
        PendingIntent nextIntent = createActionIntent(ACTION_NEXT, 3);
        PendingIntent prevIntent = createActionIntent(ACTION_PREVIOUS, 4);
        
        // Build notification with MediaStyle
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Song Title")
            .setContentText("Artist Name")
            .setSubText("Album Name")
            .setSmallIcon(R.drawable.ic_music_note) // Your music icon
            .setLargeIcon(BitmapFactory.decodeResource(getResources(), R.drawable.ic_music_note))
            .setContentIntent(contentIntent)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .addAction(R.drawable.ic_skip_previous, "Previous", prevIntent)
            .addAction(isPlaying ? R.drawable.ic_pause : R.drawable.ic_play, 
                      isPlaying ? "Pause" : "Play", 
                      isPlaying ? pauseIntent : playIntent)
            .addAction(R.drawable.ic_skip_next, "Next", nextIntent)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2) // Show prev, play/pause, next in compact mode
            );
        
        return builder.build();
    }
    
    private PendingIntent createActionIntent(String action, int requestCode) {
        Intent intent = new Intent(action);
        return PendingIntent.getBroadcast(
            this, requestCode, intent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
    
    private void play() {
        isPlaying = true;
        updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
        startForeground(NOTIFICATION_ID, buildNotification());
    }
    
    private void pause() {
        isPlaying = false;
        updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
        startForeground(NOTIFICATION_ID, buildNotification());
    }
    
    private void updatePlaybackState(int state) {
        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO
            )
            .setState(state, 0, 1.0f);
        mediaSession.setPlaybackState(stateBuilder.build());
    }
    
    private void sendEventToJS(String event) {
    // Get the ReactInstanceManager and emit the event
    ReactApplicationContext reactContext = 
        ((MainApplication) getApplication()).getReactNativeHost()
            .getReactInstanceManager()
            .getCurrentReactContext();
    
    if (reactContext != null) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("MediaControlEvent", event);
    }
    }

    
    @Override
public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && "UPDATE_METADATA".equals(intent.getAction())) {
        currentTitle = intent.getStringExtra("title");
        currentArtist = intent.getStringExtra("artist");
        currentAlbum = intent.getStringExtra("album");
        // Rebuild notification with new metadata
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.notify(NOTIFICATION_ID, buildNotification());
    } else {
        startForeground(NOTIFICATION_ID, buildNotification());
    }
    return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        unregisterReceiver(mediaReceiver);
        if (mediaSession != null) mediaSession.release();
        if (mediaPlayer != null) mediaPlayer.release();
    }
}
