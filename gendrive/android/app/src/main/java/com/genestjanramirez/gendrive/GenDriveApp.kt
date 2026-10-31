package com.genestjanramirez.gendrive

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import com.genestjanramirez.gendrive.adb.AdbHelper
import com.genestjanramirez.gendrive.apps.AppsRepository
import com.genestjanramirez.gendrive.data.SettingsStore
import com.genestjanramirez.gendrive.media.LyricsRepository
import com.genestjanramirez.gendrive.media.MediaRepository
import com.genestjanramirez.gendrive.nav.NavRepository
import com.genestjanramirez.gendrive.trips.TripRepository
import com.genestjanramirez.gendrive.vehicle.VehicleRepository
import com.genestjanramirez.gendrive.voice.VoiceAssistant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class GenDriveApp : Application() {
    lateinit var graph: AppGraph
        private set

    override fun onCreate() {
        super.onCreate()
        graph = AppGraph(this)
        graph.apps.refresh()
        registerReceiver(
            object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) = graph.apps.refresh()
            },
            IntentFilter().apply {
                addAction(Intent.ACTION_PACKAGE_ADDED)
                addAction(Intent.ACTION_PACKAGE_REMOVED)
                addAction(Intent.ACTION_PACKAGE_REPLACED)
                addDataScheme("package")
            },
        )
    }
}

/** Everything the app shares, created once. Small enough not to need a DI library. */
class AppGraph(val app: Application) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val settings = SettingsStore(app)
    val vehicle = VehicleRepository(app, settings, scope)
    val media = MediaRepository(app)
    val lyrics = LyricsRepository(app, scope, media, settings)
    val nav = NavRepository()
    val apps = AppsRepository(app, scope)
    val trips = TripRepository(app, settings, scope)
    val adb = AdbHelper(app)
    /** Created on first use, after everything it depends on exists. */
    val voice: VoiceAssistant by lazy { VoiceAssistant(app, this) }
}

val Context.graph: AppGraph get() = (applicationContext as GenDriveApp).graph
