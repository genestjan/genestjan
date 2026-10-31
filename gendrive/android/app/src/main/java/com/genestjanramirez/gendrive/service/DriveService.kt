package com.genestjanramirez.gendrive.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.service.notification.NotificationListenerService
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.genestjanramirez.gendrive.R
import com.genestjanramirez.gendrive.core.drive.VideoGuardPolicy
import com.genestjanramirez.gendrive.core.vehicle.Gear
import com.genestjanramirez.gendrive.graph
import com.genestjanramirez.gendrive.notify.GenDriveNotificationListener
import com.genestjanramirez.gendrive.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Runs while the car is on: reads the car, logs trips and charging, speaks
 * warnings, and applies the Park-only video rule. Takes no wake locks, so it can
 * never keep the head unit awake after the car is switched off.
 */
class DriveService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var guard: VideoGuard
    private var stoppedSinceMs: Long? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, buildNotification())
        guard = VideoGuard(this)
        val g = graph
        g.vehicle.start()
        g.media.refresh()
        rebindNotificationListener()
        g.voice.greetIfDue()
        scope.launch {
            while (isActive) {
                g.trips.onSample(g.vehicle.state.value)
                g.voice.checkWarnings()
                delay(1_000)
            }
        }
        // The video rule runs on its own faster loop so a gear change is acted on quickly.
        scope.launch {
            while (isActive) {
                applyVideoRule()
                delay(if (guard.isShowing) 250 else 400)
            }
        }
    }

    private fun applyVideoRule() {
        val state = graph.vehicle.state.value
        // Reverse: the camera must be visible. Hide first, ask questions later.
        if (state.gear == Gear.R) {
            guard.hide()
            return
        }
        val now = System.currentTimeMillis()
        val speed = state.speedKmh
        stoppedSinceMs = if (speed != null && speed < 1.0) stoppedSinceMs ?: now else null
        if (!guard.canRun()) {
            guard.hide()
            return
        }
        val cover = VideoGuardPolicy.shouldCover(
            state = state,
            stoppedForMs = stoppedSinceMs?.let { now - it } ?: 0L,
            foregroundPackage = guard.foregroundPackage(),
            includeDemoData = graph.settings.current.videoGuardOnDemoData,
        )
        if (cover) guard.show() else guard.hide()
    }

    /**
     * BYD's app-start gate can refuse to bind a third-party notification listener
     * while the app is not running (documented by OverDrive). Now that we are
     * running, ask Android to bind it again.
     */
    private fun rebindNotificationListener() {
        if (!NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName)) return
        try {
            NotificationListenerService.requestRebind(ComponentName(this, GenDriveNotificationListener::class.java))
        } catch (e: Exception) {
            // Not supported on this head unit; the listener binds on its own when allowed.
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        guard.hide()
        graph.trips.flush()
        scope.cancel()
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, getString(R.string.drive_service_channel), NotificationManager.IMPORTANCE_MIN),
        )
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_gendrive)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.drive_service_text))
            .setContentIntent(open)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "drive"
        private const val NOTIFICATION_ID = 7

        fun start(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, DriveService::class.java))
        }
    }
}

/** Starts GenDrive's service when the head unit boots (the car is switched on). */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            DriveService.start(context)
        }
    }
}
