package com.novasec.notes.quicktile

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class QuickCaptureTaskService : HeadlessJsTaskService() {

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.ensureChannel(this)
        // Must call startForeground() promptly after startForegroundService()
        // or Android will kill the process (ANR-style enforcement since API 26).
        startForeground(NotificationHelper.NOTIFICATION_ID, NotificationHelper.build(this, "Saving note…", true))
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
        return HeadlessJsTaskConfig(
            "QuickCaptureTask",
            Arguments.createMap(),
            15000, // hard timeout in ms — task should finish well before this
            true   // allowedInForeground: required since this is already a foreground service
        )
    }

    // NOTE: the JS task is expected to call QuickCaptureModule.finish(...)
    // as its last step, which updates the notification to "Saved" and stops
    // this service. If the task times out or crashes before calling finish,
    // the base HeadlessJsTaskService will still stopSelf() — the notification
    // will be left showing "Saving…", which is the one known edge case here.
}
