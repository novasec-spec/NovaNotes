package com.novasec.notes.music

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import com.novasec.notes.MainActivity
import com.novasec.notes.R

class MusicNotificationHelper(private val context: Context) {

    fun build(
        title: String,
        artist: String,
        album: String,
        isPlaying: Boolean,
        sessionToken: android.support.v4.media.session.MediaSessionCompat.Token?
    ): Notification {

        val openApp = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            context, 0, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val playIntent = broadcastIntent(MusicConstants.ACTION_PLAY, 1)
        val pauseIntent = broadcastIntent(MusicConstants.ACTION_PAUSE, 2)
        val nextIntent = broadcastIntent(MusicConstants.ACTION_NEXT, 3)
        val prevIntent = broadcastIntent(MusicConstants.ACTION_PREVIOUS, 4)

        val (toggleIntent, toggleIcon, toggleTitle) = if (isPlaying) {
            Triple(pauseIntent, R.drawable.ic_pause, "Pause")
        } else {
            Triple(playIntent, R.drawable.ic_play, "Play")
        }

        return NotificationCompat.Builder(context, MusicConstants.CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(album.takeIf { it.isNotBlank() })
            .setSmallIcon(R.drawable.ic_music_note)
            .setContentIntent(contentIntent)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(R.drawable.ic_skip_previous, "Previous", prevIntent)
            .addAction(toggleIcon, toggleTitle, toggleIntent)
            .addAction(R.drawable.ic_skip_next, "Next", nextIntent)
            .setStyle(
                MediaStyle()
                    .setMediaSession(sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .build()
    }

    private fun broadcastIntent(action: String, reqCode: Int): PendingIntent {
        return PendingIntent.getBroadcast(
            context, reqCode, Intent(action),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
