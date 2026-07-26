package com.novasec.notes.music

object MusicConstants {
    const val CHANNEL_ID = "novanotes_music_channel"
    const val CHANNEL_NAME = "Music Playback"
    const val NOTIFICATION_ID = 1

    // Notification → Service actions
    const val ACTION_PLAY = "com.novasec.notes.music.ACTION_PLAY"
    const val ACTION_PAUSE = "com.novasec.notes.music.ACTION_PAUSE"
    const val ACTION_NEXT = "com.novasec.notes.music.ACTION_NEXT"
    const val ACTION_PREVIOUS = "com.novasec.notes.music.ACTION_PREVIOUS"

    // Module → Service commands
    const val ACTION_UPDATE_METADATA = "com.novasec.notes.music.UPDATE_METADATA"
    const val ACTION_STOP_SERVICE = "com.novasec.notes.music.STOP_SERVICE"

    // Extras
    const val EXTRA_TITLE = "title"
    const val EXTRA_ARTIST = "artist"
    const val EXTRA_ALBUM = "album"
    const val EXTRA_ARTWORK_URL = "artwork_url"
    const val EXTRA_IS_PLAYING = "is_playing"

    // Service → Module broadcast
    const val BROADCAST_SERVICE_EVENT = "com.novasec.notes.music.SERVICE_EVENT"
    const val EXTRA_EVENT_NAME = "event_name"
    const val EXTRA_EVENT_DATA = "event_data"

    // JS event name
    const val EVENT_MEDIA_CONTROL = "MediaControlEvent"
}
