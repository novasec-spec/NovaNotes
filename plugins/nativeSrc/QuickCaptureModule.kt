package com.novasec.notes.quicktile

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class QuickCaptureModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "QuickCaptureModule"

    @ReactMethod
    fun finish(success: Boolean, message: String) {
        val ctx = reactApplicationContext.applicationContext
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NotificationHelper.NOTIFICATION_ID, NotificationHelper.build(ctx, message, false))
        ctx.stopService(Intent(ctx, QuickCaptureTaskService::class.java))
    }

    // Required no-ops so NativeEventEmitter doesn't warn if you later add
    // events (e.g. to reflect capture status live in the app UI).
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
