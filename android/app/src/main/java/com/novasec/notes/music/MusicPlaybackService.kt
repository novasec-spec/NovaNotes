package com.novasec.notes.music

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.IBinder
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log

class MusicPlaybackService : Service() {

    private val tag = "NovaNotesMusic"
    private val notificationHelper by lazy { MusicNotificationHelper(this) }
    private var mediaSession: MediaSessionCompat? = null

    private var title = "NovaNotes"
    private var artist = "Music"
    private var album = ""
    private var isPlaying = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                MusicConstants.ACTION_PLAY -> {
                    isPlaying = true
                    updateState(PlaybackStateCompat.STATE_PLAYING)
                    emit("PLAY")
                    refresh()
                }
                MusicConstants.ACTION_PAUSE -> {
                    isPlaying = false
                    updateState(PlaybackStateCompat.STATE_PAUSED)
                    emit("PAUSE")
                    refresh()
                }
                MusicConstants.ACTION_NEXT -> emit("NEXT_TRACK")
                MusicConstants.ACTION_PREVIOUS -> emit("PREVIOUS_TRACK")
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        initMediaSession()
        registerReceiverCompat(receiver, listOf(
            MusicConstants.ACTION_PLAY,
            MusicConstants.ACTION_PAUSE,
            MusicConstants.ACTION_NEXT,
            MusicConstants.ACTION_PREVIOUS
        ))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            MusicConstants.ACTION_UPDATE_METADATA -> {
                title = intent.getStringExtra(MusicConstants.EXTRA_TITLE) ?: title
                artist = intent.getStringExtra(MusicConstants.EXTRA_ARTIST) ?: artist
                album = intent.getStringExtra(MusicConstants.EXTRA_ALBUM) ?: album
                isPlaying = intent.getBooleanExtra(MusicConstants.EXTRA_IS_PLAYING, isPlaying)
                refresh()
            }
            else -> startForeground(
                MusicConstants.NOTIFICATION_ID,
                notificationHelper.build(title, artist, album, isPlaying, mediaSession?.sessionToken)
            )
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                MusicConstants.CHANNEL_ID,
                MusicConstants.CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "NovaNotes background music controls"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun initMediaSession() {
        mediaSession = MediaSessionCompat(this, "NovaNotesSession").apply {
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() = sendBroadcast(Intent(MusicConstants.ACTION_PLAY))
                override fun onPause() = sendBroadcast(Intent(MusicConstants.ACTION_PAUSE))
                override fun onSkipToNext() = sendBroadcast(Intent(MusicConstants.ACTION_NEXT))
                override fun onSkipToPrevious() = sendBroadcast(Intent(MusicConstants.ACTION_PREVIOUS))
            })
            isActive = true
        }
    }

    private fun refresh() {
        val notification = notificationHelper.build(
            title, artist, album, isPlaying, mediaSession?.sessionToken
        )
        startForeground(MusicConstants.NOTIFICATION_ID, notification)
    }

    private fun updateState(state: Int) {
        val playbackState = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO
            )
            .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
            .build()
        mediaSession?.setPlaybackState(playbackState)
    }

    private fun emit(eventName: String, data: String = eventName) {
        sendBroadcast(Intent(MusicConstants.BROADCAST_SERVICE_EVENT).apply {
            putExtra(MusicConstants.EXTRA_EVENT_NAME, eventName)
            putExtra(MusicConstants.EXTRA_EVENT_DATA, data)
        })
    }

    private fun registerReceiverCompat(receiver: BroadcastReceiver, actions: List<String>) {
        val filter = IntentFilter().apply { actions.forEach { addAction(it) } }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(receiver, filter)
        }
    }

    override fun onDestroy() {
        unregisterReceiver(receiver)
        mediaSession?.release()
        super.onDestroy()
    }
}
