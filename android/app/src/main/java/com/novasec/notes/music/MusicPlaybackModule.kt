package com.novasec.notes.music

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class MusicPlaybackModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val eventReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != MusicConstants.BROADCAST_SERVICE_EVENT) return
            val name = intent.getStringExtra(MusicConstants.EXTRA_EVENT_NAME) ?: return
            val data = intent.getStringExtra(MusicConstants.EXTRA_EVENT_DATA) ?: name
            sendToJS(data)
        }
    }

    override fun getName(): String = "MediaPlaybackModule"

    override fun initialize() {
        super.initialize()
        val filter = IntentFilter(MusicConstants.BROADCAST_SERVICE_EVENT)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            reactApplicationContext.registerReceiver(eventReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactApplicationContext.registerReceiver(eventReceiver, filter)
        }
    }

    override fun onCatalystInstanceDestroy() {
        reactApplicationContext.unregisterReceiver(eventReceiver)
        super.onCatalystInstanceDestroy()
    }

    @ReactMethod
    fun startService() {
        val intent = Intent(reactApplicationContext, MusicPlaybackService::class.java)
        reactApplicationContext.startForegroundService(intent)
    }

    @ReactMethod
    fun stopService() {
        reactApplicationContext.stopService(
            Intent(reactApplicationContext, MusicPlaybackService::class.java)
        )
    }

    @ReactMethod
    fun updateMetadata(title: String, artist: String, album: String?, artworkUrl: String?, isPlaying: Boolean) {
        val intent = Intent(reactApplicationContext, MusicPlaybackService::class.java).apply {
            action = MusicConstants.ACTION_UPDATE_METADATA
            putExtra(MusicConstants.EXTRA_TITLE, title)
            putExtra(MusicConstants.EXTRA_ARTIST, artist)
            putExtra(MusicConstants.EXTRA_ALBUM, album ?: "")
            putExtra(MusicConstants.EXTRA_ARTWORK_URL, artworkUrl ?: "")
            putExtra(MusicConstants.EXTRA_IS_PLAYING, isPlaying)
        }
        reactApplicationContext.startService(intent)
    }

    @ReactMethod
    fun sendCommand(action: String) {
        reactApplicationContext.sendBroadcast(Intent(action))
    }

    private fun sendToJS(data: String) {
        val ctx = reactApplicationContext
        if (ctx.hasActiveReactInstance()) {
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(MusicConstants.EVENT_MEDIA_CONTROL, data)
        }
    }
}
